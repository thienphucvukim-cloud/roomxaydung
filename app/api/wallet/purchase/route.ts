import { memberAccessResponse } from "@/lib/member-access";
import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { directMessages, postAttachments, walletTransactions } from "../../../../db/schema";
import { createDownloadToken } from "../../../../lib/download-links";
import { getPaymentBuyerId } from "../../../../lib/payment-identity";
import { resolveWalletProduct } from "../../../../lib/wallet-products";
import { notifyAdminTelegram } from "../../../../lib/admin-telegram";
import { requestTargetLink } from "../../../../lib/request-target-link";

type DownloadLink = { name: string; url: string };

async function deliveryFor(request: Request, userId: string, orderCode: number, targetType: string, targetId: string) {
  const links: DownloadLink[] = [];
  if (targetType !== "post" || !/^\d+$/.test(targetId)) return links;
  const files = await getDb().select().from(postAttachments).where(and(eq(postAttachments.postId, Number(targetId)), eq(postAttachments.accessType, "private")));
  const expires = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const origin = new URL(request.url).origin;
  for (const file of files) {
    if (!await env.BUCKET?.head(file.objectKey)) throw new Error("File bản vẽ không còn tồn tại. Vui lòng liên hệ người đăng.");
    const token = await createDownloadToken(orderCode, file.id, expires, userId);
    const query = new URLSearchParams({ order: String(orderCode), file: String(file.id), expires: String(expires), token });
    links.push({ name: file.fileName, url: `${origin}/api/downloads/drawing?${query.toString()}` });
  }
  return links;
}

export async function POST(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  try {
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin && requestOrigin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
    const userId = await getPaymentBuyerId();
    if (!userId) return Response.json({ error: "Vui lòng đăng ký hoặc đăng nhập để mua file." }, { status: 401 });

    const body = await request.json() as { targetType?: unknown; targetId?: unknown; purchaseId?: unknown };
    const targetType = body.targetType === "drawing" || body.targetType === "post" ? body.targetType : "";
    const targetId = typeof body.targetId === "string" ? body.targetId.trim().slice(0, 180) : "";
    const purchaseId = typeof body.purchaseId === "string" ? body.purchaseId : "";
    if (!targetType || !targetId || !/^[0-9a-f-]{36}$/i.test(purchaseId)) return Response.json({ error: "Yêu cầu mua không hợp lệ." }, { status: 400 });
    if (targetType === "drawing") return Response.json({ error: "Hồ sơ tham khảo chưa có file để bán. Vui lòng dùng Yêu cầu file để liên hệ người đăng." }, { status: 409 });

    const db = getDb();

    const [prior] = await db.select().from(walletTransactions).where(and(eq(walletTransactions.userId, userId), eq(walletTransactions.kind, "purchase"), eq(walletTransactions.targetType, targetType), eq(walletTransactions.targetId, targetId))).limit(1);
    if (prior) {
      const downloadLinks = await deliveryFor(request, userId, prior.orderCode, targetType, targetId);
      return Response.json({ ok: true, alreadyPurchased: true, orderCode: prior.orderCode, downloadLinks, message: downloadLinks.length ? "Bạn đã mua bản vẽ này. Link tải mới có hiệu lực 24 giờ." : "Bạn đã mua bản vẽ này. Admin hoặc tác giả sẽ gửi file qua tin nhắn." });
    }

    const product = await resolveWalletProduct(targetType, targetId);
    if (!product) return Response.json({ error: "Bản vẽ chưa có giá hợp lệ hoặc không còn tồn tại." }, { status: 404 });

    const database = env.DB;
    if (!database) throw new Error("D1 chưa được cấu hình.");
    const orderCode = Math.floor(Date.now() / 1000) * 1_000_000 + crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const now = new Date().toISOString();
    const reference = `wallet:${purchaseId}`;
    // Prepare and validate all download links before charging the wallet.
    const downloadLinks = await deliveryFor(request, userId, orderCode, targetType, targetId);
    const result = await database.prepare(`
      INSERT INTO wallet_transactions
        (user_id, kind, amount, order_code, reference, target_type, target_id, seller_user_id, description, created_at)
      SELECT ?, 'purchase', ?, ?, ?, ?, ?, ?, ?, ?
      WHERE (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE user_id = ? AND wallet = 'deposit') >= ?
        AND NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE reference = ?)
        AND NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE user_id = ? AND kind = 'purchase' AND target_type = ? AND target_id = ?)
    `).bind(userId, -product.amount, orderCode, reference, targetType, targetId, product.sellerUserId, `Mua ${product.title}`, now, userId, product.amount, reference, userId, targetType, targetId).run();

    if (!result.meta.changes) {
      const [existing] = await db.select().from(walletTransactions).where(and(eq(walletTransactions.userId, userId), eq(walletTransactions.kind, "purchase"), eq(walletTransactions.targetType, targetType), eq(walletTransactions.targetId, targetId))).limit(1);
      if (existing) return Response.json({ ok: true, alreadyPurchased: true, orderCode: existing.orderCode, downloadLinks: await deliveryFor(request, userId, existing.orderCode, targetType, targetId), message: "Bạn đã mua bản vẽ này. Không trừ tiền thêm." });
      const balanceResult = await database.prepare("SELECT COALESCE(SUM(amount), 0) AS balance FROM wallet_transactions WHERE user_id = ? AND wallet = 'deposit'").bind(userId).first<{ balance: number }>();
      return Response.json({ error: "Số dư ví nạp không đủ. Bạn có thể nạp tiền hoặc chuyển tiền từ ví bán file sang ví nạp.", balance: Number(balanceResult?.balance ?? 0), required: product.amount }, { status: 402 });
    }

    const buyerContent = downloadLinks.length
      ? `Bạn đã thanh toán ${product.amount.toLocaleString("vi-VN")}đ từ Ví NhàĐẹpChất cho “${product.title}”.\n\nLink tải có hiệu lực 24 giờ:\n${downloadLinks.map((item) => `${item.name}: ${item.url}`).join("\n")}`
      : `Bạn đã thanh toán ${product.amount.toLocaleString("vi-VN")}đ từ Ví NhàĐẹpChất cho “${product.title}”. Admin hoặc tác giả sẽ gửi file qua tin nhắn nội bộ.`;
    await db.insert(directMessages).values([
      { senderUserId: "tipook-wallet", senderName: "Ví NhàĐẹpChất", recipientUserId: userId, subject: `Đã mua bản vẽ #${orderCode}`, content: buyerContent },
      { senderUserId: "tipook-wallet", senderName: "Ví NhàĐẹpChất", recipientUserId: product.sellerUserId, subject: `Có đơn mua bản vẽ #${orderCode}`, content: `Bản vẽ “${product.title}” đã được mua với giá ${product.amount.toLocaleString("vi-VN")}đ. Admin sẽ kiểm tra và cộng tiền vào ví bán file. Sau đó bạn có thể yêu cầu rút về ngân hàng hoặc chuyển sang ví nạp tại trang Tài khoản.` },
    ]);

    const postLink = requestTargetLink(new URL(request.url).origin, targetType, targetId, product.category);
    const telegram = await notifyAdminTelegram(`[NhàĐẹpChất] Đơn mua file mới\nMã đơn: #${orderCode}\nBản vẽ: ${product.title}\nSố tiền: ${product.amount.toLocaleString("vi-VN")}đ\nTrạng thái: Đã thanh toán bằng Ví NhàĐẹpChất\nLink bài viết: ${postLink}\nTác giả: ${product.sellerUserId}`, userId);
    return Response.json({ ok: true, orderCode, downloadLinks, telegram, message: downloadLinks.length ? "Thanh toán thành công. Link tải có hiệu lực 24 giờ." : "Thanh toán thành công. Admin hoặc tác giả sẽ gửi file qua tin nhắn." }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Chưa thể thanh toán bằng Ví NhàĐẹpChất.";
    return Response.json({ error: message }, { status: 500 });
  }
}
