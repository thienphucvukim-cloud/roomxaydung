import { env } from "cloudflare:workers";

type PayosConfig = { clientId: string; apiKey: string; checksumKey: string };

export type SignatureValue = string | number | boolean | null | undefined | SignatureValue[] | { [key: string]: SignatureValue };

export function getPayosConfig(): PayosConfig {
  const bindings = env as unknown as Record<string, string | undefined>;
  const clientId = bindings.PAYOS_CLIENT_ID;
  const apiKey = bindings.PAYOS_API_KEY;
  const checksumKey = bindings.PAYOS_CHECKSUM_KEY;
  if (!clientId || !apiKey || !checksumKey) {
    throw new Error("Thanh toán chưa được cấu hình. Cần thêm PAYOS_CLIENT_ID, PAYOS_API_KEY và PAYOS_CHECKSUM_KEY.");
  }
  return { clientId, apiKey, checksumKey };
}

function sortNested(value: SignatureValue): SignatureValue {
  if (Array.isArray(value)) return value.map(sortNested);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortNested(item)]));
  }
  return value;
}

function signatureValue(value: SignatureValue) {
  if (value === null || value === undefined || value === "null" || value === "undefined") return "";
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(sortNested(value));
  return String(value);
}

export function signaturePayload(data: Record<string, SignatureValue>) {
  return Object.keys(data).sort().map((key) => `${key}=${signatureValue(data[key])}`).join("&");
}

export async function hmacSha256(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createPayosSignature(data: Record<string, SignatureValue>, checksumKey: string) {
  return hmacSha256(signaturePayload(data), checksumKey);
}

export async function verifyPayosSignature(data: Record<string, SignatureValue>, signature: string, checksumKey: string) {
  const expected = await createPayosSignature(data, checksumKey);
  return expected.length === signature.length && expected.toLowerCase() === signature.toLowerCase();
}