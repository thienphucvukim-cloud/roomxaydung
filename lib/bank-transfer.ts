import { env } from "cloudflare:workers";

export function getAdminBankConfig() {
  const bindings = env as unknown as Record<string, string | undefined>;
  const bankCode = bindings.ADMIN_BANK_CODE?.trim();
  const accountNumber = bindings.ADMIN_BANK_ACCOUNT?.trim();
  const accountName = bindings.ADMIN_BANK_NAME?.trim();
  if (!bankCode || !accountNumber || !accountName) {
    throw new Error("Chưa cấu hình ADMIN_BANK_CODE, ADMIN_BANK_ACCOUNT và ADMIN_BANK_NAME.");
  }
  const fallbackQrUrl = bindings.ADMIN_BANK_QR_IMAGE?.trim();
  return { bankCode, accountNumber, accountName, ...(fallbackQrUrl?.startsWith("/payments/") ? { fallbackQrUrl } : {}) };
}

export function createVietQrUrl(bankCode: string, accountNumber: string, amount: number, transferContent: string) {
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNumber)}-compact2.png`;
  const query = new URLSearchParams({ amount: String(amount), addInfo: transferContent });
  return `${base}?${query.toString()}`;
}
