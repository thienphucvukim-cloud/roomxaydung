import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getDb } from "../../../../db";
import { paymentOrders, postAttachments } from "../../../../db/schema";
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
    if (Math.floor(Date.now() / 1000) > expires) return Response.json({ error: "Liên kết tải đã hết hạn. Vui lòng liên hệ người bán để được hỗ trợ." }, { status: 410 });

    const userId = (await headers()).get("oai-authenticated-user-id") ?? "private-member";
    if (!(await verifyDownloadToken(orderCode, attachmentId, expires, userId, token))) return Response.json({ error: "Liên kết tải không thuộc tài khoản này." }, { status: 403 });
    const db = getDb();
    const [order] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.orderCode, orderCode), eq(paymentOrders.buyerUserId, userId), eq(paymentOrders.status, "paid"))).limit(1);
    if (!order || order.targetType !== "post" || !/^\d+$/.test(order.targetId)) return Response.json({ error: "Đơn hàng chưa được thanh toán hoặc không hợp lệ." }, { status: 403 });
    const [attachment] = await db.select().from(postAttachments).where(and(eq(postAttachments.id, attachmentId), eq(postAttachments.postId, Number(order.targetId)), eq(postAttachments.accessType, "private"))).limit(1);
    if (!attachment) return Response.json({ error: "Không tìm thấy file thuộc đơn hàng." }, { status: 404 });

    const object = await bucket().get(attachment.objectKey);
    if (!object) return Response.json({ error: "File không còn tồn tại trên kho lưu trữ." }, { status: 404 });
    const safeName = attachment.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const responseHeaders = new Headers();
    object.writeHttpMetadata(responseHeaders);
    responseHeaders.set("content-length", String(object.size));
    responseHeaders.set("cache-control", "private, no-store");
    responseHeaders.set("content-disposition", `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
    return new Response(object.body, { headers: responseHeaders });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Không thể tải file bản vẽ.";
    return Response.json({ error: message }, { status: 500 });
  }
}