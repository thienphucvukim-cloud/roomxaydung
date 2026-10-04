import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { decryptTotpSecret, totpCode } from "../lib/totp-crypto.ts";
import { verifyPassword } from "../lib/password.ts";
import { responseCookie } from "./test-auth-helpers.mjs";

const origin = process.env.TIPOOK_TEST_ORIGIN || "http://localhost:5174";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Local tests only.");
assert.ok(process.env.TIPOOK_LOCAL_STATE_PATH?.replaceAll("\\", "/").startsWith(".sites-runtime/totp-check-"), "Use a dedicated .sites-runtime/totp-check-* state directory.");
const directory = `${process.env.TIPOOK_LOCAL_STATE_PATH}/v3/d1/miniflare-D1DatabaseObject`;
const file = readdirSync(directory).find(name => name.endsWith(".sqlite") && name !== "metadata.sqlite");
const db = new DatabaseSync(`${directory}/${file}`);
const vars = readFileSync(".dev.vars", "utf8");
const setting = key => vars.match(new RegExp(`^${key}\\s*=\\s*["']?([^\\s"']+)`, "m"))?.[1];
const email = setting("TIPOOK_ADMIN_EMAIL"), initialPassword = setting("TIPOOK_ADMIN_PASSWORD"), key = setting("TIPOOK_MFA_KEY");
assert.ok(email && initialPassword && key);
assert.ok(!db.prepare("SELECT user_id FROM website_accounts WHERE email = ?").get(email), "Start with fresh isolated state.");
const digest = value => createHash("sha256").update(value).digest("hex");
let ownerId, password = initialPassword;
function clearRates() {
  for (const scope of [`account:login:${email}`, `account:password:${email}`, `totp-start:${ownerId}`, `totp-verify:${ownerId}`, `totp-rotate:${ownerId}`, `admin-recover:${email}`, "ip:login:local", "ip:password:local", "totp-verify-ip:local", "admin-recover-ip:local"]) db.prepare("DELETE FROM auth_rate_limits WHERE key = ?").run(digest(`${scope}:${Math.floor(Date.now() / 900000)}`));
}
async function send(action, body, cookie, expected = 200, extra = {}) {
  const response = await fetch(origin + `/api/auth/${action}`, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: JSON.stringify(body), redirect: "manual" });
  const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : { error: await response.text() };
  if (expected !== null) assert.equal(response.status, expected, `${action}: ${response.status} ${JSON.stringify(data)}`);
  return { response, data, cookie: responseCookie(response, "tipook_totp_challenge"), session: responseCookie(response, "tipook_auth_session") };
}
const login = () => send("login", { email, password, role: "admin" });
const verify = (challenge, code, recovery = false, expected = 200, session = "") => send("totp-verify", { challengeId: challenge.data.challengeId, code, recovery }, [challenge.cookie, session].filter(Boolean).join("; "), expected);
const stored = () => db.prepare("SELECT * FROM admin_totp_credentials WHERE user_id = ?").get(ownerId);
const freshCode = () => { db.prepare("UPDATE admin_totp_credentials SET last_step = -1 WHERE user_id = ?").run(ownerId); return totpCode(decryptTotpSecret(stored().secret_encrypted, key, ownerId), Math.floor(Date.now() / 30000)); };
async function adminState(cookie) { const response = await fetch(origin + "/api/me", { headers: cookie ? { Cookie: cookie } : {} }); return (await response.json()).user; }
try {
  const setup = await login();
  ownerId = db.prepare("SELECT user_id FROM website_accounts WHERE email = ?").get(email).user_id;
  assert.equal(setup.data.method, "totp"); assert.equal(setup.data.setupRequired, true);
  assert.ok(setup.data.setupUri.startsWith("otpauth://")); assert.ok(!setup.session);
  assert.ok(!stored()); assert.equal(Boolean((await adminState(setup.cookie))?.isAdmin), false);
  const pending = db.prepare("SELECT pending_secret FROM admin_totp_challenges WHERE id = ?").get(setup.data.challengeId);
  assert.ok(!pending.pending_secret.includes(setup.data.setupSecret));
  await send("totp-verify", { challengeId: setup.data.challengeId, code: "000000" }, undefined, 400);
  const setupCode = totpCode(setup.data.setupSecret, Math.floor(Date.now() / 30000));
  await send("totp-verify", { challengeId: setup.data.challengeId, code: setupCode }, setup.cookie, 403, { Origin: "https://evil.example" });
  const enrolled = await verify(setup, setupCode);
  let admin = enrolled.session, codes = enrolled.data.recoveryCodes;
  assert.equal(codes.length, 10); assert.equal(enrolled.data.isAdmin, true); assert.ok(admin);
  assert.equal((await adminState(admin)).isAdmin, true);
  assert.ok(!stored().secret_encrypted.includes(setup.data.setupSecret));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM admin_recovery_codes WHERE user_id = ?").get(ownerId).n, 10);
  assert.ok(!JSON.stringify(db.prepare("SELECT * FROM admin_recovery_codes").all()).includes(codes[0]));
  await verify(setup, setupCode, false, 400);
  const normal = await login();
  assert.equal(normal.data.setupRequired, false); assert.ok(!normal.data.setupSecret); assert.ok(!normal.data.setupUri);
  await verify(normal, setupCode, false, 400); // Same time step cannot be reused after enrollment.
  console.log("PASS: setup requires password and live TOTP; seeds encrypted; codes hashed; browser binding, CSRF and replay enforced.");

  clearRates();
  const locked = await login();
  for (let i = 0; i < 5; i++) await verify(locked, "bad", false, 400);
  await verify(locked, freshCode(), false, 400);
  const expired = await login(); db.prepare("UPDATE admin_totp_challenges SET expires_at = 0 WHERE id = ?").run(expired.data.challengeId);
  await verify(expired, freshCode(), false, 400);
  const one = await login(), two = await login();
  const concurrent = await Promise.all([verify(one, codes[0], true, null), verify(two, codes[0], true, null)]);
  assert.deepEqual(concurrent.map(item => item.response.status).sort(), [200, 400]);
  const otherSession = concurrent.find(item => item.response.status === 200).session;
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM admin_recovery_codes WHERE user_id = ?").get(ownerId).n, 9);
  console.log("PASS: five-attempt lockout, expiry and concurrent recovery-code consumption.");

  clearRates();
  const stale = await login(), next = "Changed-TOTP-test-password-456";
  const change = await send("password", { password, newPassword: next }, admin);
  const before = db.prepare("SELECT password_hash FROM website_accounts WHERE user_id = ?").get(ownerId).password_hash;
  await verify(change, codes[1], true, 401); // Password change is bound to the current admin session.
  await verify(change, "bad", false, 400, admin);
  assert.equal(db.prepare("SELECT password_hash FROM website_accounts WHERE user_id = ?").get(ownerId).password_hash, before);
  await verify(change, codes[1], true, 200, admin);
  password = next;
  assert.equal(Boolean((await adminState(otherSession))?.authenticated), false);
  assert.equal((await adminState(admin)).isAdmin, true);
  await verify(stale, codes[2], true, 400);
  await send("login", { email, password: initialPassword }, undefined, 401);
  console.log("PASS: password updates require second factor and the original session; old sessions and pending logins revoked.");

  clearRates();
  const recoveredPassword = "Recovered-TOTP-password-789";
  await send("admin-recover", { email, newPassword: recoveredPassword, code: "bad" }, undefined, 400);
  await send("admin-recover", { email, newPassword: recoveredPassword, code: codes[3] });
  password = recoveredPassword;
  assert.equal(Boolean((await adminState(admin))?.authenticated), false);
  await send("admin-recover", { email, newPassword: recoveredPassword, code: codes[3] }, undefined, 400);
  assert.ok(await verifyPassword(password, db.prepare("SELECT password_hash FROM website_accounts WHERE user_id = ?").get(ownerId).password_hash));
  const recovered = await login(); assert.equal(recovered.data.setupRequired, false);
  admin = (await verify(recovered, freshCode())).session;
  console.log("PASS: offline password recovery uses a one-time code, revokes all sessions and keeps TOTP enabled.");

  clearRates();
  const oldCredential = stored().secret_encrypted;
  const rotation = await send("totp-rotate", { password, code: codes[4], recovery: true }, admin);
  assert.equal(stored().secret_encrypted, oldCredential); // Old factor remains until new factor proves possession.
  const replacementCode = totpCode(rotation.data.setupSecret, Math.floor(Date.now() / 30000));
  await verify(rotation, replacementCode, false, 401);
  const rotated = await verify(rotation, replacementCode, false, 200, admin);
  assert.equal(rotated.data.deviceChanged, true); assert.equal(rotated.data.recoveryCodes.length, 10);
  assert.notEqual(stored().secret_encrypted, oldCredential);
  const afterRotation = await login(); await verify(afterRotation, codes[5], true, 400);
  await verify(afterRotation, rotated.data.recoveryCodes[0], true);
  assert.equal(decryptTotpSecret(stored().secret_encrypted, key, ownerId), rotation.data.setupSecret);
  console.log("PASS: changing device verifies both factors, replaces backup codes and invalidates old recovery codes.");

  clearRates();
  const limited = await login();
  for (let i = 0; i < 15; i++) {
    if (i % 5 === 0 && i > 0) Object.assign(limited, await login());
    await verify(limited, "bad", false, 400);
  }
  const final = await login(); await verify(final, freshCode(), false, 429);
  console.log("PASS: account-wide verification limit persists across new challenges.");
} finally {
  if (ownerId) {
    for (const table of ["admin_totp_challenges", "admin_recovery_codes", "admin_totp_credentials", "website_sessions", "auth_email_challenges", "auth_password_reset_requests", "member_profiles", "website_accounts"]) {
      if (table === "auth_password_reset_requests") db.prepare(`DELETE FROM ${table} WHERE email = ?`).run(email);
      else db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(ownerId);
    }
    clearRates();
  }
  db.close();
}
