import { memberAccessResponse } from "@/lib/member-access";
import { env } from "cloudflare:workers";
import { getPaymentBuyerId } from "../../../lib/payment-identity";
import { FILE_CATALOG_PAGE_SIZE, PROMOTION_CATEGORIES, promotionExpiry, promotionMonthlyPrice } from "../../../lib/catalog-promotions";

export async function GET(request: Request) {
  try {
    const category = new URL(request.url).searchParams.get("category") || "";
    if (!PROMOTION_CATEGORIES.some(value => value === category)) return Response.json({ error: "Danh mục không hợp lệ." }, { status: 400 });
    const database = env.DB;
    if (!database) throw new Error("D1 chưa được cấu hình.");
    const userId = await getPaymentBuyerId();
    const now = new Date().toISOString();
    const [active, owned] = await Promise.all([
      database.prepare(`SELECT cp.post_id AS postId, cp.position, cp.expires_at AS expiresAt FROM catalog_promotions cp JOIN posts p ON p.id = cp.post_id WHERE cp.category = ? AND cp.starts_at <= ? AND cp.expires_at > ? AND p.audience = 'Công khai' AND p.category = cp.category`).bind(category, now, now).all(),
      database.prepare("SELECT id, title FROM posts WHERE user_id = ? AND category = ? AND audience = 'Công khai' ORDER BY created_at DESC").bind(userId || "", category).all(),
    ]);
    return Response.json({ active: active.results, owned: owned.results, positions: Array.from({ length: FILE_CATALOG_PAGE_SIZE }, (_, index) => ({ position: index + 1, monthlyPrice: promotionMonthlyPrice(index + 1) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Chưa thể tải vị trí quảng cáo." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
    const userId = await getPaymentBuyerId();
    if (!userId) return Response.json({ error: "Vui lòng đăng nhập để chạy quảng cáo." }, { status: 401 });
    const body = await request.json() as { postId?: number; position?: number; months?: number; purchaseId?: string };
    const { postId, position, months, purchaseId } = body;
    if (!Number.isSafeInteger(postId) || !postId || !Number.isInteger(position) || !position || position < 1 || position > 16 || !Number.isInteger(months) || !months || months < 1 || months > 12 || typeof purchaseId !== "string" || !/^[0-9a-f-]{36}$/i.test(purchaseId)) return Response.json({ error: "Thông tin quảng cáo không hợp lệ." }, { status: 400 });
    const database = env.DB;
    if (!database) throw new Error("D1 chưa được cấu hình.");
    const reference = `promotion:${userId}:${purchaseId}`;
    const prior = await database.prepare("SELECT post_id AS postId, position, expires_at AS expiresAt FROM catalog_promotions WHERE reference = ?").bind(reference).first();
    if (prior) return Response.json({ ok: true, promotion: prior });
    const post = await database.prepare("SELECT category, title FROM posts WHERE id = ? AND user_id = ? AND audience = 'Công khai'").bind(postId, userId).first<{ category: string; title: string }>();
    if (!post || !PROMOTION_CATEGORIES.some(value => value === post.category)) return Response.json({ error: "Bạn chỉ có thể quảng cáo hồ sơ công khai của mình." }, { status: 403 });
    const now = new Date();
    const startsAt = now.toISOString();
    const expiresAt = promotionExpiry(now, months);
    const amount = promotionMonthlyPrice(position) * months;
    const orderCode = Math.floor(Date.now() / 1000) * 1_000_000 + crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    // D1 batch commits both statements atomically. The guarded debit serializes slot
    // allocation and wallet spending; retries share the same unique reference.
    const results = await database.batch([
      database.prepare(`INSERT INTO wallet_transactions (user_id, kind, amount, order_code, reference, target_type, target_id, description, created_at)
        SELECT ?, 'promotion', ?, ?, ?, 'post', ?, ?, ?
        WHERE (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE user_id = ? AND wallet = 'deposit') >= ?
        AND NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE reference = ?)
        AND EXISTS (SELECT 1 FROM posts WHERE id = ? AND user_id = ? AND audience = 'Công khai' AND category = ?)
        AND NOT EXISTS (SELECT 1 FROM catalog_promotions cp JOIN posts p ON p.id = cp.post_id WHERE cp.expires_at > ? AND p.audience = 'Công khai' AND p.category = cp.category AND ((cp.category = ? AND cp.position = ?) OR cp.post_id = ?))`)
        .bind(userId, -amount, orderCode, reference, String(postId), `Quảng cáo ${post.title} · vị trí ${position} · ${months} tháng`, startsAt, userId, amount, reference, postId, userId, post.category, startsAt, post.category, position, postId),
      database.prepare(`INSERT INTO catalog_promotions (post_id, user_id, category, position, months, amount, reference, starts_at, expires_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM wallet_transactions WHERE reference = ? AND user_id = ?)
        AND NOT EXISTS (SELECT 1 FROM catalog_promotions WHERE reference = ?)`)
        .bind(postId, userId, post.category, position, months, amount, reference, startsAt, expiresAt, reference, userId, reference),
    ]);
    if (!results[0].meta.changes) {
      const existing = await database.prepare("SELECT post_id AS postId, position, expires_at AS expiresAt FROM catalog_promotions WHERE reference = ?").bind(reference).first();
      if (existing) return Response.json({ ok: true, promotion: existing });
      const conflict = await database.prepare(`SELECT cp.id FROM catalog_promotions cp JOIN posts p ON p.id = cp.post_id WHERE cp.expires_at > ? AND p.audience = 'Công khai' AND p.category = cp.category AND ((cp.category = ? AND cp.position = ?) OR cp.post_id = ?)`).bind(startsAt, post.category, position, postId).first();
      if (conflict) return Response.json({ error: "Vị trí đã được đặt hoặc hồ sơ đang chạy quảng cáo. Vui lòng chọn lại." }, { status: 409 });
      return Response.json({ error: "Số dư ví không đủ hoặc hồ sơ đã thay đổi. Vui lòng kiểm tra lại.", required: amount }, { status: 402 });
    }
    return Response.json({ ok: true, promotion: { postId, position, startsAt, expiresAt, amount } }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể bật quảng cáo. Vui lòng thử lại." }, { status: 500 });
  }
}
