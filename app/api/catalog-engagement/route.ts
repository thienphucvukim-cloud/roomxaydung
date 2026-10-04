import { getDb } from "@/db";
import { catalogRatings, catalogViews } from "@/db/schema";
import { catalogEngagement, resolveCatalogTarget } from "@/lib/catalog-engagement";
import { attachPaymentBuyerCookie, getOrCreatePaymentBuyerId, getPaymentBuyerId } from "@/lib/payment-identity";
import { getAuthenticatedIdentity } from "@/lib/website-auth";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const target = await resolveCatalogTarget(params.get("targetType"), params.get("targetId"));
    if (!target) return Response.json({ error: "Nội dung không tồn tại." }, { status: 404 });
    return Response.json(await catalogEngagement(target, await getPaymentBuyerId()), { headers });
  } catch {
    return Response.json({ error: "Chưa thể tải thống kê." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { targetType?: unknown; targetId?: unknown; action?: unknown; rating?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  if (!body || typeof body.action !== "string" || !["view", "rate"].includes(body.action)) return Response.json({ error: "Hành động không hợp lệ." }, { status: 400 });
  if (body.action === "rate" && (typeof body.rating !== "number" || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)) {
    return Response.json({ error: "Vui lòng chọn từ 1 đến 5 sao." }, { status: 400 });
  }
  try {
    const target = await resolveCatalogTarget(body.targetType, body.targetId);
    if (!target) return Response.json({ error: "Nội dung không tồn tại." }, { status: 404 });
    if ((body.action === "view" && target.kind !== "house-model" && !("canView" in target && target.canView)) || (body.action === "rate" && target.kind !== "file")) {
      return Response.json({ error: "Hành động không áp dụng cho nội dung này." }, { status: 400 });
    }
    if (body.action === "view") {
      const { userId } = await getOrCreatePaymentBuyerId();
      await getDb().insert(catalogViews).values({ targetType: target.targetType, targetId: target.targetId, userId }).onConflictDoNothing();
      return attachPaymentBuyerCookie(Response.json(await catalogEngagement(target, userId), { headers }), request, userId);
    }
    const identity = await getAuthenticatedIdentity();
    if (!identity) return Response.json({ error: "Vui lòng đăng nhập để đánh giá sao." }, { status: 401 });
    await getDb().insert(catalogRatings).values({ targetType: target.targetType, targetId: target.targetId, userId: identity.userId, rating: body.rating as number }).onConflictDoUpdate({
      target: [catalogRatings.targetType, catalogRatings.targetId, catalogRatings.userId],
      set: { rating: body.rating as number, updatedAt: new Date().toISOString() },
    });
    return Response.json(await catalogEngagement(target, identity.userId), { headers });
  } catch {
    return Response.json({ error: "Chưa thể lưu thống kê. Vui lòng thử lại." }, { status: 500 });
  }
}
