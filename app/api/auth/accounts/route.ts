import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { websiteSessions } from "@/db/schema";
import { AUTH_COOKIE, authCookie, safeAuthReturn, validOrigin } from "@/lib/website-auth";
import { getSavedAccounts, savedAccountsCookie, MAX_SAVED_ACCOUNTS } from "@/lib/saved-accounts";

export async function GET() {
  try {
    const active = (await cookies()).get(AUTH_COOKIE)?.value;
    const accounts = await getSavedAccounts();
    return Response.json({ accounts: accounts.map(({ userId, name, username, email, token }) => ({
      userId, name, label: username ? `@${username}` : email, active: token === active,
    })), limit: MAX_SAVED_ACCOUNTS }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Chưa thể tải danh sách tài khoản." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 4096) return Response.json({ error: "Dữ liệu quá dài." }, { status: 413 });
  try {
    const body = await request.json() as { action?: unknown; userId?: unknown; returnTo?: unknown } | null;
    if (!body || !["switch", "remove"].includes(String(body.action)) || typeof body.userId !== "string") {
      return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    }
    const accounts = await getSavedAccounts();
    const selected = accounts.find(account => account.userId === body.userId);
    if (!selected) return Response.json({ error: "Phiên tài khoản đã hết hạn. Vui lòng thêm tài khoản và đăng nhập lại." }, { status: 401 });
    const active = (await cookies()).get(AUTH_COOKIE)?.value;
    if (body.action === "remove" && selected.token === active) {
      return Response.json({ error: "Hãy dùng Đăng xuất để gỡ tài khoản đang sử dụng." }, { status: 400 });
    }
    const retained = accounts.filter(account => account.userId !== selected.userId);
    if (body.action === "remove") await getDb().delete(websiteSessions).where(eq(websiteSessions.tokenHash, selected.tokenHash));
    const response = Response.json({ ok: true, redirectTo: safeAuthReturn(typeof body.returnTo === "string" ? body.returnTo : null) }, { headers: { "Cache-Control": "no-store" } });
    if (body.action === "switch") {
      response.headers.append("Set-Cookie", authCookie(selected.token, request));
      retained.unshift(selected);
    }
    response.headers.append("Set-Cookie", savedAccountsCookie(retained.map(account => account.token), request));
    return response;
  } catch {
    return Response.json({ error: "Chưa thể chuyển đổi tài khoản. Vui lòng thử lại." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
