import { env } from "cloudflare:workers";
import { hmacSha256 } from "./payos";

function downloadSecret() {
  const bindings = env as unknown as Record<string, string | undefined>;
  const secret = bindings.DOWNLOAD_LINK_SECRET || bindings.PAYOS_CHECKSUM_KEY;
  if (!secret) throw new Error("Chưa cấu hình DOWNLOAD_LINK_SECRET cho liên kết tải file.");
  return secret;
}

function payload(orderCode: number, attachmentId: number, expires: number, buyerUserId: string) {
  return `tipook-download:${orderCode}:${attachmentId}:${expires}:${buyerUserId}`;
}

export async function createDownloadToken(orderCode: number, attachmentId: number, expires: number, buyerUserId: string) {
  return hmacSha256(payload(orderCode, attachmentId, expires, buyerUserId), downloadSecret());
}

export async function verifyDownloadToken(orderCode: number, attachmentId: number, expires: number, buyerUserId: string, token: string) {
  const expected = await createDownloadToken(orderCode, attachmentId, expires, buyerUserId);
  return expected.length === token.length && expected.toLowerCase() === token.toLowerCase();
}