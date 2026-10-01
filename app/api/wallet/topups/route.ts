import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { walletTopupRequests } from "../../../../db/schema";
import { createVietQrUrl, getAdminBankConfig } from "../../../../lib/bank-transfer";
import { attachPaymentBuyerCookie, getOrCreatePaymentBuyerId, getPaymentBuyerId } from "../../../../lib/payment-identity";

function safeAmount(value: unknown) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 10_000 && amount <= 20_000_000 ? amount : 0;
}

export async function GET() {
  try {
    const userId = await getPaymentBuyerId();
    if (!userId) return Response.json({ requests: [] });
    const requests = await getDb().select().from(walletTopupRequests).where(eq(walletTopupRequests.userId, userId)).orderBy(desc(walletTopupRequests.createdAt)).limit(10);
    let bank: ReturnType<typeof getAdminBankConfig> | null = null;
    try { bank = getAdminBankConfig(); } catch { /* Keep the history available without bank configuration. */ }
    return Response.json({ requests: requests.map(item => ({ ...item, ...(bank && item.status === "pending" ? { bank: { ...bank, qrUrl: createVietQrUrl(bank.bankCode, bank.accountNumber, item.amount, item.transferContent) } } : {}) })) });
  } catch {
    return Response.json({ error: "Chưa thể tải yêu cầu nạp tiền." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin && requestOrigin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
    const body = await request.json() as { amount?: unknown };
    const amount = safeAmount(body.amount);
    if (!amount) return Response.json({ error: "Số tiền nạp phải từ 10.000đ đến 20.000.000đ." }, { status: 400 });

    const member = await getOrCreatePaymentBuyerId();
    const bank = getAdminBankConfig();
    const requestCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    const transferContent = `TIPOOK ${requestCode}`;
    const now = new Date().toISOString();
    await getDb().insert(walletTopupRequests).values({ requestCode, userId: member.userId, amount, transferContent, status: "pending", createdAt: now, updatedAt: now });

    const response = Response.json({
      request: { requestCode, amount, transferContent, status: "pending" },
      bank: { ...bank, qrUrl: createVietQrUrl(bank.bankCode, bank.accountNumber, amount, transferContent) },
      notice: "Chỉ cộng tiền sau khi admin kiểm tra tài khoản ngân hàng và duyệt thủ công.",
    }, { status: 201 });
    return member.isNew ? attachPaymentBuyerCookie(response, request, member.userId) : response;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Chưa thể tạo yêu cầu nạp tiền.";
    return Response.json({ error: message }, { status: message.includes("ADMIN_BANK_") ? 503 : 500 });
  }
}
