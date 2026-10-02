import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/admin-auth";
import { validOrigin } from "../../../../lib/website-auth";
import { getDb } from "../../../../db";
import { walletTopupRequests, walletTransactions } from "../../../../db/schema";
import { saleAdminPercent, withdrawalColumns } from "@/lib/seller-wallet";

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  try {
    const db = getDb();
    const database = env.DB;
    if (!database) throw new Error("D1 chưa được cấu hình.");
    const [requests, purchases, credits, withdrawals, adminPercent] = await Promise.all([
      db.select().from(walletTopupRequests).orderBy(desc(walletTopupRequests.createdAt)).limit(100),
      db.select().from(walletTransactions).where(eq(walletTransactions.kind, "purchase")).orderBy(desc(walletTransactions.createdAt)).limit(100),
      database.prepare("SELECT purchase_id AS purchaseId, amount, gross_amount AS grossAmount, admin_percent AS adminPercent, reviewed_by AS reviewedBy, created_at AS createdAt, revoked_by AS revokedBy, revoked_at AS revokedAt, revocation_reason AS revocationReason FROM wallet_sale_credits WHERE purchase_id IN (SELECT id FROM wallet_transactions WHERE kind = 'purchase' ORDER BY created_at DESC LIMIT 100)").all(),
      database.prepare(`SELECT ${withdrawalColumns} FROM wallet_withdrawals ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100`).all(),
      saleAdminPercent(database),
    ]);
    return Response.json({ requests, purchases: purchases.map(purchase => ({ ...purchase, saleCredit: credits.results.find(credit => credit.purchaseId === purchase.id) ?? null })), withdrawals: withdrawals.results, adminPercent });
  } catch {
    return Response.json({ error: "Chưa thể tải dữ liệu đối soát." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (admin.error || !admin.userId) return admin.error;
  try {
    if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
    const body = await request.json() as { id?: unknown; status?: unknown };
    const id = Number(body.id);
    const status = body.status === "approved" || body.status === "rejected" ? body.status : "";
    if (!Number.isSafeInteger(id) || !status) return Response.json({ error: "Dữ liệu duyệt không hợp lệ." }, { status: 400 });

    const db = getDb();
    const [topup] = await db.select().from(walletTopupRequests).where(eq(walletTopupRequests.id, id)).limit(1);
    if (!topup) return Response.json({ error: "Không tìm thấy yêu cầu nạp." }, { status: 404 });
    if (topup.status !== "pending") return Response.json({ error: "Yêu cầu này đã được xử lý." }, { status: 409 });

    const now = new Date().toISOString();
    const database = env.DB;
    if (!database) throw new Error("D1 chưa được cấu hình.");
    if (status === "approved") {
      const orderCode = Math.floor(Date.now() / 1000) * 1_000_000 + crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
      const results = await database.batch([
        database.prepare("INSERT INTO wallet_transactions (user_id, kind, amount, order_code, reference, target_type, target_id, seller_user_id, description, created_at) SELECT ?, 'topup', ?, ?, ?, 'wallet-topup', ?, NULL, ?, ? WHERE EXISTS (SELECT 1 FROM wallet_topup_requests WHERE id = ? AND status = 'pending')").bind(topup.userId, topup.amount, orderCode, `topup:${topup.requestCode}`, topup.requestCode, `Nạp tiền #${topup.requestCode}`, now, topup.id),
        database.prepare("UPDATE wallet_topup_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(admin.userId, now, now, topup.id),
      ]);
      if (!results[1].meta.changes) return Response.json({ error: "Yêu cầu này đã được xử lý." }, { status: 409 });
    } else {
      const result = await database.prepare("UPDATE wallet_topup_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(admin.userId, now, now, topup.id).run();
      if (!result.meta.changes) return Response.json({ error: "Yêu cầu này đã được xử lý." }, { status: 409 });
    }
    return Response.json({ ok: true, status });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Chưa thể xử lý yêu cầu nạp tiền.";
    return Response.json({ error: message }, { status: 500 });
  }
}
