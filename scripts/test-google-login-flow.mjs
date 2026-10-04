// Run with node --experimental-vm-modules scripts/test-google-login-flow.mjs.
// Execute the real OAuth/session modules against an isolated SQLite database,
// with only Google HTTP responses and platform bindings replaced by fixtures.
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
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
    run: async () => sqlite.prepare(sql).run(...args), all: async () => ({ results: sqlite.prepare(sql).all(...args) }) };
}
const env = { GOOGLE_CLIENT_ID: "fixture.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "fixture-secret", TIPOOK_ADMIN_EMAIL: "owner@example.test",
  DB: { prepare, batch: async statements => { sqlite.exec("BEGIN"); try { const result = await Promise.all(statements.map(statement => statement.all())); sqlite.exec("COMMIT"); return result; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } } } };
const db = drizzle(async (sql, params, method) => {
  const statement = sqlite.prepare(sql);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const signingKey = { ...publicKey.export({ format: "jwk" }), kid: "fixture", alg: "RS256", use: "sig" };
let cookieJar = {}, pendingAuthorization, loginClaims = {}, tamper = false, exchanges = 0;
const base = "http://localhost:5173";
const digest = value => createHash("sha256").update(value).digest("hex");
async function googleFetch(url, options) {
  if (url === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [signingKey] });
  assert.equal(url, "https://oauth2.googleapis.com/token");
  const body = options.body;
  assert.equal(body.get("redirect_uri"), base + "/api/auth/google/callback");
  assert.equal(body.get("client_id"), env.GOOGLE_CLIENT_ID);
  assert.equal(body.get("client_secret"), env.GOOGLE_CLIENT_SECRET);
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(createHash("sha256").update(body.get("code_verifier")).digest("base64url"), pendingAuthorization.searchParams.get("code_challenge"));
  exchanges++;
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "fixture" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: "https://accounts.google.com", aud: env.GOOGLE_CLIENT_ID, sub: "fixture-member", email: "google@example.test", email_verified: true,
    name: "Google Member", picture: "https://lh3.googleusercontent.com/first-avatar", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, nonce: pendingAuthorization.searchParams.get("nonce"), ...loginClaims })).toString("base64url");
  const data = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
  return Response.json({ id_token: `${data}.${tamper ? signature.replace(/^./, signature.startsWith("A") ? "B" : "A") : signature}` });
}
const context = createContext({ Buffer, URL, URLSearchParams, Request, Response, Headers, crypto, TextEncoder, AbortSignal, console, fetch: googleFetch });
const moduleCache = new Map();
async function load(specifier) {
  if (moduleCache.has(specifier)) return moduleCache.get(specifier);
  let namespace;
  if (specifier === "cloudflare:workers") namespace = { env };
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
  moduleCache.set(specifier, vmModule);
  return vmModule;
}
const root = await load("@/lib/google-auth");
await root.link(load);
await root.evaluate();
const { beginGoogleLogin, completeGoogleLogin } = root.namespace;
function hasSession(response) { return response.headers.getSetCookie().some(value => value.startsWith("tipook_auth_session=")); }
async function start(returnTo = "/tai-khoan") {
  const response = await beginGoogleLogin(new Request(base + "/api/auth/google?return_to=" + encodeURIComponent(returnTo)));
  assert.equal(response.status, 303);
  pendingAuthorization = new URL(response.headers.get("Location"));
  assert.equal(pendingAuthorization.origin, "https://accounts.google.com");
  const cookie = response.headers.getSetCookie().find(value => value.startsWith("tipook_google_login="));
  assert.ok(cookie.includes("HttpOnly") && cookie.includes("SameSite=Lax"));
  cookieJar = { tipook_google_login: cookie.split(";")[0].split("=")[1] };
  return pendingAuthorization.searchParams.get("state");
}
async function complete(state, query = "&code=fixture-code") {
  return completeGoogleLogin(new Request(base + "/api/auth/google/callback?state=" + state + query));
}

const state = await start("//attacker.test");
const browser = cookieJar.tipook_google_login;
cookieJar = { tipook_google_login: "0".repeat(64) };
assert.equal(hasSession(await complete(state)), false);
assert.equal(exchanges, 0, "Wrong browser must not contact Google or consume the legitimate request");
cookieJar = { tipook_google_login: browser };
const success = await complete(state);
assert.equal(success.headers.get("Location"), "/tai-khoan");
assert.equal(hasSession(success), true);
const member = sqlite.prepare("SELECT * FROM website_accounts WHERE google_sub = 'fixture-member'").get();
assert.equal(member.email, "google@example.test");
assert.equal(member.is_owner, 0);
assert.ok(member.password_hash.startsWith("google-only:"));
assert.equal(sqlite.prepare("SELECT google_avatar_url FROM member_profiles WHERE user_id = ?").get(member.user_id).google_avatar_url, "https://lh3.googleusercontent.com/first-avatar");
sqlite.prepare("UPDATE member_profiles SET avatar_key = ? WHERE user_id = ?").run("custom-avatar", member.user_id);
assert.equal(sqlite.prepare("SELECT count(*) AS count FROM website_sessions WHERE user_id = ?").get(member.user_id).count, 1);
assert.equal(hasSession(await complete(state)), false);
assert.equal(exchanges, 1, "A callback cannot be replayed");
loginClaims = { picture: "https://lh3.googleusercontent.com/updated-avatar" };
const repeated = await complete(await start("/tai-khoan?tab=profile"));
assert.equal(repeated.headers.get("Location"), "/tai-khoan?tab=profile");
assert.equal(hasSession(repeated), true);
assert.equal(sqlite.prepare("SELECT count(*) AS count FROM website_accounts WHERE google_sub = 'fixture-member'").get().count, 1);
const avatar = sqlite.prepare("SELECT avatar_key, google_avatar_url FROM member_profiles WHERE user_id = ?").get(member.user_id);
assert.equal(avatar.avatar_key, "custom-avatar", "Google login must preserve the user's custom avatar");
assert.equal(avatar.google_avatar_url, "https://lh3.googleusercontent.com/updated-avatar");

// Google leaves the website for consent, but the callback must still land on
// the exact post/model with the original catalog filters and hash intact.
loginClaims = {};
for (const returnTo of [
  "/bai-viet/2#post-2",
  "/file-ban-ve-nha-dep-chat?q=Nh%C3%A0&sort=views&postId=2#post-2",
  "/noi-that?q=B%E1%BA%BFp&sort=downloads&postId=3#post-3",
  "/kho-mau-nha-dep-chat?q=Nh%C3%A0&sort=views#model-Nh%C3%A0",
]) {
  sqlite.prepare("DELETE FROM auth_rate_limits").run();
  const result = await complete(await start(returnTo));
  assert.equal(hasSession(result), true);
  assert.equal(result.headers.get("Location"), returnTo, "Google callback must preserve exact action return URL");
}
sqlite.prepare("DELETE FROM auth_rate_limits").run();

const expired = await start();
sqlite.prepare("UPDATE auth_google_requests SET expires_at = 0 WHERE state_hash = ?").run(digest(expired));
const countBefore = exchanges;
assert.equal(hasSession(await complete(expired)), false);
assert.equal(exchanges, countBefore);
const denied = await start();
assert.equal(hasSession(await complete(denied, "&error=access_denied")), false);
assert.equal(sqlite.prepare("SELECT count(*) AS count FROM auth_google_requests WHERE state_hash = ?").get(digest(denied)).count, 0);
assert.equal(exchanges, countBefore);

for (const claims of [{ aud: "attacker-client", sub: "bad-audience" }, { nonce: "attacker-nonce", sub: "bad-nonce" }, { email_verified: false, sub: "unverified" }, { email: env.TIPOOK_ADMIN_EMAIL, sub: "reserved-owner" }]) {
  loginClaims = claims;
  assert.equal(hasSession(await complete(await start())), false);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM website_accounts WHERE google_sub = ?").get(claims.sub).count, 0);
}
loginClaims = { sub: "tampered" };
tamper = true;
assert.equal(hasSession(await complete(await start())), false);
tamper = false;
sqlite.prepare("INSERT INTO website_accounts (user_id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run("local-member", "existing@example.test", "Local Member", "existing-password", "2026-01-01");
loginClaims = { sub: "email-collision", email: "existing@example.test" };
const collision = await complete(await start());
assert.equal(hasSession(collision), false);
assert.ok(new URL(collision.headers.get("Location"), base).searchParams.get("auth_error").includes("đã có tài khoản"));
assert.equal(sqlite.prepare("SELECT google_sub FROM website_accounts WHERE user_id = 'local-member'").get().google_sub, null);
loginClaims = {};
for (const status of ["disabled", "deleted"]) {
  sqlite.prepare("UPDATE member_profiles SET account_status = ? WHERE user_id = ?").run(status, member.user_id);
  const blocked = await complete(await start());
  assert.equal(hasSession(blocked), false, `Google must reject ${status} members`);
  assert.ok(new URL(blocked.headers.get("Location"), base).searchParams.get("auth_error").includes(status === "disabled" ? "vô hiệu hóa" : "đã bị xóa"));
}
sqlite.prepare("UPDATE member_profiles SET account_status = 'active' WHERE user_id = ?").run(member.user_id);
sqlite.prepare("UPDATE website_accounts SET is_owner = 1 WHERE user_id = ?").run(member.user_id);
loginClaims = {};
assert.equal(hasSession(await complete(await start())), false, "Google must never bypass owner TOTP");
env.GOOGLE_CLIENT_SECRET = "";
const unconfigured = await beginGoogleLogin(new Request(base + "/api/auth/google"));
assert.ok(new URL(unconfigured.headers.get("Location"), base).searchParams.get("auth_error").includes("chưa được cấu hình"));
sqlite.close();
console.log("PASS: complete Google login, exact post/catalog return URLs, stable account IDs, PKCE exchange, browser binding, expiry, replay, cancellation, token rejection, email collision and owner TOTP protection.");
