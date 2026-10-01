import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { clearLocalOwnerCooldown, localEmailCode, responseCookie } from "./test-auth-helpers.mjs";

const origin = process.env.TIPOOK_TEST_ORIGIN || "http://localhost:5174";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Security fixtures must stay local.");
const vars = readFileSync(".dev.vars", "utf8");
const setting = key => vars.match(new RegExp(`^${key}[ \\t]*=[ \\t]*["']?([^\\s"']+)`, "m"))?.[1];
const email = setting("TIPOOK_ADMIN_EMAIL"), password = setting("TIPOOK_ADMIN_PASSWORD");
const directory = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const file = readdirSync(directory).find(name => name.endsWith(".sqlite") && name !== "metadata.sqlite");
const db = new DatabaseSync(`${directory}/${file}`);
const owner = db.prepare("SELECT * FROM website_accounts WHERE email = ? AND is_owner = 1").get(email);
assert.ok(owner, "Run check-website-auth.mjs first to create the local owner account.");
const digest = value => createHash("sha256").update(value).digest("hex");
const sessions = new Set(), challenges = new Set();
const rateKeys = new Set();
function clearRates() {
  for (const scope of [`email-send:${owner.user_id}`, `account:login:${email}`, `account:password:${email}`]) {
    const key = digest(`${scope}:${Math.floor(Date.now() / 900_000)}`);
    rateKeys.add(key); db.prepare("DELETE FROM auth_rate_limits WHERE key = ?").run(key);
  }
}
async function send(path, body, cookie, expected = 200, extra = {}) {
  const response = await fetch(origin + path, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
  if (expected !== null) assert.equal(response.status, expected, `${path}: ${response.status} ${JSON.stringify(data)}`);
  const session = responseCookie(response, "tipook_auth_session");
  if (session && !session.endsWith("=")) sessions.add(session.split("=")[1]);
  return { response, data, cookie: responseCookie(response, "tipook_auth_challenge"), session };
}
async function start(purpose = "login", session, nextPassword, existingCookie, currentPassword = password) {
  clearLocalOwnerCooldown(db, owner.user_id); clearRates();
  const result = await send(`/api/auth/${purpose === "login" ? "login" : "password"}`, purpose === "login" ? { email, password: currentPassword, returnTo: "https://evil.example" } : { password: currentPassword, newPassword: nextPassword }, [session, existingCookie].filter(Boolean).join("; "));
  assert.equal(result.data.requiresCode, true);
  assert.ok(!result.session, "Password alone must not issue an owner session.");
  const id = result.data.challengeId;
  challenges.add(id);
  assert.ok(!JSON.stringify(result.data).includes(localEmailCode(db, id)), "Never expose the OTP in the API response.");
  const stored = db.prepare("SELECT * FROM auth_email_challenges WHERE id = ?").get(id);
  assert.ok(!stored.code_hash.includes(localEmailCode(db, id)));
  assert.ok(!JSON.stringify(stored).includes(password));
  return { ...result, id, code: localEmailCode(db, id) };
}
const verify = (item, cookie = item.cookie, expected = 200, code = item.code) => send("/api/auth/verify", { challengeId: item.id, code }, cookie, expected);
try {
  const legacyToken = randomBytes(32).toString("hex"); sessions.add(legacyToken);
  db.prepare("INSERT INTO website_sessions (token_hash,user_id,expires_at,owner_verified) VALUES (?,?,?,0)").run(digest(legacyToken), owner.user_id, Date.now() + 60_000);
  await send("/api/admin/settings", undefined, `tipook_auth_session=${legacyToken}`, 401);
  const first = await start();
  assert.equal((await send("/api/me", undefined, first.cookie)).data.user.authenticated, false);
  await send("/api/admin/settings", undefined, first.cookie, 401);
  await verify(first, "", 400);
  await send("/api/auth/verify", { challengeId: first.id, code: first.code }, first.cookie, 403, { Origin: "https://evil.example" });
  await verify(first, first.cookie, 400, first.code === "000000" ? "111111" : "000000");
  const active = await verify(first);
  assert.equal(active.data.isAdmin, true);
  assert.equal(active.data.redirectTo, "/kho-mau-nha-dep-tipook");
  assert.equal((await send("/api/me", undefined, active.session)).data.user.isAdmin, true);
  await verify(first, first.cookie, 400);
  console.log("PASS: owner requires email code; browser binding, CSRF, wrong code, replay and legacy-session rejection.");

  const concurrent = await start();
  const pair = await Promise.all([verify(concurrent, concurrent.cookie, null), verify(concurrent, concurrent.cookie, null)]);
  assert.deepEqual(pair.map(item => item.response.status).sort(), [200, 400]);
  const other = pair.find(item => item.response.status === 200).session;
  const expired = await start();
  db.prepare("UPDATE auth_email_challenges SET expires_at = ? WHERE id = ?").run(Date.now() - 1, expired.id);
  await verify(expired, expired.cookie, 400);
  const locked = await start();
  for (let attempt = 0; attempt < 5; attempt++) await verify(locked, locked.cookie, 400, locked.code === "000000" ? "111111" : "000000");
  await verify(locked, locked.cookie, 400);
  console.log("PASS: a code is consumed atomically, expires after 10 minutes and locks after five wrong attempts.");

  const original = await start();
  await send("/api/auth/resend", { challengeId: original.id }, original.cookie, 429);
  clearLocalOwnerCooldown(db, owner.user_id);
  const resent = await send("/api/auth/resend", { challengeId: original.id }, original.cookie);
  const replacement = { ...resent, id: resent.data.challengeId, code: localEmailCode(db, resent.data.challengeId) }; challenges.add(replacement.id);
  await verify(original, original.cookie, 400);
  await verify(replacement);
  console.log("PASS: resend cooldown enforced; resending invalidates the previous code.");

  const nextPassword = "Temporary-test-only-password-785";
  const pending = await start("password", active.session, nextPassword);
  assert.equal(db.prepare("SELECT password_hash FROM website_accounts WHERE user_id = ?").get(owner.user_id).password_hash, owner.password_hash, "No change before email confirmation.");
  await verify(pending, pending.cookie, 401);
  await verify(pending, `${other}; ${pending.cookie}`, 401);
  const changed = await verify(pending, `${active.session}; ${pending.cookie}`);
  assert.equal(changed.data.passwordChanged, true);
  assert.equal((await send("/api/me", undefined, other)).data.user.authenticated, false);
  assert.equal((await send("/api/me", undefined, active.session)).data.user.isAdmin, true);
  await send("/api/auth/login", { email, password }, undefined, 401);
  const newLogin = await start("login", undefined, undefined, undefined, nextPassword);
  await verify(newLogin);
  assert.notEqual(db.prepare("SELECT password_hash FROM website_accounts WHERE user_id = ?").get(owner.user_id).password_hash, owner.password_hash);
  console.log("PASS: password change requires email + current session, old password fails, other sessions revoked and bootstrap cannot reset the changed password.");

  const pendingAfterLogout = await start("password", active.session, "Another-temporary-test-password", undefined, nextPassword);
  await send("/api/auth/logout", {}, `${active.session}; ${pendingAfterLogout.cookie}`, 303);
  await verify(pendingAfterLogout, `${active.session}; ${pendingAfterLogout.cookie}`, 400);
  console.log("PASS: logout cancels pending email challenges.");
} finally {
  // Restore the real local owner's password; no production credentials or data are used.
  db.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ?").run(owner.password_hash, owner.user_id);
  for (const token of sessions) db.prepare("DELETE FROM website_sessions WHERE token_hash = ?").run(digest(token));
  for (const id of challenges) { db.prepare("DELETE FROM auth_email_challenges WHERE id = ?").run(id); db.prepare("DELETE FROM auth_email_test_outbox WHERE id = ?").run(id); }
  for (const key of rateKeys) db.prepare("DELETE FROM auth_rate_limits WHERE key = ?").run(key);
  clearLocalOwnerCooldown(db, owner.user_id);
  db.close();
}
