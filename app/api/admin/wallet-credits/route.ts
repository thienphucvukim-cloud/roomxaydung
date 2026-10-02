import { env } from "cloudflare:workers";
import { requireAdmin } from "@/lib/admin-auth";
import { validOrigin } from "@/lib/website-auth";

type Credit = { reference: string; userId: string; amount: number; orderCode: number; reason: string; performedBy: string; createdAt: string };
const creditColumns = "reference, user_id AS userId, amount, order_code AS orderCode, reason, performed_by AS performedBy, created_at AS createdAt";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  try {
    const database = env.DB;
    if (!database) throw new Error("D1 chưa được cấu hình.");
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
    const [accounts, credits] = await Promise.all([
      database.prepare("SELECT user_id AS userId, display_name AS displayName, email, username FROM website_accounts WHERE instr(lower(display_name), lower(?)) > 0 OR instr(lower(coalesce(email, '')), lower(?)) > 0 OR instr(lower(coalesce(username, '')), lower(?)) > 0 OR instr(lower(user_id), lower(?)) > 0 ORDER BY display_name, user_id LIMIT 30").bind(query, query, query, query).all(),
      database.prepare(`SELECT ${creditColumns} FROM wallet_manual_credits ORDER BY created_at DESC, reference DESC LIMIT 100`).all<Credit>(),
    ]);
    return Response.json({ accounts: accounts.results, credits: credits.results });
  } catch {
    return Response.json({ error: "Chưa thể tải dữ liệu cộng tiền thủ công." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin.error || !admin.userId) return admin.error;
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  let body: { userId?: unknown; amount?: unknown; reason?: unknown; requestId?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  if (!body || typeof body.userId !== "string" || !body.userId.trim() || body.userId.length > 180
    || typeof body.amount !== "number" || !Number.isSafeInteger(body.amount) || body.amount < 1 || body.amount > 20_000_000
    || typeof body.reason !== "string" || !body.reason.trim() || body.reason.trim().length > 500
    || typeof body.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) {
    return Response.json({ error: "Chọn tài khoản, nhập số tiền nguyên từ 1đ đến 20.000.000đ, lý do tối đa 500 ký tự và mã yêu cầu hợp lệ." }, { status: 400 });
  }
  try {
    const database = env.DB;
    if (!database) throw new Error("D1 chưa được cấu hình.");
    const userId = body.userId.trim();
    const reason = body.reason.trim();
    const account = await database.prepare("SELECT user_id FROM website_accounts WHERE user_id = ?").bind(userId).first();
    if (!account) return Response.json({ error: "Không tìm thấy tài khoản người dùng." }, { status: 404 });
    const reference = `manual-credit:${body.requestId.toLowerCase()}`;
    const now = new Date().toISOString();
    const orderCode = Math.floor(Date.now() / 1000) * 1_000_000 + crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    // D1 batch commits the audit record and ledger entry together. Replays use
    // the original immutable record, never the new request's amount or user.
    const results = await database.batch([
      database.prepare("INSERT INTO wallet_manual_credits (reference, user_id, amount, order_code, reason, performed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(reference) DO NOTHING").bind(reference, userId, body.amount, orderCode, reason, admin.userId, now),
      database.prepare("INSERT INTO wallet_transactions (user_id, kind, amount, order_code, reference, target_type, target_id, seller_user_id, description, created_at) SELECT user_id, 'manual-credit', amount, order_code, reference, 'wallet-manual-credit', reference, NULL, 'Cộng tiền thủ công: ' || reason, created_at FROM wallet_manual_credits WHERE reference = ? ON CONFLICT(reference) DO NOTHING").bind(reference),
    ]);
    const credit = await database.prepare(`SELECT ${creditColumns} FROM wallet_manual_credits WHERE reference = ?`).bind(reference).first<Credit>();
    if (!credit || credit.userId !== userId || credit.amount !== body.amount || credit.reason !== reason || credit.performedBy !== admin.userId) {
      return Response.json({ error: "Mã yêu cầu đã được dùng cho giao dịch khác. Tải lại lịch sử để đối soát." }, { status: 409 });
    }
    return Response.json({ ok: true, credit, replayed: !results[0].meta.changes }, { status: results[0].meta.changes ? 201 : 200 });
  } catch {
    return Response.json({ error: "Chưa thể xác nhận cộng tiền. Hãy gửi lại cùng yêu cầu hoặc tải lại lịch sử để kiểm tra." }, { status: 500 });
  }
}
