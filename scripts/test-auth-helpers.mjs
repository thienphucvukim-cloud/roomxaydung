import assert from "node:assert/strict";
import { createHash } from "node:crypto";

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
  const challenge = await loginResponse.json();
  assert.equal(loginResponse.status, 200, JSON.stringify(challenge));
  assert.equal(challenge.requiresCode, true, "Owner login must require email verification.");
  assert.ok(!responseCookie(loginResponse, "tipook_auth_session"), "Password alone must never mint an owner session.");
  const response = await fetch(origin + "/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json", Cookie: responseCookie(loginResponse, "tipook_auth_challenge") }, body: JSON.stringify({ challengeId: challenge.challengeId, code: localEmailCode(db, challenge.challengeId) }) });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.isAdmin, true);
  db.prepare("DELETE FROM auth_email_test_outbox WHERE id = ?").run(challenge.challengeId);
  return { data, cookie: responseCookie(response, "tipook_auth_session") };
}
