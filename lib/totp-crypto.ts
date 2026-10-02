import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function encodeBase32(bytes: Uint8Array) {
  let bits = 0, value = 0, result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { result += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function decodeBase32(secret: string) {
  let bits = 0, value = 0; const bytes: number[] = [];
  for (const char of secret) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error("Invalid TOTP secret");
    value = (value << 5) | digit; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}
export function newTotpSecret() { return encodeBase32(randomBytes(20)); }
export function totpCode(secret: string, step: number, digits = 6) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, "0");
}
export function matchingTotpStep(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30_000);
  for (const candidate of [step, step - 1, step + 1]) {
    if (candidate >= 0 && timingSafeEqual(Buffer.from(totpCode(secret, candidate)), Buffer.from(code))) return candidate;
  }
  return null;
}
export function encryptTotpSecret(secret: string, key: string, userId: string) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid MFA encryption key");
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");
}
export function decryptTotpSecret(encrypted: string, key: string, userId: string) {
  const [version, nonce, tag, ciphertext] = encrypted.split(":");
  if (version !== "v1" || !/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid MFA key or data");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(nonce, "hex"));
  decipher.setAAD(Buffer.from(userId)); decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
}
export function newRecoveryCodes() {
  return Array.from({ length: 10 }, () => randomBytes(16).toString("hex").toUpperCase().match(/.{8}/g)!.join("-"));
}
export function recoveryCodeHash(userId: string, value: string) {
  const normalized = value.trim().replace(/-/g, "").toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(normalized)) return null;
  return createHash("sha256").update(`totp-recovery:${userId}:${normalized}`).digest("hex");
}
