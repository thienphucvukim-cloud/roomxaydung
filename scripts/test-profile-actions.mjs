// node --experimental-strip-types --experimental-vm-modules scripts/test-profile-actions.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";
import { memberAvatarUrl } from "../lib/member-avatar.ts";

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
const db = drizzle(async (sql, params, method) => {
  const statement = sqlite.prepare(sql);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
let userId = "viewer-a";
const context = createContext({ Request, Response, URL, console });
const namespaces = {
  "../../../db": { getDb: () => db },
  "../../../db/schema": schema,
  "../../../lib/member-identity": { currentUserId: async () => userId },
  "@/lib/payment-identity": { getPaymentBuyerId: async () => userId },
  "@/lib/member-access": { memberAccessResponse: async () => null },
  "@/lib/member-avatar": { memberAvatarUrl },
};
const route = new SourceTextModule(ts.transpileModule(readFileSync("app/api/actions/route.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText, { context });
await route.link(async name => {
  const namespace = namespaces[name] || await import(name);
  return new SyntheticModule(Object.keys(namespace), function () {
    for (const [key, value] of Object.entries(namespace)) this.setExport(key, value);
  }, { context });
});
await route.evaluate();
const get = async query => {
  const response = await route.namespace.GET(new Request(`https://app.test/api/actions${query}`));
  assert.equal(response.status, 200);
  return { response, data: await response.json() };
};
try {
  sqlite.prepare("INSERT INTO member_profiles (user_id, display_name, email, avatar_key) VALUES (?, ?, ?, ?)").run("member-real", "Nguyễn Minh Anh", "private@example.test", "custom-avatar");
  sqlite.prepare("INSERT INTO member_profiles (user_id, display_name, email) VALUES (?, ?, ?)").run("unrelated-member", "Unrelated", "hidden@example.test");
  const add = sqlite.prepare("INSERT INTO user_actions (user_id, action_type, target_type, target_id, created_at) VALUES (?, ?, ?, ?, '2026-10-02')");
  add.run("viewer-a", "follow", "profile", "member-real");
  add.run("viewer-a", "friend", "profile", "member-real");
  add.run("viewer-a", "follow", "profile", "virtual-member-001");
  add.run("viewer-a", "follow", "profile", "deleted-member");
  add.run("viewer-a", "save", "house-model", "Mẫu nhà");
  add.run("viewer-b", "friend", "profile", "unrelated-member");
  const normal = (await get("")).data;
  assert.equal(normal.actions.length, 5);
  assert.equal(normal.members, undefined, "Existing callers retain their response shape");
  const { data, response } = await get("?withProfiles=true");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(data.actions.length, 5);
  assert.equal(data.members.length, 2, "Duplicate connections, deleted profiles and unrelated members do not add results");
  assert.deepEqual(data.members.find(member => member.id === "member-real"), { id: "member-real", name: "Nguyễn Minh Anh", avatarUrl: "/api/files?key=custom-avatar" });
  assert.equal(data.members.find(member => member.id === "virtual-member-001").name, "Nguyễn Minh Anh");
  for (const member of data.members) assert.deepEqual(Object.keys(member).sort(), ["avatarUrl", "id", "name"], "Only public profile fields are returned");
  const filtered = (await get("?withProfiles=true&actionType=save")).data;
  assert.equal(filtered.actions.length, 1);
  assert.deepEqual(filtered.members, []);
  userId = "viewer-b";
  assert.deepEqual((await get("?withProfiles=true")).data.members.map(member => member.id), ["unrelated-member"]);
  userId = null;
  assert.deepEqual((await get("?withProfiles=true")).data, { actions: [], members: [] });
  userId = "viewer-a";
  sqlite.exec("DROP TABLE virtual_profiles");
  assert.deepEqual((await get("?withProfiles=true")).data.members.map(member => member.id), ["member-real"], "Older databases retain real member results");
  console.log("PASS: connection names/avatars, deduplication, public fields, account isolation, filters, anonymous requests, cache headers and virtual-profile fallback.");
} finally { sqlite.close(); }
