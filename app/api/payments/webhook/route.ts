import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { directMessages, paymentOrders, postAttachments } from "../../../../db/schema";
import { getPayosConfig, type SignatureValue, verifyPayosSignature } from "../../../../lib/payos";
import { createDownloadToken } from "../../../../lib/download-links";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { success?: boolean; data?: Record<string, SignatureValue>; signature?: string };
    if (!body.data || typeof body.signature !== "string") return Response.json({ error: "Webhook không hợp lệ." }, { status: 400 });
    const { checksumKey } = getPayosConfig();
    if (!(await verifyPayosSignature(body.data, body.signature, checksumKey))) return Response.json({ error: "Chữ ký webhook không hợp lệ." }, { status: 400 });

    const orderCode = Number(body.data.orderCode);
    const paidAmount = Number(body.data.amount);
    if (!Number.isSafeInteger(orderCode) || !Number.isSafeInteger(paidAmount)) return Response.json({ error: "Dữ liệu giao dịch không hợp lệ." }, { status: 400 });
    const db = getDb();
    const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.orderCode, orderCode)).limit(1);
    if (!order) return Response.json({ success: true });
    if (order.amount !== paidAmount) return Response.json({ error: "Số tiền thanh toán không khớp đơn hàng." }, { status: 400 });

    const paymentCode = String(body.data.code ?? "");
    if (body.success && paymentCode === "00" && order.status !== "paid") {
      const paidAt = new Date().toISOString();
      const reference = String(body.data.reference ?? "").slice(0, 180) || null;
      await db.update(paymentOrders).set({ status: "paid", transactionReference: reference, paidAt, updatedAt: paidAt }).where(eq(paymentOrders.orderCode, orderCode));
      const subject = `Đã thanh toán đơn #${orderCode}`;
      let buyerContent = `Thanh toán ${order.amount.toLocaleString("vi-VN")}đ cho “${order.productTitle}” đã được xác nhận.`;
      if (order.targetType === "post" && /^\d+$/.test(order.targetId)) {
        const files = await db.select().from(postAttachments).where(and(eq(postAttachments.postId, Number(order.targetId)), eq(postAttachments.accessType, "private")));
        if (files.length) {
          const expires = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
          const bindings = env as unknown as Record<string, string | undefined>;
          const origin = (bindings.PAYOS_RETURN_URL_BASE || new URL(request.url).origin).replace(/\/$/, "");
          const links = await Promise.all(files.map(async (file) => {
            const token = await createDownloadToken(orderCode, file.id, expires, order.buyerUserId);
            const query = new URLSearchParams({ order: String(orderCode), file: String(file.id), expires: String(expires), token });
            return `${file.fileName}: ${origin}/api/downloads/drawing?${query.toString()}`;
          }));
          buyerContent += `\n\nLiên kết tải file (hết hạn sau 24 giờ):\n${links.join("\n")}`;
        } else buyerContent += " Người bán sẽ gửi file qua tin nhắn nội bộ.";
      } else buyerContent += " Người bán sẽ gửi file qua tin nhắn nội bộ.";
      await db.insert(directMessages).values([
        { senderUserId: "tipook-payments", senderName: "Thanh toán Tipook", recipientUserId: order.buyerUserId, subject, content: buyerContent },
        { senderUserId: "tipook-payments", senderName: "Thanh toán Tipook", recipientUserId: order.sellerUserId, subject, content: `Bạn có đơn đã thanh toán cho “${order.productTitle}”. Hệ thống đã cấp link tải 24 giờ cho người mua ${order.buyerName}.` },
      ]);
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Không thể xử lý webhook thanh toán." }, { status: 500 });
  }
}