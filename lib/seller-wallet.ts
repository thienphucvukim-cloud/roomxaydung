import type { D1Database } from "@cloudflare/workers-types";

export class WalletError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export type Withdrawal = { id: string; userId: string; amount: number; bankName: string; accountNumber: string; accountName: string; status: string; reviewNote: string | null; reviewedBy: string | null; reviewedAt: string | null; createdAt: string };
export const withdrawalColumns = "id, user_id AS userId, amount, bank_name AS bankName, account_number AS accountNumber, account_name AS accountName, status, review_note AS reviewNote, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, created_at AS createdAt";
export const walletOrderCode = () => Math.floor(Date.now() / 1000) * 1_000_000 + crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
export const validWalletRequestId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const validWalletAmount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 20_000_000;
export const SALES_HOLD_MS = 36 * 60 * 60 * 1000;
export const salesCutoff = () => new Date(Date.now() - SALES_HOLD_MS).toISOString();
// The debit and maturity check run together inside the atomic batch.
const availableSalesSql = `(SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE user_id = ? AND wallet = 'sales')
  - (SELECT COALESCE(SUM(amount), 0) FROM wallet_sale_credits WHERE seller_user_id = ? AND revoked_at IS NULL AND created_at > ?)`;

export const validAdminPercent = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99;
export async function saleAdminPercent(database: D1Database) {
  const settings = await database.prepare("SELECT admin_percent AS adminPercent FROM wallet_sale_settings WHERE id = 1").first<{ adminPercent: number }>();
  if (!settings || !validAdminPercent(settings.adminPercent)) throw new Error("Chưa có cấu hình phí bán file.");
  return settings.adminPercent;
}

export async function creditSale(database: D1Database, purchaseId: number, adminId: string, expectedAdminPercent?: number) {
  const purchase = await database.prepare("SELECT seller_user_id AS sellerUserId, amount FROM wallet_transactions WHERE id = ? AND kind = 'purchase' AND wallet = 'deposit'").bind(purchaseId).first<{ sellerUserId: string | null; amount: number }>();
  if (!purchase) throw new WalletError("Không tìm thấy đơn mua file.", 404);
  if (!purchase.sellerUserId || purchase.amount >= 0) throw new WalletError("Đơn này không có tiền bán file để cộng.", 400);
  const prior = await database.prepare("SELECT amount, admin_percent AS adminPercent FROM wallet_sale_credits WHERE purchase_id = ?").bind(purchaseId).first<{ amount: number; adminPercent: number }>();
  if (prior) return { ok: true, replayed: true, ...prior };
  const adminPercent = await saleAdminPercent(database);
  if (expectedAdminPercent !== undefined && expectedAdminPercent !== adminPercent) throw new WalletError("Tỷ lệ phí đã thay đổi. Tải lại dữ liệu để kiểm tra số tiền trước khi cộng.", 409);
  const amount = Math.floor(-purchase.amount * (100 - adminPercent) / 100);
  if (amount < 1) throw new WalletError("Số tiền người bán nhận sau phí phải từ 1đ.", 400);
  const now = new Date().toISOString();
  const reference = `sale:${purchaseId}`;
  const results = await database.batch([
    database.prepare(`INSERT INTO wallet_sale_credits (purchase_id, seller_user_id, amount, reviewed_by, created_at, admin_percent, gross_amount)
      SELECT id, seller_user_id, ?, ?, ?, ?, -amount FROM wallet_transactions
      WHERE id = ? AND kind = 'purchase' AND wallet = 'deposit' AND amount < 0 AND seller_user_id IS NOT NULL
      AND (SELECT admin_percent FROM wallet_sale_settings WHERE id = 1) = ?
      ON CONFLICT(purchase_id) DO NOTHING`).bind(amount, adminId, now, adminPercent, purchaseId, adminPercent),
    database.prepare(`INSERT INTO wallet_transactions (user_id, wallet, kind, amount, order_code, reference, target_type, target_id, seller_user_id, description, created_at)
      SELECT c.seller_user_id, 'sales', 'sale-credit', c.amount, ?, ?, p.target_type, p.target_id, c.seller_user_id, 'Tiền bán file đơn #' || p.order_code, c.created_at
      FROM wallet_sale_credits c JOIN wallet_transactions p ON p.id = c.purchase_id WHERE c.purchase_id = ?
      ON CONFLICT(reference) DO NOTHING`).bind(walletOrderCode(), reference, purchaseId),
  ]);
  const credit = await database.prepare("SELECT amount, admin_percent AS adminPercent FROM wallet_sale_credits WHERE purchase_id = ?").bind(purchaseId).first<{ amount: number; adminPercent: number }>();
  if (!credit) throw new WalletError("Tỷ lệ phí đã thay đổi. Tải lại dữ liệu trước khi cộng.", 409);
  return { ok: true, replayed: !results[0].meta.changes, ...credit };
}

export async function transferSales(database: D1Database, userId: string, requestId: string, amount: number) {
  const reference = `sales-transfer:${userId}:${requestId.toLowerCase()}`;
  const now = new Date().toISOString();
  const results = await database.batch([
    database.prepare(`INSERT INTO wallet_transactions (user_id, wallet, kind, amount, order_code, reference, description, created_at)
      SELECT ?, 'sales', 'transfer-out', ?, ?, ?, 'Chuyển sang ví nạp', ?
      WHERE ${availableSalesSql} >= ?
      AND NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE reference = ?)`)
      .bind(userId, -amount, walletOrderCode(), reference, now, userId, userId, salesCutoff(), amount, reference),
    database.prepare(`INSERT INTO wallet_transactions (user_id, wallet, kind, amount, order_code, reference, description, created_at)
      SELECT user_id, 'deposit', 'transfer-in', -amount, ?, reference || ':deposit', 'Nhận từ ví bán file', created_at
      FROM wallet_transactions WHERE reference = ? AND user_id = ? AND wallet = 'sales' AND kind = 'transfer-out'
      ON CONFLICT(reference) DO NOTHING`).bind(walletOrderCode(), reference, userId),
  ]);
  const debit = await database.prepare("SELECT amount FROM wallet_transactions WHERE reference = ? AND user_id = ?").bind(reference, userId).first<{ amount: number }>();
  if (!debit) throw new WalletError("Số dư tiền bán file đã đủ 36 giờ không đủ.", 402);
  if (debit.amount !== -amount) throw new WalletError("Mã yêu cầu đã dùng cho số tiền khác.", 409);
  return { ok: true, replayed: !results[0].meta.changes };
}

export async function requestWithdrawal(database: D1Database, userId: string, requestId: string, amount: number, bank: { bankName: string; accountNumber: string; accountName: string }) {
  if (amount < 50_000) throw new WalletError("Số tiền rút tối thiểu là 50.000đ.", 400);
  const id = requestId.toLowerCase();
  const reference = `withdrawal:${id}`;
  const results = await database.batch([
    database.prepare(`INSERT INTO wallet_withdrawals (id, user_id, amount, bank_name, account_number, account_name, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${availableSalesSql} >= ?
      ON CONFLICT(id) DO NOTHING`).bind(id, userId, amount, bank.bankName, bank.accountNumber, bank.accountName, new Date().toISOString(), userId, userId, salesCutoff(), amount),
    database.prepare(`INSERT INTO wallet_transactions (user_id, wallet, kind, amount, order_code, reference, target_type, target_id, description, created_at)
      SELECT user_id, 'sales', 'withdrawal-hold', -amount, ?, ?, 'wallet-withdrawal', id, 'Giữ tiền cho yêu cầu rút #' || substr(id, 1, 8), created_at
      FROM wallet_withdrawals WHERE id = ? AND user_id = ? ON CONFLICT(reference) DO NOTHING`).bind(walletOrderCode(), reference, id, userId),
  ]);
  const withdrawal = await database.prepare(`SELECT ${withdrawalColumns} FROM wallet_withdrawals WHERE id = ?`).bind(id).first<Withdrawal>();
  if (!withdrawal) throw new WalletError("Số dư tiền bán file đã đủ 36 giờ không đủ.", 402);
  if (withdrawal.userId !== userId || withdrawal.amount !== amount || withdrawal.bankName !== bank.bankName || withdrawal.accountNumber !== bank.accountNumber || withdrawal.accountName !== bank.accountName) throw new WalletError("Mã yêu cầu đã được dùng. Hãy tải lại lịch sử để kiểm tra.", 409);
  return { ok: true, withdrawal, replayed: !results[0].meta.changes };
}

export async function reviewWithdrawal(database: D1Database, id: string, status: "paid" | "rejected", note: string, adminId: string) {
  const prior = await database.prepare(`SELECT ${withdrawalColumns} FROM wallet_withdrawals WHERE id = ?`).bind(id).first<Withdrawal>();
  if (!prior) throw new WalletError("Không tìm thấy yêu cầu rút tiền.", 404);
  if (prior.status !== "pending") {
    if (prior.status === status && prior.reviewNote === note && prior.reviewedBy === adminId) return { ok: true, replayed: true };
    throw new WalletError("Yêu cầu đã được xử lý.", 409);
  }
  const now = new Date().toISOString();
  const statements = [];
  if (status === "rejected") statements.push(database.prepare(`INSERT INTO wallet_transactions (user_id, wallet, kind, amount, order_code, reference, target_type, target_id, description, created_at)
    SELECT user_id, 'sales', 'withdrawal-refund', amount, ?, 'withdrawal-refund:' || id, 'wallet-withdrawal', id, 'Hoàn tiền yêu cầu rút bị từ chối: ' || ?, ?
    FROM wallet_withdrawals WHERE id = ? AND status = 'pending' ON CONFLICT(reference) DO NOTHING`).bind(walletOrderCode(), note, now, id));
  statements.push(database.prepare("UPDATE wallet_withdrawals SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'").bind(status, note, adminId, now, id));
  const results = await database.batch(statements);
  if (!results[results.length - 1].meta.changes) {
    const current = await database.prepare(`SELECT ${withdrawalColumns} FROM wallet_withdrawals WHERE id = ?`).bind(id).first<Withdrawal>();
    if (current?.status === status && current.reviewNote === note && current.reviewedBy === adminId) return { ok: true, replayed: true };
    throw new WalletError("Yêu cầu đã được xử lý.", 409);
  }
  return { ok: true, replayed: false };
}

export async function revokeSale(database: D1Database, purchaseId: number, note: string, adminId: string) {
  const credit = await database.prepare("SELECT seller_user_id AS userId, revoked_at AS revokedAt FROM wallet_sale_credits WHERE purchase_id = ?").bind(purchaseId).first<{ userId: string; revokedAt: string | null }>();
  if (!credit) throw new WalletError("Đơn này chưa được cộng tiền bán file.", 404);
  if (credit.revokedAt) return { ok: true, replayed: true };
  const now = new Date().toISOString();
  // Cancel pending payouts before revocation, so reserved money cannot be paid
  // after the credit is recalled. Already paid/transferred funds become sales debt.
  const results = await database.batch([
    database.prepare(`INSERT INTO wallet_transactions (user_id, wallet, kind, amount, order_code, reference, target_type, target_id, description, created_at)
      SELECT w.user_id, 'sales', 'withdrawal-refund', w.amount, ? + row_number() OVER (ORDER BY w.id), 'withdrawal-refund:' || w.id, 'wallet-withdrawal', w.id, 'Hoàn yêu cầu rút do thu hồi tiền bán file: ' || ?, ?
      FROM wallet_withdrawals w WHERE w.user_id = ? AND w.status = 'pending'
      AND EXISTS (SELECT 1 FROM wallet_sale_credits WHERE purchase_id = ? AND revoked_at IS NULL)
      ON CONFLICT(reference) DO NOTHING`).bind(walletOrderCode(), note, now, credit.userId, purchaseId),
    database.prepare(`UPDATE wallet_withdrawals SET status = 'rejected', review_note = ?, reviewed_by = ?, reviewed_at = ?
      WHERE user_id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM wallet_sale_credits WHERE purchase_id = ? AND revoked_at IS NULL)`)
      .bind(`Thu hồi tiền bán file: ${note}`, adminId, now, credit.userId, purchaseId),
    database.prepare(`INSERT INTO wallet_transactions (user_id, wallet, kind, amount, order_code, reference, target_type, target_id, seller_user_id, description, created_at)
      SELECT c.seller_user_id, 'sales', 'sale-revoke', -c.amount, ?, 'sale-revoke:' || c.purchase_id, p.target_type, p.target_id, c.seller_user_id, 'Thu hồi tiền bán file đơn #' || p.order_code || ': ' || ?, ?
      FROM wallet_sale_credits c JOIN wallet_transactions p ON p.id = c.purchase_id WHERE c.purchase_id = ? AND c.revoked_at IS NULL
      ON CONFLICT(reference) DO NOTHING`).bind(walletOrderCode(), note, now, purchaseId),
    database.prepare("UPDATE wallet_sale_credits SET revoked_by = ?, revoked_at = ?, revocation_reason = ? WHERE purchase_id = ? AND revoked_at IS NULL").bind(adminId, now, note, purchaseId),
  ]);
  return { ok: true, replayed: !results[3].meta.changes };
}
