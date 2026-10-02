import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { googleAuthorizationUrl, verifyGoogleIdToken } from "../lib/google-oauth.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = { ...publicKey.export({ format: "jwk" }), kid: "test-key", use: "sig", alg: "RS256" };
const clientId = "test-client.apps.googleusercontent.com", nonce = "browser-nonce", now = 1800000000000;
const claims = { iss: "https://accounts.google.com", aud: clientId, sub: "1234567890", email: "Member@Example.test", email_verified: true, nonce, iat: now / 1000, exp: now / 1000 + 3600, name: "Test Member" };
function token(overrides = {}, headerOverrides = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key", ...headerOverrides })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...claims, ...overrides })).toString("base64url");
  const data = `${header}.${body}`;
  return data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
}
assert.deepEqual(await verifyGoogleIdToken(token(), clientId, nonce, [key], now), { sub: "1234567890", email: "member@example.test", name: "Test Member" });
assert.equal((await verifyGoogleIdToken(token({ picture: "https://lh3.googleusercontent.com/avatar" }), clientId, nonce, [key], now)).picture, "https://lh3.googleusercontent.com/avatar");
for (const picture of ["javascript:alert(1)", "http://example.test/avatar", "not-a-url", 123]) {
  assert.equal((await verifyGoogleIdToken(token({ picture }), clientId, nonce, [key], now)).picture, undefined);
}
for (const override of [{ aud: "another-client" }, { iss: "https://attacker.test" }, { exp: now / 1000 }, { iat: now / 1000 + 3600 }, { nonce: "other-browser" }, { email_verified: false }, { email: "invalid" }, { sub: "" }, { aud: [clientId, "other"] }, { azp: "another-client" }]) {
  await assert.rejects(verifyGoogleIdToken(token(override), clientId, nonce, [key], now));
}
await assert.rejects(verifyGoogleIdToken(token({}, { alg: "none" }), clientId, nonce, [key], now));
await assert.rejects(verifyGoogleIdToken(token(), clientId, nonce, [], now));
const valid = token();
const parts = valid.split(".");
parts[1] = Buffer.from(JSON.stringify({ ...claims, sub: "attacker" })).toString("base64url");
await assert.rejects(verifyGoogleIdToken(parts.join("."), clientId, nonce, [key], now));
await assert.rejects(verifyGoogleIdToken("not-a-token", clientId, nonce, [key], now));
// RFC 7636 Appendix B provides a known PKCE vector.
const url = new URL(googleAuthorizationUrl(clientId, "http://localhost:5173/api/auth/google/callback", "state", "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", nonce));
assert.equal(url.searchParams.get("code_challenge"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
assert.equal(url.searchParams.get("code_challenge_method"), "S256");
assert.equal(url.searchParams.get("state"), "state");
assert.equal(url.searchParams.get("nonce"), nonce);
assert.equal(url.searchParams.get("scope"), "openid email profile");
console.log("PASS: Google RS256 signatures, issuer, audience, expiry, nonce, verified email and RFC 7636 PKCE vector.");
