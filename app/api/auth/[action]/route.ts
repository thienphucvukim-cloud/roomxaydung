import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { websiteAccounts, websiteSessions } from "@/db/schema";
import { equalSecret, hashPassword, hashToken, verifyPassword } from "@/lib/password";
import { AUTH_COOKIE, authCookie, getAuthenticatedIdentity, isAdminIdentity, safeAuthReturn, validOrigin } from "@/lib/website-auth";
import { cancelEmailChallenges, challengeCookie, consumeEmailChallenge, issueEmailChallenge, readEmailChallenge } from "@/lib/auth-challenges";
import { AuthFlowError, limitAuthAttempts, requestIp } from "@/lib/auth-security";
import { createWebsiteSession } from "@/lib/auth-sessions";
import { requestPasswordRecovery, resetForgottenPassword } from "@/lib/password-recovery";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { action } = await context.params;
  if (!["login", "register", "logout", "password", "verify", "resend", "forgot", "reset"].includes(action)) return Response.json({ error: "Không tìm thấy chức năng." }, { status: 404 });
  try {
    const db = getDb();
    if (action === "logout") {
      const token = (await cookies()).get(AUTH_COOKIE)?.value;
      if (token) await db.delete(websiteSessions).where(eq(websiteSessions.tokenHash, hashToken(token)));
      await cancelEmailChallenges();
      const response = new Response(null, { status: 303, headers: { Location: "/dang-nhap", "Cache-Control": "no-store" } });
      response.headers.append("Set-Cookie", authCookie("", request, 0));
      response.headers.append("Set-Cookie", challengeCookie("", request, 0));
      response.headers.append("Set-Cookie", "__sites_local_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
      return response;
    }
    if (Number(request.headers.get("content-length") || 0) > 4096) return Response.json({ error: "Dữ liệu quá dài." }, { status: 413 });
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
    if (!body || typeof body !== "object") return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    if (action === "forgot") return await requestPasswordRecovery(request, body.email);
    if (action === "reset") return await resetForgottenPassword(request, body);
    if (action === "verify" || action === "resend") {
      if (action === "resend") {
        const { challenge, account } = await readEmailChallenge(request, body.challengeId);
        if (challenge.purpose === "reset") throw new AuthFlowError("Hãy yêu cầu mã mới tại trang Quên mật khẩu.");
        return await issueEmailChallenge(request, account, challenge.purpose, challenge.redirect_to, challenge.new_password_hash, challenge.session_hash);
      }
      const { challenge, account } = await consumeEmailChallenge(request, body.challengeId, body.code, ["login", "password"]);
      let response: Response;
      if (challenge.purpose === "password") {
        if (!challenge.new_password_hash) throw new AuthFlowError("Yêu cầu đổi mật khẩu không hợp lệ.");
        const changed = await env.DB!.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ? AND password_hash = ? AND EXISTS (SELECT 1 FROM website_sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ? AND owner_verified = 1) RETURNING user_id")
          .bind(challenge.new_password_hash, account.userId, account.passwordHash, challenge.session_hash, account.userId, Date.now()).first();
        if (!changed) throw new AuthFlowError("Tài khoản hoặc phiên đăng nhập đã thay đổi. Vui lòng bắt đầu lại.", 401);
        await env.DB!.batch([
          env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ? AND token_hash != ?").bind(account.userId, challenge.session_hash),
          env.DB!.prepare("DELETE FROM auth_email_challenges WHERE user_id = ?").bind(account.userId),
        ]);
        response = Response.json({ ok: true, passwordChanged: true }, { headers: { "Cache-Control": "no-store" } });
      } else {
        response = await createWebsiteSession(request, account, challenge.redirect_to, true);
      }
      response.headers.append("Set-Cookie", challengeCookie("", request, 0));
      return response;
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const identity = action === "password" ? await getAuthenticatedIdentity() : null;
    if (action === "password" && identity?.source !== "website") return Response.json({ error: "Vui lòng đăng nhập bằng email và mật khẩu." }, { status: 401 });
    if ((action !== "password" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) || !password || password.length > 128) return Response.json({ error: "Vui lòng nhập email và mật khẩu hợp lệ." }, { status: 400 });

    for (const [value, limit] of [[`account:${action}:${identity?.email || email}`, 10], [`ip:${action}:${requestIp(request)}`, 60]] as const) {
      await limitAuthAttempts(value, limit);
    }

    const bindings = env as unknown as Record<string, string | undefined>;
    let [account] = await db.select().from(websiteAccounts).where(eq(websiteAccounts.email, identity?.email || email)).limit(1);
    if (action === "password") {
      const nextPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      if (nextPassword.length < 10 || nextPassword.length > 128) return Response.json({ error: "Mật khẩu mới cần từ 10 đến 128 ký tự." }, { status: 400 });
      if (!account || !await verifyPassword(password, account.passwordHash)) return Response.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
      const token = (await cookies()).get(AUTH_COOKIE)?.value || "";
      const passwordHash = await hashPassword(nextPassword);
      if (account.isOwner) return await issueEmailChallenge(request, account, "password", "/tai-khoan", passwordHash, hashToken(token));
      await env.DB!.batch([
        env.DB!.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ?").bind(passwordHash, account.userId),
        env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ? AND token_hash != ?").bind(account.userId, hashToken(token)),
        env.DB!.prepare("DELETE FROM auth_email_challenges WHERE user_id = ?").bind(account.userId),
      ]);
      return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "register") {
      const displayName = typeof body.name === "string" ? body.name.trim() : "";
      if (displayName.length < 2 || displayName.length > 80 || password.length < 10) return Response.json({ error: "Tên cần từ 2 đến 80 ký tự; mật khẩu cần từ 10 đến 128 ký tự." }, { status: 400 });
      if (account || email === bindings.TIPOOK_ADMIN_EMAIL?.trim().toLowerCase()) return Response.json({ error: "Email này không thể đăng ký. Vui lòng đăng nhập hoặc dùng email khác." }, { status: 409 });
      const userId = "member_" + crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      [account] = await db.insert(websiteAccounts).values({ userId, email, displayName, passwordHash, createdAt: new Date().toISOString() }).onConflictDoNothing().returning();
      if (!account) return Response.json({ error: "Email này không thể đăng ký." }, { status: 409 });
    } else if ((!account || !account.isOwner) && email === bindings.TIPOOK_ADMIN_EMAIL?.trim().toLowerCase() && bindings.TIPOOK_ADMIN_PASSWORD && bindings.TIPOOK_ADMIN_PASSWORD.length >= 10 && equalSecret(password, bindings.TIPOOK_ADMIN_PASSWORD)) {
      const passwordHash = await hashPassword(password);
      if (account) {
        // An unverified member email cannot acquire owner access by changing
        // configuration. Only the server's bootstrap secret can claim it.
        await env.DB!.batch([
          env.DB!.prepare("UPDATE website_accounts SET password_hash = ?, is_owner = 1 WHERE user_id = ? AND is_owner = 0").bind(passwordHash, account.userId),
          env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ?").bind(account.userId),
        ]);
      } else {
        const values = { userId: "member_" + crypto.randomUUID(), email, displayName: "Quản trị Tipook", passwordHash, isOwner: true, createdAt: new Date().toISOString() };
        await db.insert(websiteAccounts).values(values).onConflictDoNothing();
      }
      [account] = await db.select().from(websiteAccounts).where(eq(websiteAccounts.email, email)).limit(1);
    }
    // Do the same scrypt work for unknown emails to reduce account enumeration.
    const dummy = `scrypt-v1:${"0".repeat(32)}:${"0".repeat(128)}`;
    const valid = action === "register" ? Boolean(account) : await verifyPassword(password, account?.passwordHash || dummy);
    if (!valid || !account) return Response.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
    const isAdmin = isAdminIdentity(account);
    if (body.role === "admin" && !isAdmin) return Response.json({ error: "Tài khoản này không có quyền quản trị website." }, { status: 403 });
    const redirectTo = safeAuthReturn(typeof body.returnTo === "string" ? body.returnTo : null, isAdmin ? "/kho-mau-nha-dep-tipook" : "/tai-khoan");
    if (account.isOwner) {
      if (!isAdmin) throw new AuthFlowError("Tài khoản quản lý chưa được cấu hình đúng.", 403);
      return await issueEmailChallenge(request, account, "login", redirectTo);
    }
    return await createWebsiteSession(request, account, redirectTo);
  } catch (error) {
    if (error instanceof AuthFlowError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store", ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) } });
    return Response.json({ error: "Chưa thể xử lý tài khoản. Vui lòng thử lại." }, { status: 500 });
  }
}
