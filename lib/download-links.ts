import { env } from "cloudflare:workers";
import { DOWNLOAD_SIGNATURE_NAMESPACE } from "./legacy-contracts";

function downloadSecret() {
  const bindings = env as unknown as Record<string, string | undefined>;
  const secret = bindings.DOWNLOAD_LINK_SECRET;
  if (!secret) throw new Error("Chưa cấu hình DOWNLOAD_LINK_SECRET cho liên kết tải file.");
  return secret;
}

function payload(orderCode: number, attachmentId: number, expires: number, buyerUserId: string) {
  return `${DOWNLOAD_SIGNATURE_NAMESPACE}:${orderCode}:${attachmentId}:${expires}:${buyerUserId}`;
}

function signatureBytes(signature: string) {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return null;
  return Uint8Array.from(signature.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16));
}

async function hmac(value: string, mode: "sign" | "verify", signature?: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(downloadSecret()), { name: "HMAC", hash: "SHA-256" }, false, [mode]);
  if (mode === "verify") {
    const bytes = signatureBytes(signature ?? "");
    return bytes ? crypto.subtle.verify("HMAC", key, bytes, encoder.encode(value)) : false;
  }
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createDownloadToken(orderCode: number, attachmentId: number, expires: number, buyerUserId: string) {
  return hmac(payload(orderCode, attachmentId, expires, buyerUserId), "sign") as Promise<string>;
}

export async function verifyDownloadToken(orderCode: number, attachmentId: number, expires: number, buyerUserId: string, token: string) {
  return hmac(payload(orderCode, attachmentId, expires, buyerUserId), "verify", token) as Promise<boolean>;
}
