import { env } from "cloudflare:workers";
import { requireAdmin } from "@/lib/admin-auth";
import { validOrigin } from "@/lib/website-auth";
import { creditSale, revokeSale, reviewWithdrawal, validAdminPercent, validWalletRequestId, WalletError } from "@/lib/seller-wallet";

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (admin.error || !admin.userId) return admin.error;
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  let body: Record<string, unknown> | null;
  try { body = await request.json() as Record<string, unknown> | null; }
  catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  if (!body) return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  try {
    const database = env.DB;
    if (!database) throw new Error("D1 chưa được cấu hình.");
    if (body.action === "commission") {
      if (!validAdminPercent(body.adminPercent)) throw new WalletError("Phí admin phải là số nguyên từ 0% đến 99%.", 400);
      await database.prepare("UPDATE wallet_sale_settings SET admin_percent = ?, updated_by = ?, updated_at = ? WHERE id = 1").bind(body.adminPercent, admin.userId, new Date().toISOString()).run();
      return Response.json({ ok: true, adminPercent: body.adminPercent });
    }
    if (body.action === "credit") {
      if (typeof body.purchaseId !== "number" || !Number.isSafeInteger(body.purchaseId) || body.purchaseId < 1) throw new WalletError("Mã đơn không hợp lệ.", 400);
      if (body.adminPercent !== undefined && !validAdminPercent(body.adminPercent)) throw new WalletError("Tỷ lệ phí không hợp lệ.", 400);
      return Response.json(await creditSale(database, body.purchaseId, admin.userId, body.adminPercent as number | undefined));
    }
    if (body.action === "revoke") {
      const note = typeof body.note === "string" ? body.note.trim() : "";
      if (typeof body.purchaseId !== "number" || !Number.isSafeInteger(body.purchaseId) || body.purchaseId < 1 || !note || note.length > 500) throw new WalletError("Chọn đơn đã cộng và nhập lý do thu hồi (tối đa 500 ký tự).", 400);
      return Response.json(await revokeSale(database, body.purchaseId, note, admin.userId));
    }
    if (body.action === "review" && validWalletRequestId(body.id) && (body.status === "paid" || body.status === "rejected")) {
      const note = typeof body.note === "string" ? body.note.trim() : "";
      if (!note || note.length > 500) throw new WalletError("Nhập mã giao dịch chuyển khoản khi đã thanh toán hoặc lý do từ chối (tối đa 500 ký tự).", 400);
      return Response.json(await reviewWithdrawal(database, body.id.toLowerCase(), body.status, note, admin.userId));
    }
    throw new WalletError("Thao tác không hợp lệ.", 400);
  } catch (cause) {
    return Response.json({ error: cause instanceof WalletError ? cause.message : "Chưa thể xử lý. Tải lại lịch sử hoặc gửi lại cùng yêu cầu để kiểm tra." }, { status: cause instanceof WalletError ? cause.status : 500 });
  }
}
