// Isolated avatar route tests. No real storage, accounts, or Google requests.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";
import { avatarInitial, memberAvatarUrl } from "../lib/member-avatar.ts";
import * as imagePolicy from "../lib/image-upload-policy.ts";

assert.equal(avatarInitial("  Nguyễn Văn An"), "N");
assert.equal(avatarInitial("đức"), "Đ");
assert.equal(avatarInitial("e\u0301"), "É");
assert.equal(avatarInitial(""), "?");
assert.equal(memberAvatarUrl(), null);
assert.equal(memberAvatarUrl({ googleAvatarUrl: "https://google.test/avatar" }), "https://google.test/avatar");
assert.equal(memberAvatarUrl({ avatarKey: "custom", googleAvatarUrl: "https://google.test/avatar" }), "/api/files?key=custom");

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
const db = drizzle(async (sql, params, method) => {
  const query = sqlite.prepare(sql);
  if (method === "run") return { rows: [], ...query.run(...params) };
  query.setReturnArrays(true);
  return { rows: method === "get" ? query.get(...params) : query.all(...params) };
});
let identity = { userId: "member-a", displayName: "An", email: "an@example.test" };
const objects = new Map();
const env = { BUCKET: {
  put: async (key, stream, metadata) => objects.set(key, { bytes: await new Response(stream).arrayBuffer(), ...metadata }),
  delete: async key => objects.delete(key),
} };
const context = createContext({ Request, Response, Headers, File, FormData, URL, crypto, console });
const namespaces = {
  "cloudflare:workers": { env }, "@/db": { getDb: () => db }, "@/db/schema": schema,
  "@/lib/website-auth": { getAuthenticatedIdentity: async () => identity, validOrigin: request => request.headers.get("origin") !== "https://attacker.test" },
  "@/lib/member-avatar": { memberAvatarUrl },
  "@/lib/image-upload-policy": imagePolicy,
};
const route = new SourceTextModule(ts.transpileModule(readFileSync("app/api/avatar/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context });
await route.link(async name => {
  const namespace = namespaces[name] || await import(name);
  return new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context });
});
await route.evaluate();
const { POST, DELETE } = route.namespace;
const origin = "https://app.test/api/avatar";
const upload = (file, headers = {}) => {
  const body = new FormData();
  if (file) body.append("file", file);
  return POST(new Request(origin, { method: "POST", body, headers }));
};
const image = new File([readFileSync("scripts/fixtures/upload.webp")], "avatar.webp", { type: "image/webp" });
try {
  identity = null;
  assert.equal((await upload(image)).status, 401);
  assert.equal((await DELETE(new Request(origin, { method: "DELETE" }))).status, 401);
  identity = { userId: "member-a", displayName: "An", email: "an@example.test" };
  assert.equal((await upload(image, { origin: "https://attacker.test" })).status, 403);
  assert.equal((await upload(new File(["<svg/>"], "avatar.svg", { type: "image/svg+xml" }))).status, 415);
  assert.equal((await upload(new File([], "avatar.webp", { type: "image/webp" }))).status, 413);
  assert.equal((await upload(new File(["invalid"], "fake.webp", { type: "image/webp" }))).status, 400);
  assert.equal((await upload(new File([new Uint8Array(96 * 1024 + 1)], "large.webp", { type: "image/webp" }))).status, 413);
  assert.equal(objects.size, 0);
  sqlite.prepare("INSERT INTO member_profiles (user_id, display_name, google_avatar_url, updated_at) VALUES (?, ?, ?, ?)").run("member-b", "Bình", "https://google.test/b", "now");
  const saved = await upload(image);
  assert.equal(saved.status, 200);
  const first = await saved.json();
  assert.equal(first.hasCustomAvatar, true);
  const key = sqlite.prepare("SELECT avatar_key FROM member_profiles WHERE user_id='member-a'").get().avatar_key;
  assert.equal(first.avatarUrl, `/api/files?key=${key}`);
  assert.equal(objects.get(key).customMetadata.ownerUserId, "member-a");
  assert.equal(sqlite.prepare("SELECT avatar_key FROM member_profiles WHERE user_id='member-b'").get().avatar_key, null);
  identity = { userId: "member-b", displayName: "Bình", email: null };
  assert.equal((await upload(image)).status, 200);
  const reset = await DELETE(new Request(origin, { method: "DELETE" }));
  assert.deepEqual(await reset.json(), { avatarUrl: "https://google.test/b", hasCustomAvatar: false });
  assert.equal(sqlite.prepare("SELECT avatar_key FROM member_profiles WHERE user_id='member-a'").get().avatar_key, key);
  identity = { userId: "member-a", displayName: "An", email: "an@example.test" };
  assert.deepEqual(await (await DELETE(new Request(origin, { method: "DELETE" }))).json(), { avatarUrl: null, hasCustomAvatar: false });
  sqlite.exec("CREATE TRIGGER fail_avatar BEFORE UPDATE OF avatar_key ON member_profiles BEGIN SELECT RAISE(FAIL, 'fixture'); END");
  const before = objects.size;
  assert.equal((await upload(image)).status, 500);
  assert.equal(objects.size, before, "Failed profile write must remove the new upload");
  console.log("PASS: avatar initials, fallback priority, migrations, authenticated upload, validation, account isolation, reset and failed-save cleanup.");
} finally { sqlite.close(); }
