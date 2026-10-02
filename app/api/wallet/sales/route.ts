import { env } from "cloudflare:workers";
import { getPaymentBuyerId } from "@/lib/payment-identity";
import { memberAccessResponse } from "@/lib/member-access";
import { validOrigin } from "@/lib/website-auth";
import { notifyAdminTelegram } from "@/lib/admin-telegram";
import { requestWithdrawal, transferSales, validWalletAmount, validWalletRequestId, WalletError } from "@/lib/seller-wallet";

export async function POST(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const userId = await getPaymentBuyerId();
  if (!userId) return Response.json({ error: "Vui lòng đăng nhập để sử dụng ví." }, { status: 401 });
  let body: Record<string, unknown> | null;
  try { body = await request.json() as Record<string, unknown> | null; }
  catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  if (!body || !validWalletRequestId(body.requestId) || !validWalletAmount(body.amount) || (body.action !== "transfer" && body.action !== "withdraw")
    || (body.from !== undefined && body.from !== "sales") || (body.to !== undefined && (body.action !== "transfer" || body.to !== "deposit"))) {
    return Response.json({ error: "Chỉ chuyển từ ví bán file sang ví nạp hoặc yêu cầu rút. Số tiền nguyên từ 1đ đến 20.000.000đ và mã yêu cầu phải hợp lệ." }, { status: 400 });
  }
  try {
    const database = env.DB;
    if (!database) throw new Error("D1 chưa được cấu hình.");
    if (body.action === "transfer") {
      const result = await transferSales(database, userId, body.requestId, body.amount);
      return Response.json(result, { status: result.replayed ? 200 : 201 });
    }
    const bankName = typeof body.bankName === "string" ? body.bankName.trim() : "";
    const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";
    const accountName = typeof body.accountName === "string" ? body.accountName.trim() : "";
    if (!bankName || bankName.length > 100 || !/^[a-zA-Z0-9]{4,40}$/.test(accountNumber) || !accountName || accountName.length > 120) return Response.json({ error: "Nhập tên ngân hàng, số tài khoản (4–40 chữ hoặc số) và tên chủ tài khoản." }, { status: 400 });
    const result = await requestWithdrawal(database, userId, body.requestId, body.amount, { bankName, accountNumber, accountName });
    if (!result.replayed) await notifyAdminTelegram(`[Tipook] Yêu cầu rút tiền bán file\nMã: ${result.withdrawal.id}\nSố tiền: ${body.amount.toLocaleString("vi-VN")}đ\nNgân hàng: ${bankName}\nSố tài khoản: ${accountNumber}\nChủ tài khoản: ${accountName}\nTiền đã được giữ trong ví bán file, chờ admin thanh toán.`, userId);
    return Response.json(result, { status: result.replayed ? 200 : 201 });
  } catch (cause) {
    return Response.json({ error: cause instanceof WalletError ? cause.message : "Chưa xác định được kết quả. Gửi lại cùng mã yêu cầu hoặc tải lại lịch sử để kiểm tra." }, { status: cause instanceof WalletError ? cause.status : 500 });
  }
}
