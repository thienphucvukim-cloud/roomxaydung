import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

// scrypt's memory cost is 16 MiB; p=5 increases the work without increasing it.
const options = { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1:${salt}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [version, salt, hash] = stored.split(":");
  if (version !== "scrypt-v1" || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(hash ?? "")) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(hash, "hex"));
}
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function equalSecret(actual: string, expected: string) {
  return timingSafeEqual(Buffer.from(hashToken(actual), "hex"), Buffer.from(hashToken(expected), "hex"));
}
