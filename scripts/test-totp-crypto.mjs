import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encodeBase32, newTotpSecret, totpCode, matchingTotpStep, encryptTotpSecret, decryptTotpSecret, newRecoveryCodes, recoveryCodeHash } from "../lib/totp-crypto.ts";

// RFC 6238 Appendix B: independent SHA-1 vectors, including times after 2038.
const secret = encodeBase32(Buffer.from("12345678901234567890"));
for (const [seconds, expected] of [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]]) {
  assert.equal(totpCode(secret, Math.floor(seconds / 30), 8), expected);
}
assert.equal(matchingTotpStep(secret, "287082", 59_000), 1);
assert.equal(matchingTotpStep(secret, "287082", 89_000), 1);
assert.equal(matchingTotpStep(secret, "287082", 120_000), null);
assert.equal(matchingTotpStep(secret, "000", 59_000), null);
const generated = newTotpSecret(), key = randomBytes(32).toString("hex");
assert.match(generated, /^[A-Z2-7]{32}$/);
const ciphertext = encryptTotpSecret(generated, key, "owner");
assert.ok(!ciphertext.includes(generated));
assert.equal(decryptTotpSecret(ciphertext, key, "owner"), generated);
assert.throws(() => decryptTotpSecret(ciphertext, key, "another-user"));
assert.throws(() => decryptTotpSecret(ciphertext, randomBytes(32).toString("hex"), "owner"));
assert.throws(() => decryptTotpSecret(ciphertext.slice(0, -2) + (ciphertext.endsWith("00") ? "ff" : "00"), key, "owner"));
const codes = newRecoveryCodes();
assert.equal(new Set(codes).size, 10);
assert.equal(recoveryCodeHash("owner", codes[0]), recoveryCodeHash("owner", codes[0].replaceAll("-", "").toLowerCase()));
assert.notEqual(recoveryCodeHash("owner", codes[0]), recoveryCodeHash("another-user", codes[0]));
assert.equal(recoveryCodeHash("owner", "short"), null);
console.log("PASS: RFC 6238 vectors, clock window, authenticated encryption and 128-bit recovery codes.");
