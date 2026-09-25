import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { paymentOrders, posts } from "../../../../db/schema";
import { drawings, parseVndPrice } from "../../../../lib/drawing-catalog";
import { createPayosSignature, getPayosConfig } from "../../../../lib/payos";

async function currentMember() {
  const h = await headers();
  const encodedName = h.get("oai-authenticated-user-full-name");
  const email = h.get("oai-authenticated-user-email");
  return {
    userId: h.get("oai-authenticated-user-id") ?? "private-member",
    buyerName: encodedName && h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8" ? decodeURIComponent(encodedName) : email?.split("@")[0] ?? "Thành viên Tipook",
    buyerEmail: email ?? null,
  };
}

async function resolveProduct(targetType: string, targetId: string) {
  if (targetType === "drawing") {
    const index = drawings.findIndex((drawing) => drawing.title === targetId);
    const drawing = drawings[index];
    if (!drawing) return null;
    return { title: drawing.title, amount: drawing.amount, sellerUserId: drawing.authorId };
  }
  if (targetType === "post" && /^\d+$/.test(targetId)) {
    const [post] = await getDb().select({ title: posts.title, userId: posts.userId, category: posts.category, price: posts.pollQuestion }).from(posts).where(eq(posts.id, Number(targetId))).limit(1);
    const amount = parseVndPrice(post?.price);
    if (!post || post.category !== "Bản vẽ cộng đồng" || !amount) return null;
    return { title: post.title, amount, sellerUserId: post.userId };
  }
  return null;
}

export async function POST(request: Request) {
  const db = getDb();
  let orderCode = 0;
  try {
    const body = await request.json() as { targetType?: unknown; targetId?: unknown };
    const targetType = body.targetType === "drawing" || body.targetType === "post" ? body.targetType : "";
    const targetId = typeof body.targetId === "string" ? body.targetId.trim().slice(0, 180) : "";
    if (!targetType || !targetId) return Response.json({ error: "Sản phẩm không hợp lệ." }, { status: 400 });

    const product = await resolveProduct(targetType, targetId);
    if (!product) return Response.json({ error: "Bản vẽ chưa có giá hợp lệ hoặc không còn tồn tại." }, { status: 404 });
    const member = await currentMember();
    const config = getPayosConfig();
    const bindings = env as unknown as Record<string, string | undefined>;
    const origin = (bindings.PAYOS_RETURN_URL_BASE || new URL(request.url).origin).replace(/\/$/, "");
    const returnUrl = `${origin}/thanh-toan/ket-qua`;
    const cancelUrl = `${origin}/thanh-toan/ket-qua`;
    orderCode = Date.now();
    const description = `TIPOOK ${String(orderCode).slice(-10)}`;
    const signature = await createPayosSignature({ amount: product.amount, cancelUrl, description, orderCode, returnUrl }, config.checksumKey);

    await db.insert(paymentOrders).values({
      orderCode,
      buyerUserId: member.userId,
      buyerName: member.buyerName,
      buyerEmail: member.buyerEmail,
      sellerUserId: product.sellerUserId,
      targetType,
      targetId,
      productTitle: product.title,
      amount: product.amount,
      status: "pending",
    });

    const response = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-client-id": config.clientId, "x-api-key": config.apiKey },
      body: JSON.stringify({
        orderCode,
        amount: product.amount,
        description,
        buyerName: member.buyerName,
        buyerEmail: member.buyerEmail || undefined,
        items: [{ name: product.title.slice(0, 100), quantity: 1, price: product.amount }],
        cancelUrl,
        returnUrl,
        expiredAt: Math.floor(Date.now() / 1000) + 30 * 60,
        signature,
      }),
    });
    const result = await response.json() as { code?: string; desc?: string; data?: { paymentLinkId?: string; checkoutUrl?: string } };
    if (!response.ok || result.code !== "00" || !result.data?.checkoutUrl) throw new Error(result.desc || "payOS chưa thể tạo giao dịch.");
    await db.update(paymentOrders).set({ paymentLinkId: result.data.paymentLinkId ?? null, checkoutUrl: result.data.checkoutUrl, updatedAt: new Date().toISOString() }).where(eq(paymentOrders.orderCode, orderCode));
    return Response.json({ checkoutUrl: result.data.checkoutUrl, orderCode }, { status: 201 });
  } catch (cause) {
    if (orderCode) await db.update(paymentOrders).set({ status: "failed", updatedAt: new Date().toISOString() }).where(eq(paymentOrders.orderCode, orderCode)).catch(() => {});
    const message = cause instanceof Error ? cause.message : "Chưa thể tạo giao dịch thanh toán.";
    return Response.json({ error: message }, { status: message.includes("PAYOS_") || message.includes("chưa được cấu hình") ? 503 : 500 });
  }
}