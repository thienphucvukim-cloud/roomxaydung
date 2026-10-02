// node --experimental-vm-modules scripts/test-admin-member-password-reset.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import * as nodeCrypto from "node:crypto";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
let failAudit = false;
let beforeBatch = null;
const database = {
  prepare(sql) {
    let params = [];
    const statement = {
      bind(...values) { params = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...params) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...params) }; },
      run() {
        if (failAudit && sql.startsWith("INSERT INTO admin_member_password_resets")) throw new Error("Simulated audit failure");
        const prepared = sqlite.prepare(sql);
        return { results: prepared.columns().length ? prepared.all(...params) : (prepared.run(...params), []) };
      },
    };
    return statement;
  },
  async batch(statements) {
    if (beforeBatch) { beforeBatch(); beforeBatch = null; }
    sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
let admin = { userId: "admin" };
let limited = false;
class AuthFlowError extends Error { constructor(message, status) { super(message); this.status = status; } }
const bindings = { DB: database, TIPOOK_ADMIN_EMAIL: "reserved@example.com", TIPOOK_ADMIN_USER_ID: "reserved-id" };
const context = createContext({ URL, Response, Request, Buffer, Date, console });
function source(path) {
  return new SourceTextModule(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context });
}
function synthetic(namespace) {
  return new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context });
}
const passwords = source("lib/password.ts");
await passwords.link(() => synthetic(nodeCrypto));
await passwords.evaluate();
const { hashPassword, verifyPassword } = passwords.namespace;
const originalHash = await hashPassword("Old-member-password");
const operatorHash = await hashPassword("Admin-password-123");
for (const [id, email, owner] of [["admin", "admin@example.com", 1], ["member", null, 0], ["other", "other@example.com", 0], ["owner", "owner@example.com", 1], ["reserved", "reserved@example.com", 0], ["reserved-id", null, 0]]) {
  sqlite.prepare("INSERT INTO website_accounts (user_id, email, username, display_name, password_hash, is_owner, created_at) VALUES (?, ?, ?, ?, ?, ?, '2026-10-02')").run(id, email, id, id, id === "admin" ? operatorHash : originalHash, owner);
}
function seedSessions(id) {
  sqlite.prepare("INSERT OR REPLACE INTO website_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(`session-${id}`, id, Date.now() + 600000);
  sqlite.prepare("INSERT OR REPLACE INTO auth_email_challenges (id, user_id, purpose, browser_hash, code_hash, password_version, redirect_to, expires_at, created_at) VALUES (?, ?, 'reset', 'browser', 'code', 'old', '/', ?, ?)").run(`challenge-${id}`, id, Date.now() + 600000, Date.now());
}
seedSessions("member"); seedSessions("other"); seedSessions("admin");
sqlite.prepare("INSERT INTO auth_password_reset_requests (id, email, browser_hash, created_at, expires_at) VALUES ('pending', 'other@example.com', 'browser', ?, ?)").run(Date.now(), Date.now() + 600000);
const route = source("app/api/admin/member-password/route.ts");
await route.link(specifier => {
  if (specifier === "@/lib/password") return passwords;
  const namespaces = {
    "node:crypto": nodeCrypto,
    "cloudflare:workers": { env: bindings },
    "@/lib/admin-auth": { requireAdmin: async () => admin },
    "@/lib/auth-security": { AuthFlowError, limitAuthAttempts: async () => { if (limited) throw new AuthFlowError("Too many attempts", 429); } },
    "@/lib/website-auth": { validOrigin: request => request.headers.get("origin") === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site" },
  };
  if (!namespaces[specifier]) throw new Error(`Unexpected import: ${specifier}`);
  return synthetic(namespaces[specifier]);
});
await route.evaluate();
const { POST, GET } = route.namespace;
const body = { userId: "member", verified: true, verificationNote: "Called established contact; ticket 123", newPassword: "Abc123", adminPassword: "Admin-password-123" };
const post = (payload = body, origin = "http://localhost") => POST(new Request("http://localhost/api/admin/member-password", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(payload) }));
const get = userId => GET(new Request(`http://localhost/api/admin/member-password?userId=${userId}`));
const hash = id => sqlite.prepare("SELECT password_hash AS hash FROM website_accounts WHERE user_id = ?").get(id).hash;
const count = table => sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
for (const status of [401, 403]) {
  admin = { error: Response.json({ error: "Forbidden" }, { status }) };
  assert.equal((await post()).status, status); assert.equal((await get("member")).status, status);
}
admin = { userId: "admin" };
assert.equal((await post(body, "http://evil.example")).status, 403);
for (const invalid of [null, { verified: false }, { verified: "true" }, { verificationNote: "short" }, { verificationNote: "x".repeat(501) }, { userId: "" }, { newPassword: "short" }, { newPassword: "x".repeat(129) }, { adminPassword: "" }]) {
  assert.equal((await post(invalid === null ? null : { ...body, ...invalid })).status, 400);
}
assert.equal((await POST(new Request("http://localhost/api/admin/member-password", { method: "POST", headers: { origin: "http://localhost" }, body: "{" }))).status, 400);
assert.equal((await post({ ...body, adminPassword: "wrong" })).status, 403);
limited = true; assert.equal((await post()).status, 429); limited = false;
for (const userId of ["admin", "owner", "reserved", "reserved-id"]) assert.equal((await post({ ...body, userId })).status, 403);
assert.equal((await post({ ...body, userId: "missing" })).status, 404);
assert.equal(count("admin_member_password_resets"), 0); assert.equal(hash("member"), originalHash);
sqlite.prepare("INSERT INTO member_profiles (user_id, display_name, updated_at, account_status) VALUES ('member', 'Member', '2026-10-02', 'disabled')").run();
assert.equal((await post()).status, 403);
sqlite.prepare("UPDATE member_profiles SET account_status = 'deleted' WHERE user_id = 'member'").run();
assert.equal((await post()).status, 403);
sqlite.prepare("UPDATE member_profiles SET account_status = 'active' WHERE user_id = 'member'").run();

failAudit = true; assert.equal((await post()).status, 500); failAudit = false;
assert.equal(hash("member"), originalHash); assert.equal(count("website_sessions"), 3); assert.equal(count("auth_email_challenges"), 3);
assert.equal(count("admin_member_password_resets"), 0);

const changedHash = await hashPassword("Concurrent-password-change");
beforeBatch = () => sqlite.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = 'member'").run(changedHash);
assert.equal((await post()).status, 409); assert.equal(hash("member"), changedHash);
assert.equal(count("admin_member_password_resets"), 0); assert.equal(count("website_sessions"), 3);

const success = await post({ ...body, performedBy: "forged-admin", createdAt: "forged-date" });
assert.equal(success.status, 200); assert.deepEqual(await success.json(), { passwordReset: true });
assert.ok(success.headers.get("cache-control").includes("no-store"));
assert.equal(await verifyPassword(body.newPassword, hash("member")), true);
assert.equal(await verifyPassword("Old-member-password", hash("member")), false);
assert.equal(count("website_sessions"), 2); assert.equal(count("auth_email_challenges"), 2);
assert.equal(hash("other"), originalHash); assert.equal(hash("admin"), operatorHash);
const historyResponse = await get("member"); const history = (await historyResponse.json()).history;
assert.equal(history.length, 1); assert.equal(history[0].performedBy, "admin");
assert.equal(history[0].verificationNote, body.verificationNote);
assert.ok(!JSON.stringify(history).includes(body.newPassword)); assert.ok(!JSON.stringify(history).includes(body.adminPassword));
assert.ok(historyResponse.headers.get("cache-control").includes("no-store"));
assert.equal((await get("other")).status, 200);
assert.equal((await post({ ...body, userId: "other" })).status, 200);
assert.equal(count("auth_password_reset_requests"), 0);
assert.equal(count("website_sessions"), 1); assert.equal(count("auth_email_challenges"), 1);
console.log("PASS: admin authorization, verification, password confirmation, protected accounts, hash storage, scoped session/code revocation, audit history, rollback and concurrent password changes.");
sqlite.close();
