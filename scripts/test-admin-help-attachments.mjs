import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";

const sqlite = new DatabaseSync(":memory:");
for (const name of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${name}`, "utf8"));
const db = drizzle(async (query, params, method) => {
  const statement = sqlite.prepare(query);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
let authenticated = true, documentFailure = "", messageFailure = false;
const objects = new Map(), calls = [];
const env = { TIPOOK_ADMIN_USER_ID: "admin", TELEGRAM_ADMIN_CHAT_ID: "admin-chat", TELEGRAM_BOT_TOKEN: "fixture-token", BUCKET: {
  put: async (key, stream, metadata) => {
    const bytes = await new Response(stream).arrayBuffer();
    objects.set(key, { ...metadata, size: bytes.byteLength, arrayBuffer: async () => bytes });
  },
  head: async key => objects.get(key), get: async key => objects.get(key),
} };
const context = createContext({ URL, Request, Response, Headers, FormData, File, AbortSignal, crypto: webcrypto, console, Date,
  fetch: async (url, options) => {
    assert.match(url, /^https:\/\/api\.telegram\.org\/botfixture-token\/send(Message|Document)$/);
    calls.push({ url, body: options.body });
    if (url.endsWith("sendMessage")) return Response.json({ ok: !messageFailure }, { status: messageFailure ? 500 : 200 });
    if (documentFailure === "network") throw new Error("Fixture network failure");
    return Response.json({ ok: !documentFailure }, { status: documentFailure === "http" ? 500 : 200 });
  },
});
const fixtures = {
  "@/db": { getDb: () => db }, "@/db/schema": schema, "cloudflare:workers": { env },
  "@/lib/member-access": { memberAccessResponse: async () => authenticated ? null : Response.json({ error: "AUTH_REQUIRED" }, { status: 401 }) },
  "@/lib/member-identity": { currentMember: async () => ({ userId: "member", authorName: "Member", email: "member@example.test" }), currentUserId: async () => "member" },
  "@/lib/message-recipient": { resolveMessageRecipient: async () => { throw new Error("Admin recipient must be chosen server-side"); } },
  "@/lib/request-target-link": { requestTargetLink: () => "" },
};
const cache = new Map();
async function load(name, reference) {
  const id = name.startsWith(".") ? "@/" + path.posix.normalize(path.posix.join(path.posix.dirname(reference.identifier.slice(2)), name)) : name;
  if (cache.has(id)) return cache.get(id);
  const namespace = fixtures[id] || (!id.startsWith("@/") ? await import(id) : null);
  const vmModule = namespace ? new SyntheticModule(Object.keys(namespace), function () {
    for (const [key, value] of Object.entries(namespace)) this.setExport(key, value);
  }, { context, identifier: id }) : new SourceTextModule(ts.transpileModule(readFileSync(id.slice(2) + ".ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText, { context, identifier: id });
  cache.set(id, vmModule);
  return vmModule;
}
async function route(name) {
  const vmModule = await load(`@/app/api/${name}/route`);
  if (vmModule.status === "unlinked") await vmModule.link(load);
  if (vmModule.status === "linked") await vmModule.evaluate();
  return vmModule.namespace;
}
async function submit(attachmentKey = "", content = "Help", expected = 201) {
  const response = await (await route("requests")).POST(new Request("https://app.test/api/requests", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      requestType: "admin-help", targetType: "website", targetId: "/noi-that", subject: "Contact admin", content,
      attachmentKey, recipientUserId: "attacker", channels: ["messenger"],
    }),
  }));
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
try {
  for (const [name, type, bytes] of [["document.pdf", "application/pdf", "%PDF-fixture"], ["photo.webp", "image/webp", readFileSync(new URL('./fixtures/upload.webp', import.meta.url))]]) {
    const form = new FormData();
    form.set("file", new File([bytes], name, { type }));
    const response = await (await route("files")).POST(new Request("https://app.test/api/files", { method: "POST", body: form }));
    assert.equal(response.status, 201);
    const { attachment } = await response.json();
    calls.length = 0;
    const result = await submit(attachment.key, "");
    assert.equal(result.delivery.internal.status, "sent");
    assert.equal(result.delivery.telegram.status, "sent");
    assert.equal(result.request.recipientUserId, "admin");
    assert.deepEqual(JSON.parse(result.request.channels), ["internal", "telegram"]);
    assert.equal(calls.length, 2);
    const message = JSON.parse(calls[0].body);
    assert.equal(message.chat_id, "admin-chat");
    assert.ok(message.text.includes(`https://app.test/api/files?key=${attachment.key}&download=1`));
    const document = calls[1].body;
    assert.equal(document.get("chat_id"), "admin-chat");
    assert.equal(document.get("document").name, name);
    assert.equal(document.get("document").type, type);
    assert.deepEqual(Buffer.from(await document.get("document").arrayBuffer()), Buffer.from(bytes));
    assert.ok(document.get("caption").includes(`#${result.request.id}`));
    assert.equal(sqlite.prepare("SELECT attachment_key FROM direct_messages WHERE request_id=?").get(result.request.id).attachment_key, attachment.key);
  }
  const key = objects.keys().next().value, object = objects.get(key);
  calls.length = 0;
  await submit("", "Text only");
  assert.equal(calls.length, 1);
  await submit("", "", 400);
  await submit(webcrypto.randomUUID(), "Help", 400);
  object.customMetadata.ownerUserId = "other";
  await submit(key, "Help", 403);
  object.customMetadata.ownerUserId = "member";
  object.customMetadata.accessType = "private";
  await submit(key, "Help", 403);
  object.customMetadata.accessType = "public";
  const originalSize = object.size;
  object.size = 25 * 1024 * 1024 + 1;
  await submit(key, "Help", 413);
  object.size = originalSize;
  authenticated = false;
  await submit(key, "Help", 401);
  authenticated = true;
  for (const failure of ["http", "rejected", "network"]) {
    documentFailure = failure;
    const result = await submit(key);
    assert.equal(result.delivery.telegram.status, "failed");
    assert.equal(result.delivery.internal.status, "sent");
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM direct_messages WHERE request_id=?").get(result.request.id).n, 1);
    assert.equal(JSON.parse(sqlite.prepare("SELECT delivery_status FROM user_requests WHERE id=?").get(result.request.id).delivery_status).telegram.status, "failed");
  }
  documentFailure = "";
  messageFailure = true;
  calls.length = 0;
  assert.equal((await submit(key)).delivery.telegram.status, "failed");
  assert.equal(calls.length, 1, "Do not send an attachment when the accompanying message fails");
  messageFailure = false;
  env.TELEGRAM_BOT_TOKEN = "";
  calls.length = 0;
  assert.equal((await submit(key)).delivery.telegram.status, "unavailable");
  assert.equal(calls.length, 0);
  console.log("PASS: actual uploads and admin requests, image/document bytes, attachment-only messages, forced admin routing, ownership/access/size/auth validation, text-only requests and durable inbox on Telegram failures.");
} finally { sqlite.close(); }
