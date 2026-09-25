import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../../db";
import { paymentOrders } from "../../../../db/schema";

export async function GET(request: Request) {
  try {
    const orderCode = Number(new URL(request.url).searchParams.get("orderCode"));
    if (!Number.isSafeInteger(orderCode)) return Response.json({ error: "Mã đơn hàng không hợp lệ." }, { status: 400 });
    const h = await headers();
    const userId = h.get("oai-authenticated-user-id") ?? "private-member";
    const [order] = await getDb().select({ orderCode: paymentOrders.orderCode, productTitle: paymentOrders.productTitle, amount: paymentOrders.amount, status: paymentOrders.status, paidAt: paymentOrders.paidAt }).from(paymentOrders).where(and(eq(paymentOrders.orderCode, orderCode), eq(paymentOrders.buyerUserId, userId))).limit(1);
    if (!order) return Response.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    return Response.json({ order });
  } catch {
    return Response.json({ error: "Chưa thể kiểm tra trạng thái đơn hàng." }, { status: 500 });
  }
}