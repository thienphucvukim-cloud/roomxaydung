// node --experimental-vm-modules scripts/test-account-switching.mjs
// Real session creation and account routes against an isolated SQLite database.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = ON");
for (const name of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${name}`, "utf8"));
function prepare(sql, args = []) {
  return { bind: (...values) => prepare(sql, values), first: async () => sqlite.prepare(sql).get(...args) || null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }) };
}
const env = { TIPOOK_ADMIN_EMAIL: "owner@example.test", DB: { prepare, batch: async statements => {
  sqlite.exec("BEGIN");
  try { const result = await Promise.all(statements.map(statement => statement.all())); sqlite.exec("COMMIT"); return result; }
  catch (error) { sqlite.exec("ROLLBACK"); throw error; }
} } };
const db = drizzle(async (sql, params, method) => {
  const statement = sqlite.prepare(sql);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
let cookieJar = {};
const base = "https://tipook.example.test";
const context = createContext({ Buffer, URL, URLSearchParams, Request, Response, Headers, crypto, TextEncoder, console });
const modules = new Map();
async function load(specifier) {
  if (modules.has(specifier)) return modules.get(specifier);
  let namespace;
  if (specifier === "cloudflare:workers") namespace = { env, waitUntil: () => {} };
  else if (specifier === "next/headers") namespace = { cookies: async () => ({ get: name => cookieJar[name] ? { value: cookieJar[name] } : undefined }), headers: async () => new Headers() };
  else if (specifier === "@/db") namespace = { getDb: () => db };
  else if (specifier === "@/db/schema") namespace = schema;
  else if (!specifier.startsWith("@/")) namespace = await import(specifier);
  let vmModule;
  if (namespace) vmModule = new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context });
  else {
    const file = specifier.slice(2) + ".ts";
    const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    vmModule = new SourceTextModule(source, { context, identifier: file });
  }
  modules.set(specifier, vmModule);
  return vmModule;
}
const root = new SourceTextModule(`export { createWebsiteSession } from '@/lib/auth-sessions';
  export { GET, POST } from '@/app/api/auth/accounts/route';
  export { POST as authPost } from '@/app/api/auth/[action]/route';
  export { getAuthenticatedIdentity } from '@/lib/website-auth';`, { context });
await root.link(load);
await root.evaluate();
const { createWebsiteSession, GET, POST, authPost, getAuthenticatedIdentity } = root.namespace;
const digest = value => createHash("sha256").update(value).digest("hex");
function applyCookies(response) {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(";");
    const split = pair.indexOf("=");
    const name = pair.slice(0, split), value = pair.slice(split + 1);
    if (header.includes("Max-Age=0;")) delete cookieJar[name];
    else cookieJar[name] = value;
  }
}
function account(id, isOwner = false) {
  const value = { userId: id, email: `${id}@example.test`, displayName: id, passwordHash: "fixture-password", isOwner };
  sqlite.prepare("INSERT INTO website_accounts (user_id, email, display_name, password_hash, is_owner, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, value.email, id, value.passwordHash, Number(isOwner), "2026-01-01");
  return value;
}
async function login(value, verified = false, credential = null) {
  const response = await createWebsiteSession(new Request(base + "/api/auth/login"), value, "/tai-khoan", verified, credential);
  applyCookies(response);
  return cookieJar.tipook_auth_session;
}
async function list() { return (await (await GET()).json()).accounts; }
async function act(action, userId, headers = {}, returnTo = "/tai-khoan") {
  const response = await POST(new Request(base + "/api/auth/accounts", { method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...headers }, body: JSON.stringify({ action, userId, returnTo }) }));
  applyCookies(response);
  return response;
}
const first = account("first"), second = account("second");
const firstToken = await login(first);
await login(second);
assert.equal((await list()).length, 2);
assert.ok(sqlite.prepare("SELECT 1 FROM website_sessions WHERE token_hash = ?").get(digest(firstToken)), "Adding an account preserves the previous session");
assert.equal((await act("switch", "first")).status, 200);
assert.equal((await getAuthenticatedIdentity()).userId, "first");
assert.equal((await list()).find(value => value.active).userId, "first");
const failedLogin = await authPost(new Request(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ login: second.email, password: "incorrect-password" }) }), { params: Promise.resolve({ action: "login" }) });
assert.equal(failedLogin.status, 401);
assert.equal(failedLogin.headers.getSetCookie().length, 0);
assert.equal((await getAuthenticatedIdentity()).userId, "first", "A failed extra login must preserve the active account");
assert.equal((await list()).length, 2);
assert.ok(!(await (await GET()).text()).includes(firstToken), "Session tokens never reach the client JSON");
assert.equal((await act("switch", "second", { Origin: "https://attacker.test" })).status, 403);
assert.equal((await act("switch", "unknown")).status, 401);
assert.equal((await act("remove", "first")).status, 400);
const oldSecondToken = cookieJar.tipook_saved_accounts.split(".").find(token => token !== firstToken);
await login(second);
assert.equal((await list()).length, 2, "Logging in again deduplicates the same account");
assert.ok(!sqlite.prepare("SELECT 1 FROM website_sessions WHERE token_hash = ?").get(digest(oldSecondToken)), "Superseded sessions are revoked");
assert.equal((await act("remove", "first")).status, 200);
assert.ok(!sqlite.prepare("SELECT 1 FROM website_sessions WHERE token_hash = ?").get(digest(firstToken)));
assert.equal((await list()).length, 1);

for (let index = 0; index < 5; index++) await login(account(`extra${index}`));
assert.equal((await list()).length, 5);
assert.equal(sqlite.prepare("SELECT count(*) AS count FROM website_sessions").get().count, 5, "Evicted browser sessions are revoked");
sqlite.prepare("UPDATE website_sessions SET expires_at = 0 WHERE user_id = 'extra0'").run();
assert.equal((await act("switch", "extra0")).status, 401);
sqlite.prepare("UPDATE member_profiles SET account_status = 'disabled' WHERE user_id = 'extra1'").run();
assert.equal((await act("switch", "extra1")).status, 401);
sqlite.prepare("UPDATE member_profiles SET account_status = 'deleted' WHERE user_id = 'extra2'").run();
assert.equal((await act("switch", "extra2")).status, 401);

const owner = account("owner", true);
await assert.rejects(() => login(owner), /xác nhận/);
sqlite.prepare("INSERT INTO admin_totp_credentials (user_id, secret_encrypted, created_at) VALUES (?, ?, ?)").run("owner", "fixture-credential", "2026-01-01");
await login(owner, true, "fixture-credential");
assert.equal((await act("switch", "extra3", {}, "//attacker.test")).status, 200);
assert.equal((await getAuthenticatedIdentity()).isOwner, false);
const switchOwner = await act("switch", "owner");
assert.equal((await switchOwner.json()).redirectTo, "/tai-khoan");
assert.equal((await getAuthenticatedIdentity()).isOwner, true);
sqlite.prepare("UPDATE website_sessions SET owner_verified = 0 WHERE user_id = 'owner'").run();
assert.equal((await act("switch", "owner")).status, 401, "Unverified owner sessions cannot be selected");
await act("switch", "extra3");
const logout = await authPost(new Request(base + "/api/auth/logout", { method: "POST", headers: { Origin: base } }), { params: Promise.resolve({ action: "logout" }) });
assert.equal(logout.status, 303);
applyCookies(logout);
assert.equal(await getAuthenticatedIdentity(), null);
assert.ok((await list()).some(value => value.userId === "extra4"), "Logout retains other saved accounts");
assert.ok(!(await list()).some(value => value.userId === "extra3"));
assert.equal((await act("switch", "extra4")).status, 200, "A saved account remains selectable after logout");
assert.equal((await getAuthenticatedIdentity()).userId, "extra4");
for (const header of switchOwner.headers.getSetCookie()) {
  assert.ok(header.includes("HttpOnly") && header.includes("SameSite=Lax") && header.includes("Secure"));
}
sqlite.close();
console.log("PASS: add, switch, deduplicate, revoke, five-account limit, expiry, moderation, owner verification, origin checks, logout and private cookies.");
