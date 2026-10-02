import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { clearLocalOwnerCooldown, responseCookie, finishLocalOwnerLogin } from "./test-auth-helpers.mjs";

const origin = process.env.TIPOOK_TEST_ORIGIN || "http://localhost:5174";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Recovery checks must remain local.");
const directory = `${process.env.TIPOOK_LOCAL_STATE_PATH || ".wrangler/state"}/v3/d1/miniflare-D1DatabaseObject`;
const file = readdirSync(directory).find(name => name.endsWith(".sqlite") && name !== "metadata.sqlite");
const db = new DatabaseSync(`${directory}/${file}`);
const vars = readFileSync(".dev.vars", "utf8");
const setting = key => vars.match(new RegExp(`^${key}[ \\t]*=[ \\t]*["']?([^\\s"']+)`, "m"))?.[1];
const owner = db.prepare("SELECT * FROM website_accounts WHERE email = ? AND is_owner = 1").get(setting("TIPOOK_ADMIN_EMAIL"));
assert.ok(owner, "Run check-website-auth.mjs first.");
const marker = crypto.randomUUID();
const email = `recovery_${marker}@example.test`, unknown = `unknown_${marker}@example.test`;
const password = "Original-test-password-234", nextPassword = "Replacement-test-password-987";
const digest = value => createHash("sha256").update(value).digest("hex");
const ids = [], userIds = [], tokens = [];
let ownerLoginCookie;
async function send(path, body, cookie, expected = 200, extra = {}) {
  const response = await fetch(origin + path, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
  if (expected !== null) assert.equal(response.status, expected, `${path}: ${response.status} ${JSON.stringify(data)}`);
  const session = responseCookie(response, "tipook_auth_session");
  if (session && !session.endsWith("=")) tokens.push(session.split("=")[1]);
  return { response, data, session, cookie: responseCookie(response, "tipook_auth_challenge") };
}
function clearRecoveryLimits(emailValue, userId) {
  for (const scope of [`reset-request:${emailValue}`, `reset-verify:${emailValue}`, ...(userId ? [`email-send:${userId}:reset`] : [])]) {
    db.prepare("DELETE FROM auth_rate_limits WHERE key = ?").run(digest(`${scope}:${Math.floor(Date.now() / 900_000)}`));
  }
  db.prepare("DELETE FROM auth_email_cooldowns WHERE key = ?").run(digest(`reset-request:${emailValue}`));
  if (userId) db.prepare("DELETE FROM auth_email_cooldowns WHERE key = ?").run(digest(`email:${userId}:reset`));
}
async function codeFor(id) {
  const deadline = Date.now() + 5000;
  do {
    const outbox = db.prepare("SELECT code FROM auth_email_test_outbox WHERE id = ?").get(id);
    if (outbox) return outbox.code;
    await new Promise(resolve => setTimeout(resolve, 30));
  } while (Date.now() < deadline);
  throw new Error("No simulated recovery mail; start dev with TIPOOK_AUTH_EMAIL_TEST=1.");
}
async function forgot(emailValue, cookie, userId) {
  clearRecoveryLimits(emailValue, userId);
  const result = await send("/api/auth/forgot", { email: emailValue }, cookie);
  ids.push(result.data.challengeId);
  assert.ok(!result.session, "Recovery request cannot issue a session.");
  assert.ok(!result.data.code, "Never expose OTP in HTTP.");
  return { ...result, id: result.data.challengeId };
}
const reset = (challenge, code, cookie = challenge.cookie, expected = 200, replacement = nextPassword) => send("/api/auth/reset", { challengeId: challenge.id, code, newPassword: replacement }, cookie, expected);
try {
  const registered = await send("/api/auth/register", { email, password, name: "Recovery Fixture" });
  const userId = (await send("/api/me", undefined, registered.session)).data.user.id; userIds.push(userId);
  const secondSession = (await send("/api/auth/login", { email, password })).session;
  const before = db.prepare("SELECT password_hash FROM website_accounts WHERE user_id = ?").get(userId).password_hash;
  const known = await forgot(email, undefined, userId);
  const missing = await forgot(unknown);
  assert.equal(known.data.message, missing.data.message);
  assert.deepEqual(Object.keys(known.data).sort(), Object.keys(missing.data).sort());
  assert.ok(known.response.headers.get("cache-control").includes("no-store"));
  const knownCode = await codeFor(known.id);
  assert.equal(db.prepare("SELECT password_hash FROM website_accounts WHERE user_id = ?").get(userId).password_hash, before);
  assert.equal((await send("/api/me", undefined, registered.session)).data.user.authenticated, true);
  await reset(missing, "111111", missing.cookie, 400);
  assert.equal(db.prepare("SELECT user_id FROM website_accounts WHERE email = ?").get(unknown), undefined);
  assert.equal(db.prepare("SELECT id FROM auth_email_test_outbox WHERE id = ?").get(missing.id), undefined);
  await send("/api/auth/forgot", { email }, known.cookie, 429);
  await reset(known, knownCode, "", 400);
  await send("/api/auth/reset", { challengeId: known.id, code: knownCode, newPassword: nextPassword }, known.cookie, 403, { Origin: "https://evil.example" });
  await reset(known, knownCode, known.cookie, 400, "short");
  await reset(known, knownCode === "000000" ? "111111" : "000000", known.cookie, 400);
  await send("/api/auth/verify", { challengeId: known.id, code: knownCode }, known.cookie, 400);
  await send("/api/auth/resend", { challengeId: known.id }, known.cookie, 400);
  const done = await reset(known, knownCode);
  assert.equal(done.data.passwordReset, true);
  assert.ok(!done.session || done.session.endsWith("="));
  for (const cookie of [registered.session, secondSession]) assert.equal((await send("/api/me", undefined, cookie)).data.user.authenticated, false);
  await reset(known, knownCode, known.cookie, 400);
  await send("/api/auth/login", { email, password }, undefined, 401);
  assert.ok((await send("/api/auth/login", { email, password: nextPassword })).session);
  console.log("PASS: recovery requires mailbox proof, gives generic responses, does not create accounts, rejects wrong/cross-browser/cross-purpose codes and revokes all sessions.");

  const stale = await forgot(email, undefined, userId); const staleCode = await codeFor(stale.id);
  const resent = await forgot(email, stale.cookie, userId); const resentCode = await codeFor(resent.id);
  await reset(stale, staleCode, stale.cookie, 400);
  db.prepare("UPDATE auth_email_challenges SET expires_at = ? WHERE id = ?").run(Date.now() - 1, resent.id);
  await reset(resent, resentCode, resent.cookie, 400);
  const locked = await forgot(email, undefined, userId); const lockedCode = await codeFor(locked.id);
  for (let attempt = 0; attempt < 5; attempt++) await reset(locked, lockedCode === "000000" ? "111111" : "000000", locked.cookie, 400);
  await reset(locked, lockedCode, locked.cookie, 400);
  const pairChallenge = await forgot(email, undefined, userId); const pairCode = await codeFor(pairChallenge.id);
  const pair = await Promise.all([reset(pairChallenge, pairCode, pairChallenge.cookie, null), reset(pairChallenge, pairCode, pairChallenge.cookie, null)]);
  assert.deepEqual(pair.map(item => item.response.status).sort(), [200, 400]);
  console.log("PASS: recovery resend invalidates prior codes; expiry, five-attempt lockout and atomic one-time use.");

  const another = await forgot(email, undefined, userId); const anotherCode = await codeFor(another.id);
  const memberSession = (await send("/api/auth/login", { email, password: nextPassword })).session;
  await send("/api/auth/password", { password: nextPassword, newPassword: "Changed-before-reset-456" }, memberSession);
  await reset(another, anotherCode, another.cookie, 400);
  console.log("PASS: pending recovery cannot overwrite a password changed through another session.");

  clearLocalOwnerCooldown(db, owner.user_id);
  const login = await fetch(origin + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: owner.email, password: setting("TIPOOK_ADMIN_PASSWORD") }) });
  ownerLoginCookie = (await finishLocalOwnerLogin(origin, db, login)).cookie; tokens.push(ownerLoginCookie.split("=")[1]);
  const ownerReset = await forgot(owner.email, undefined, owner.user_id);
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.ok(!db.prepare("SELECT id FROM auth_email_test_outbox WHERE id = ?").get(ownerReset.id));
  assert.ok(!db.prepare("SELECT id FROM auth_email_challenges WHERE id = ?").get(ownerReset.id));
  assert.equal(db.prepare("SELECT password_hash FROM website_accounts WHERE user_id = ?").get(owner.user_id).password_hash, owner.password_hash);
  assert.equal((await send("/api/me", undefined, ownerLoginCookie)).data.user.isAdmin, true);
  console.log("PASS: admin email recovery is blocked; owner password and session remain unchanged.");
} finally {
  db.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ?").run(owner.password_hash, owner.user_id);
  for (const id of ids) {
    db.prepare("DELETE FROM auth_email_challenges WHERE id = ?").run(id);
    db.prepare("DELETE FROM auth_password_reset_requests WHERE id = ?").run(id);
    db.prepare("DELETE FROM auth_email_test_outbox WHERE id = ?").run(id);
  }
  for (const token of tokens) db.prepare("DELETE FROM website_sessions WHERE token_hash = ?").run(digest(token));
  for (const userId of userIds) {
    db.prepare("DELETE FROM auth_email_challenges WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM website_sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM website_accounts WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM member_profiles WHERE user_id = ?").run(userId);
  }
  for (const emailValue of [email, unknown, owner.email]) clearRecoveryLimits(emailValue, emailValue === owner.email ? owner.user_id : undefined);
  clearLocalOwnerCooldown(db, owner.user_id);
  db.close();
}
