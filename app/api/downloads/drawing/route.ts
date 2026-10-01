import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { postAttachments, walletTransactions } from "../../../../db/schema";
import { getPaymentBuyerId } from "../../../../lib/payment-identity";
import { verifyDownloadToken } from "../../../../lib/download-links";

function bucket() {
  if (!env.BUCKET) throw new Error("Kho lưu trữ tệp chưa được cấu hình.");
  return env.BUCKET;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const orderCode = Number(params.get("order"));
    const attachmentId = Number(params.get("file"));
    const expires = Number(params.get("expires"));
    const token = params.get("token") || "";
    if (!Number.isSafeInteger(orderCode) || !Number.isSafeInteger(attachmentId) || !Number.isSafeInteger(expires) || !/^[0-9a-f]{64}$/i.test(token)) return Response.json({ error: "Liên kết tải không hợp lệ." }, { status: 400 });
    if (Math.floor(Date.now() / 1000) > expires) return Response.json({ error: "Liên kết tải đã hết hạn. Bạn có thể mở lại đơn đã mua để tạo link mới." }, { status: 410 });

    const userId = await getPaymentBuyerId();
    if (!userId) return Response.json({ error: "Phiên tài khoản không hợp lệ hoặc đã hết hạn." }, { status: 401 });
    if (!(await verifyDownloadToken(orderCode, attachmentId, expires, userId, token))) return Response.json({ error: "Liên kết tải không thuộc tài khoản này." }, { status: 403 });

    const db = getDb();
    const [purchase] = await db.select().from(walletTransactions).where(and(eq(walletTransactions.orderCode, orderCode), eq(walletTransactions.userId, userId), eq(walletTransactions.kind, "purchase"))).limit(1);
    if (!purchase || purchase.targetType !== "post" || !purchase.targetId || !/^\d+$/.test(purchase.targetId)) return Response.json({ error: "Không tìm thấy giao dịch mua hợp lệ." }, { status: 403 });
    const [attachment] = await db.select().from(postAttachments).where(and(eq(postAttachments.id, attachmentId), eq(postAttachments.postId, Number(purchase.targetId)), eq(postAttachments.accessType, "private"))).limit(1);
    if (!attachment) return Response.json({ error: "Không tìm thấy file thuộc giao dịch." }, { status: 404 });

    const object = await bucket().get(attachment.objectKey);
    if (!object) return Response.json({ error: "File không còn tồn tại trên kho lưu trữ." }, { status: 404 });
    const safeName = attachment.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const responseHeaders = new Headers();
    object.writeHttpMetadata(responseHeaders);
    responseHeaders.set("content-length", String(object.size));
    responseHeaders.set("cache-control", "private, no-store");
    responseHeaders.set("content-disposition", `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
    responseHeaders.set("x-content-type-options", "nosniff");
    responseHeaders.set("content-security-policy", "sandbox");
    return new Response(object.body, { headers: responseHeaders });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Không thể tải file bản vẽ.";
    return Response.json({ error: message }, { status: 500 });
  }
}
