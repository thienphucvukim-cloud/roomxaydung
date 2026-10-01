import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getDb } from "../../../../db";
import { walletTopupRequests, walletTransactions } from "../../../../db/schema";

async function requireAdmin() {
  const bindings = env as unknown as Record<string, string | undefined>;
  const expected = bindings.TIPOOK_ADMIN_USER_ID?.trim();
  const expectedEmail = bindings.TIPOOK_ADMIN_EMAIL?.trim().toLowerCase();
  const actual = (await headers()).get("oai-authenticated-user-id")?.trim();
  const email = (await headers()).get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!expected && !expectedEmail) return { error: Response.json({ error: "Chưa cấu hình tài khoản quản trị." }, { status: 503 }) };
  if (!actual) return { error: Response.json({ error: "Vui lòng đăng nhập tài khoản quản trị." }, { status: 401 }) };
  if (!((expected && actual === expected) || (expectedEmail && email === expectedEmail))) return { error: Response.json({ error: "Bạn không có quyền quản trị." }, { status: 403 }) };
  return { userId: actual };
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  try {
    const db = getDb();
    const [requests, purchases] = await Promise.all([
      db.select().from(walletTopupRequests).orderBy(desc(walletTopupRequests.createdAt)).limit(100),
      db.select().from(walletTransactions).where(eq(walletTransactions.kind, "purchase")).orderBy(desc(walletTransactions.createdAt)).limit(100),
    ]);
    return Response.json({ requests, purchases });
  } catch {
    return Response.json({ error: "Chưa thể tải dữ liệu đối soát." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (admin.error || !admin.userId) return admin.error;
  try {
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin && requestOrigin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
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
