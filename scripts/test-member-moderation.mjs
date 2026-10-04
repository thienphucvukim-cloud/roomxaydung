// node --experimental-vm-modules scripts/test-member-moderation.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import path from "node:path";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
for (const name of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${name}`, "utf8"));
let failAudit = false, beforeBatch = null, admin = { userId: "admin" }, cookieJar = {}, headerJar = new Headers();
function prepare(sql, params = []) {
  return { bind: (...values) => prepare(sql, values), first: async () => sqlite.prepare(sql).get(...params) || null,
    all: async () => {
      if (failAudit && sql.startsWith("UPDATE posts")) throw new Error("Simulated failure after audit, status and session writes");
      const statement = sqlite.prepare(sql);
      return { results: statement.columns().length ? statement.all(...params) : (statement.run(...params), []) };
    } };
}
const env = { TIPOOK_ADMIN_EMAIL: "admin@example.test", TIPOOK_ADMIN_USER_ID: "reserved-id", DB: { prepare,
  batch: async statements => {
    if (beforeBatch) { beforeBatch(); beforeBatch = null; }
    sqlite.exec("BEGIN");
    try { const result = []; for (const statement of statements) result.push(await statement.all()); sqlite.exec("COMMIT"); return result; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } } };
const db = drizzle(async (sql, params, method) => {
  const statement = sqlite.prepare(sql);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
const context = createContext({ URL, Request, Response, Headers, Buffer, console, crypto });
const cache = new Map();
async function load(specifier, reference) {
  if (specifier.startsWith(".")) specifier = "@/" + path.posix.normalize(path.posix.join(path.posix.dirname(reference.identifier.slice(2)), specifier));
  if (cache.has(specifier)) return cache.get(specifier);
  let namespace;
  if (specifier === "cloudflare:workers") namespace = { env };
  else if (specifier === "@/lib/admin-auth") namespace = { requireAdmin: async () => admin };
  else if (specifier === "next/headers") namespace = { cookies: async () => ({ get: name => cookieJar[name] ? { value: cookieJar[name] } : undefined }), headers: async () => headerJar };
  else if (specifier === "@/db") namespace = { getDb: () => db };
  else if (specifier === "@/db/schema") namespace = schema;
  else if (!specifier.startsWith("@/")) namespace = await import(specifier);
  const vmModule = namespace ? new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context })
    : new SourceTextModule(ts.transpileModule(readFileSync(specifier.slice(2) + (specifier.endsWith(".ts") ? "" : ".ts"), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context, identifier: specifier });
  cache.set(specifier, vmModule);
  return vmModule;
}
async function evaluated(specifier) {
  const vmModule = await load(specifier);
  if (vmModule.status === "unlinked") await vmModule.link(load);
  if (vmModule.status !== "evaluated") await vmModule.evaluate();
  return vmModule.namespace;
}
const { POST } = await evaluated("@/app/api/admin/member-moderation/route");
const { GET } = await evaluated("@/app/api/admin/manage/[resource]/route");
const { assertActiveMember } = await evaluated("@/lib/member-account-status");
const { getAuthenticatedIdentity } = await evaluated("@/lib/website-auth");
const { createWebsiteSession } = await evaluated("@/lib/auth-sessions");
const { hashToken } = await evaluated("@/lib/password");
for (const [id, email, username, owner] of [["admin", "admin@example.test", null, 1], ["member", "member@example.test", "tranvukim", 0], ["other", null, "other_login", 0], ["owner", "owner@example.test", null, 1], ["reserved-id", null, null, 0], ["reserved-email", "admin@example.test", null, 0]]) {
  if (id !== "reserved-email") sqlite.prepare("INSERT INTO website_accounts (user_id, email, username, display_name, password_hash, is_owner, created_at) VALUES (?, ?, ?, ?, 'hash', ?, '2026-10-02')").run(id, email, username, id, owner);
  sqlite.prepare("INSERT INTO member_profiles (user_id, display_name, email, updated_at) VALUES (?, ?, ?, '2026-10-02')").run(id, id, id === "reserved-email" ? email : null);
}
sqlite.prepare("INSERT INTO member_profiles (user_id, display_name, email, updated_at) VALUES ('sites-member', 'Sites member', 'sites@example.test', '2026-10-02')").run();
sqlite.prepare("INSERT INTO posts (user_id, author_name, category, title, content, audience, created_at) VALUES ('member', 'Member', 'Bản vẽ cộng đồng', 'Drawing', '', 'Công khai', '2026-10-02'), ('other', 'Other', 'Bộ sưu tập ảnh', 'Other', '', 'Công khai', '2026-10-02')").run();
const list = async filter => (await GET(new Request(`http://localhost/api/admin/manage/members?filter=${filter || ""}`), { params: Promise.resolve({ resource: "members" }) })).json();
const members = (await list()).items;
assert.equal(members.find(row => row.userId === "member").username, "tranvukim");
assert.equal(members.find(row => row.userId === "member").email, "member@example.test");
assert.equal(members.find(row => row.userId === "other").username, "other_login");
assert.equal(members.find(row => row.userId === "member").postCount, 1);
assert.equal(members.find(row => row.userId === "sites-member").postCount, 0);
assert.equal(members.find(row => row.userId === "reserved-email").canModerate, 0);
const body = { userId: "member", action: "disable", reason: "Confirmed fraud report #123", version: 0 };
const post = (payload = body, origin = "http://localhost") => POST(new Request("http://localhost/api/admin/member-moderation", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
const profile = id => sqlite.prepare("SELECT * FROM member_profiles WHERE user_id = ?").get(id);
for (const status of [401, 403]) { admin = { error: Response.json({ error: "Forbidden" }, { status }) }; assert.equal((await post()).status, status); }
admin = { userId: "admin" };
assert.equal((await post(body, "http://evil.test")).status, 403);
for (const patch of [null, { reason: "x" }, { reason: "x".repeat(501) }, { action: "purge" }, { action: { toString: "disable" } }, { userId: "guest_123" }, { version: -1 }]) assert.equal((await post(patch === null ? null : { ...body, ...patch })).status, 400);
for (const userId of ["admin", "owner", "reserved-id", "reserved-email"]) assert.equal((await post({ ...body, userId })).status, 403);
assert.equal((await post({ ...body, userId: "missing" })).status, 404);
const token = "a".repeat(64);
sqlite.prepare("INSERT INTO website_sessions (token_hash, user_id, expires_at) VALUES (?, 'member', ?)").run(hashToken(token), Date.now() + 600000);
sqlite.prepare("INSERT INTO auth_email_challenges (id, user_id, purpose, browser_hash, code_hash, password_version, redirect_to, expires_at, created_at) VALUES ('challenge', 'member', 'reset', 'browser', 'code', 'hash', '/', ?, ?)").run(Date.now() + 600000, Date.now());
sqlite.prepare("INSERT INTO auth_password_reset_requests (id, email, browser_hash, created_at, expires_at) VALUES ('pending', 'member@example.test', 'browser', ?, ?)").run(Date.now(), Date.now() + 600000);
cookieJar = { tipook_auth_session: token };
assert.equal((await getAuthenticatedIdentity()).username, "tranvukim");
failAudit = true; assert.equal((await post()).status, 500); failAudit = false;
assert.equal(profile("member").account_status, "active");
assert.equal((await getAuthenticatedIdentity()).userId, "member");
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM admin_member_moderation").get().n, 0);
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_email_challenges").get().n, 1);
assert.equal((await post()).status, 200);
assert.equal(profile("member").account_status, "disabled");
assert.equal(await getAuthenticatedIdentity(), null);
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_email_challenges").get().n, 0);
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_password_reset_requests").get().n, 0);
assert.equal(sqlite.prepare("SELECT audience FROM posts WHERE user_id = 'member'").get().audience, "Ẩn bởi quản trị");
assert.equal(sqlite.prepare("SELECT audience FROM posts WHERE user_id = 'other'").get().audience, "Công khai");
await assert.rejects(() => assertActiveMember("member"), /vô hiệu hóa/);
const account = { userId: "member", email: "member@example.test", displayName: "Member", isOwner: false, passwordHash: "hash" };
await assert.rejects(() => createWebsiteSession(new Request("http://localhost"), account, "/"), /Tài khoản đã thay đổi/);
assert.equal((await post()).status, 409);
assert.equal((await post({ ...body, action: "enable", version: 1 })).status, 200);
await assertActiveMember("member");
assert.equal(sqlite.prepare("SELECT audience FROM posts WHERE user_id = 'member'").get().audience, "Ẩn bởi quản trị");
beforeBatch = () => sqlite.prepare("UPDATE member_profiles SET moderation_version = 3 WHERE user_id = 'member'").run();
assert.equal((await post({ ...body, version: 2 })).status, 409);
assert.equal(profile("member").account_status, "active");
assert.equal((await post({ ...body, action: "delete", version: 3 })).status, 200);
assert.equal(profile("member").account_status, "deleted");
assert.ok(!(await list()).items.some(row => row.userId === "member"));
assert.ok((await list("deleted")).items.some(row => row.userId === "member"));
assert.equal((await post({ ...body, action: "enable", version: 4 })).status, 409);
assert.ok(sqlite.prepare("SELECT user_id FROM website_accounts WHERE user_id = 'member'").get(), "Keep identity reserved and purchase records available for audit");
cookieJar = {};
headerJar = new Headers({ "oai-authenticated-user-id": "sites-member", "oai-authenticated-user-email": "sites@example.test" });
assert.equal((await getAuthenticatedIdentity()).userId, "sites-member");
assert.equal((await post({ ...body, userId: "sites-member" })).status, 200);
assert.equal(await getAuthenticatedIdentity(), null);
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM admin_member_moderation").get().n, 4);
console.log("PASS: exact member usernames/emails/counts; authorization, protected accounts, validation, atomic audit, disable/enable/delete, version races, session/recovery revocation, session issuance guard, Sites access and scoped content hiding.");
sqlite.close();
