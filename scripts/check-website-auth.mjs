import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { clearLocalOwnerCooldown, finishLocalOwnerLogin } from "./test-auth-helpers.mjs";

const origin = process.env.TIPOOK_TEST_ORIGIN || "http://localhost:5173";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Fixtures must stay local.");
const vars = readFileSync(".dev.vars", "utf8");
const setting = key => vars.match(new RegExp(`^${key}[ \\t]*=[ \\t]*["']?([^\\s"']+)`, "m"))?.[1];
const adminEmail = setting("TIPOOK_ADMIN_EMAIL"), adminPassword = setting("TIPOOK_ADMIN_PASSWORD");
assert.ok(adminEmail && adminPassword, "Run scripts/setup-owner.mjs before testing.");
const directory = `${process.env.TIPOOK_LOCAL_STATE_PATH || ".wrangler/state"}/v3/d1/miniflare-D1DatabaseObject`;
const file = readdirSync(directory).find(name => name.endsWith(".sqlite") && name !== "metadata.sqlite");
const db = new DatabaseSync(`${directory}/${file}`);
const fixtureEmail = `test_${crypto.randomUUID()}@example.test`;
const password = "Test-only-password-987";
let userId, adminCookie, memberCookie;
const contentKey = "__test.owner.persistence";
const existing = db.prepare("SELECT * FROM website_content WHERE key=?").get(contentKey);
async function send(path, method = "GET", body, cookie, expected = 200, extra = {}) {
  const response = await fetch(origin + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  assert.equal(response.status, expected, `${method} ${path}: HTTP ${response.status} ${await response.clone().text()}`);
  return { response, data: expected === 303 ? null : response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
try {
  await send("/api/admin/manage/posts", "GET", undefined, undefined, 401, { "oai-authenticated-user-id": "forged", "oai-authenticated-user-email": adminEmail });
  await send("/api/admin/manage/posts", "GET", undefined, "__sites_local_auth=1", 401);
  await send("/api/auth/register", "POST", { email: adminEmail, password, name: "Fake owner" }, undefined, 409);
  await send("/api/auth/register", "POST", { email: fixtureEmail, password: "short", name: "Fixture" }, undefined, 400);
  const registered = await send("/api/auth/register", "POST", { email: fixtureEmail, password, name: "Fixture Member" }, undefined, 200);
  memberCookie = registered.cookie;
  assert.ok(memberCookie?.startsWith("tipook_auth_session="));
  assert.ok(registered.response.headers.get("set-cookie").includes("HttpOnly"));
  assert.ok(registered.response.headers.get("set-cookie").includes("SameSite=Lax"));
  const member = await send("/api/me", "GET", undefined, memberCookie);
  userId = member.data.user.id;
  assert.equal(member.data.user.name, "Fixture Member");
  assert.equal(member.data.user.authenticated, true);
  assert.equal(member.data.user.isAdmin, false);
  const stored = db.prepare("SELECT password_hash FROM website_accounts WHERE user_id=?").get(userId);
  assert.ok(stored.password_hash.startsWith("scrypt-v1:")); assert.ok(!stored.password_hash.includes(password));
  await send("/api/site-content", "PUT", { changes: [{ key: contentKey, content: { kind: "text", value: "forbidden" } }] }, memberCookie, 403);
  await send("/api/admin/manage/posts", "DELETE", { id: 1 }, memberCookie, 403);
  await send("/api/admin/manage/posts", "PATCH", { id: 1, action: "restore" }, memberCookie, 403);
  await send("/api/auth/login", "POST", { email: fixtureEmail, password, role: "admin" }, undefined, 403);
  await send("/api/auth/login", "POST", { email: fixtureEmail, password: "wrong-password" }, undefined, 401);
  await send("/api/auth/login", "POST", { email: fixtureEmail, password }, undefined, 403, { Origin: "https://another.example" });
  const loggedIn = await send("/api/auth/login", "POST", { email: fixtureEmail.toUpperCase(), password, returnTo: "//attacker.example" });
  assert.equal(loggedIn.data.redirectTo, "/tai-khoan");
  const secondCookie = loggedIn.cookie;
  await send("/api/auth/password", "POST", { password, newPassword: "Another-password-456" }, memberCookie);
  assert.equal((await send("/api/me", "GET", undefined, secondCookie)).data.user.authenticated, false);
  await send("/api/auth/login", "POST", { email: fixtureEmail, password }, undefined, 401);
  await send("/api/auth/login", "POST", { email: fixtureEmail, password: "Another-password-456" });
  console.log("PASS: registration, scrypt password storage, sessions, CSRF, safe return URLs and password change.");
  const localOwner = db.prepare("SELECT user_id FROM website_accounts WHERE email = ?").get(adminEmail);
  if (localOwner) clearLocalOwnerCooldown(db, localOwner.user_id);
  const ownerResponse = await fetch(origin + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
  const owner = await finishLocalOwnerLogin(origin, db, ownerResponse);
  adminCookie = owner.cookie;
  assert.equal(owner.data.isAdmin, true);
  assert.equal((await send("/api/me", "GET", undefined, adminCookie)).data.user.isAdmin, true);
  for (const resource of ["posts", "requests", "members"]) await send(`/api/admin/manage/${resource}`, "GET", undefined, adminCookie);
  const config = (await send("/api/admin/settings", "GET", undefined, adminCookie)).data;
  assert.ok(!JSON.stringify(config).includes(adminPassword));
  await send("/api/site-content", "PUT", { changes: [{ key: contentKey, content: { kind: "image", value: "javascript:alert(1)" } }] }, adminCookie, 400);
  await send("/api/site-content", "PUT", { changes: [{ key: contentKey, content: { kind: "text", value: "Saved owner content" } }] }, adminCookie);
  assert.equal((await send("/api/site-content")).data.content[contentKey].value, "Saved owner content");
  assert.equal(db.prepare("SELECT value FROM website_content WHERE key=?").get(contentKey).value, "Saved owner content");
  await send("/api/site-content", "PUT", { changes: [{ key: contentKey, content: null }] }, adminCookie);
  assert.ok(!(await send("/api/site-content")).data.content[contentKey]);
  console.log("PASS: owner access, spoof rejection, safe image URLs, persistent website edits and restore default.");
  await send("/api/auth/logout", "POST", undefined, memberCookie, 303);
  assert.equal((await send("/api/me", "GET", undefined, memberCookie)).data.user.authenticated, false);
  const unknown = `unknown_${crypto.randomUUID()}@example.test`;
  for (let i = 0; i < 10; i++) await send("/api/auth/login", "POST", { email: unknown, password }, undefined, 401);
  await send("/api/auth/login", "POST", { email: unknown, password }, undefined, 429);
  console.log("PASS: logout invalidates sessions; persistent rate limits stop repeated login attempts.");
} finally {
  if (adminCookie) await send("/api/auth/logout", "POST", undefined, adminCookie, 303);
  if (userId) {
    db.prepare("DELETE FROM website_sessions WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM website_accounts WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM member_profiles WHERE user_id=?").run(userId);
  }
  db.prepare("DELETE FROM website_content WHERE key=?").run(contentKey);
  if (existing) db.prepare("INSERT INTO website_content (key, kind, value, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)").run(existing.key, existing.kind, existing.value, existing.updated_by, existing.updated_at);
  db.close();
}
