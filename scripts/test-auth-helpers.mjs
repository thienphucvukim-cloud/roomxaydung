import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { decryptTotpSecret, totpCode } from "../lib/totp-crypto.ts";

const digest = value => createHash("sha256").update(value).digest("hex");
export function clearLocalOwnerCooldown(db, userId) {
  for (const purpose of ["login", "password"]) db.prepare("DELETE FROM auth_email_cooldowns WHERE key = ?").run(digest(`email:${userId}:${purpose}`));
}
export function localEmailCode(db, challengeId) {
  const row = db.prepare("SELECT code FROM auth_email_test_outbox WHERE id = ?").get(challengeId);
  assert.ok(row, "Use a dev server started with TIPOOK_AUTH_EMAIL_TEST=1 for simulated mail delivery.");
  return row.code;
}
export function responseCookie(response, name) {
  return response.headers.getSetCookie().map(value => value.split(";")[0]).find(value => value.startsWith(name + "="));
}
export async function finishLocalOwnerLogin(origin, db, loginResponse) {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Test codes are local only.");
  assert.ok(process.env.TIPOOK_LOCAL_STATE_PATH, "Owner fixtures must use isolated local state; see docs/ADMIN_TOTP.md.");
  const challenge = await loginResponse.json();
  assert.equal(loginResponse.status, 200, JSON.stringify(challenge));
  assert.equal(challenge.requiresCode, true, "Owner login must require two-factor verification.");
  assert.equal(challenge.method, "totp");
  assert.ok(!responseCookie(loginResponse, "tipook_auth_session"), "Password alone must never mint an owner session.");
  const row = db.prepare("SELECT * FROM admin_totp_challenges WHERE id = ?").get(challenge.challengeId);
  const vars = readFileSync(".dev.vars", "utf8");
  const key = vars.match(/^TIPOOK_MFA_KEY\s*=\s*["']?([a-f0-9]{64})/m)?.[1];
  const stored = db.prepare("SELECT secret_encrypted FROM admin_totp_credentials WHERE user_id = ?").get(row.user_id);
  const secret = challenge.setupSecret || decryptTotpSecret(stored.secret_encrypted, key, row.user_id);
  // Local fixtures can move the replay counter; production replay behavior has
  // separate integration coverage in check-admin-totp.mjs.
  db.prepare("UPDATE admin_totp_credentials SET last_step = -1 WHERE user_id = ?").run(row.user_id);
  const response = await fetch(origin + "/api/auth/totp-verify", { method: "POST", headers: { "Content-Type": "application/json", Cookie: responseCookie(loginResponse, "tipook_totp_challenge") }, body: JSON.stringify({ challengeId: challenge.challengeId, code: totpCode(secret, Math.floor(Date.now() / 30000)) }) });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.isAdmin, true);
  return { data, cookie: responseCookie(response, "tipook_auth_session") };
}
