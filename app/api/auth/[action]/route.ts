import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { websiteAccounts, websiteSessions } from "@/db/schema";
import { assertActiveMember } from "@/lib/member-account-status";
import { equalSecret, hashPassword, hashToken, verifyPassword } from "@/lib/password";
import { AUTH_COOKIE, authCookie, getAuthenticatedIdentity, isAdminIdentity, safeAuthReturn, validOrigin } from "@/lib/website-auth";
import { cancelEmailChallenges, challengeCookie } from "@/lib/auth-challenges";
import { AuthFlowError, limitAuthAttempts, requestIp } from "@/lib/auth-security";
import { createWebsiteSession } from "@/lib/auth-sessions";
import { getSavedAccounts, savedAccountsCookie } from "@/lib/saved-accounts";
import { localAdminPasswordOnly } from "@/lib/local-admin-auth";
import { requestPasswordRecovery, resetForgottenPassword } from "@/lib/password-recovery";
import { beginTotpRotation, cancelTotpChallenges, issueTotpChallenge, recoverAdminPassword, totpCookie, verifyTotpChallenge } from "@/lib/admin-totp";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { action } = await context.params;
  if (!["login", "register", "logout", "password", "verify", "resend", "forgot", "reset", "totp-verify", "totp-rotate", "admin-recover"].includes(action)) return Response.json({ error: "Không tìm thấy chức năng." }, { status: 404 });
  try {
    const db = getDb();
    if (action === "logout") {
      const token = (await cookies()).get(AUTH_COOKIE)?.value;
      const remaining = (await getSavedAccounts()).filter(account => account.token !== token);
      if (token) await db.delete(websiteSessions).where(eq(websiteSessions.tokenHash, hashToken(token)));
      await cancelEmailChallenges();
      await cancelTotpChallenges();
      const response = new Response(null, { status: 303, headers: { Location: "/dang-nhap", "Cache-Control": "no-store" } });
      response.headers.append("Set-Cookie", authCookie("", request, 0));
      response.headers.append("Set-Cookie", savedAccountsCookie(remaining.map(account => account.token), request));
      response.headers.append("Set-Cookie", challengeCookie("", request, 0));
      response.headers.append("Set-Cookie", totpCookie("", request, 0));
      response.headers.append("Set-Cookie", "__sites_local_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
      return response;
    }
    if (Number(request.headers.get("content-length") || 0) > 4096) return Response.json({ error: "Dữ liệu quá dài." }, { status: 413 });
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
    if (!body || typeof body !== "object") return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    if (action === "totp-verify") return await verifyTotpChallenge(request, body);
    if (action === "totp-rotate") return await beginTotpRotation(request, body);
    if (action === "admin-recover") return await recoverAdminPassword(request, body);
    if (action === "forgot") return await requestPasswordRecovery(request, body.email);
    if (action === "reset") return await resetForgottenPassword(request, body);
    if (action === "verify" || action === "resend") throw new AuthFlowError("Quản trị dùng ứng dụng xác thực; mã email chỉ dùng ở trang khôi phục thành viên.");
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const login = action === "login" && typeof body.login === "string" ? body.login.trim().toLowerCase() : username || email;
    const password = typeof body.password === "string" ? body.password : "";
    const identity = action === "password" ? await getAuthenticatedIdentity() : null;
    if (action === "password" && (identity?.source !== "website" || !identity.hasPassword)) return Response.json({ error: "Vui lòng đăng nhập bằng tên đăng nhập hoặc email và mật khẩu." }, { status: 401 });
    const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
    const validUsername = (value: string) => /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
    if (!password || password.length > 128
      || (action === "register" && ((!username && !email) || (username && !validUsername(username)) || (email && !validEmail(email))))
      || (action === "login" && !validEmail(login) && !validUsername(login))) return Response.json({ error: "Nhập tên đăng nhập từ 3 đến 32 ký tự (chữ, số, dấu chấm, gạch dưới hoặc gạch ngang), hoặc email và mật khẩu hợp lệ." }, { status: 400 });

    for (const [value, limit] of [[`account:${action}:${identity?.userId || login}`, 10], [`ip:${action}:${requestIp(request)}`, 60]] as const) {
      await limitAuthAttempts(value, limit);
    }

    const bindings = env as unknown as Record<string, string | undefined>;
    let [account] = await db.select().from(websiteAccounts).where(identity ? eq(websiteAccounts.userId, identity.userId) : login.includes("@") ? eq(websiteAccounts.email, login) : eq(websiteAccounts.username, login)).limit(1);
    if (action === "password") {
      const nextPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      const minimum = account?.isOwner ? 10 : 6;
      if (nextPassword.length < minimum || nextPassword.length > 128) return Response.json({ error: `Mật khẩu mới cần từ ${minimum} đến 128 ký tự.` }, { status: 400 });
      if (!account || !await verifyPassword(password, account.passwordHash)) return Response.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
      const token = (await cookies()).get(AUTH_COOKIE)?.value || "";
      const passwordHash = await hashPassword(nextPassword);
      if (account.isOwner) return await issueTotpChallenge(request, account, "password", "/tai-khoan", passwordHash, hashToken(token));
      await env.DB!.batch([
        env.DB!.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ?").bind(passwordHash, account.userId),
        env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ? AND token_hash != ?").bind(account.userId, hashToken(token)),
        env.DB!.prepare("DELETE FROM auth_email_challenges WHERE user_id = ?").bind(account.userId),
      ]);
      return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "register") {
      const displayName = typeof body.name === "string" ? body.name.trim() : "";
      if (displayName.length < 2 || displayName.length > 80 || password.length < 6) return Response.json({ error: "Tên cần từ 2 đến 80 ký tự; mật khẩu cần từ 6 đến 128 ký tự." }, { status: 400 });
      if (body.role === "admin") return Response.json({ error: "Không thể tự đăng ký tài khoản quản trị." }, { status: 403 });
      if (account || (email && email === bindings.TIPOOK_ADMIN_EMAIL?.trim().toLowerCase())) return Response.json({ error: "Tên đăng nhập hoặc email đã được sử dụng. Vui lòng đăng nhập hoặc chọn tên khác." }, { status: 409 });
      const userId = "member_" + crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      [account] = await db.insert(websiteAccounts).values({ userId, email: email || null, username: username || null, displayName, passwordHash, createdAt: new Date().toISOString() }).onConflictDoNothing().returning();
      if (!account) return Response.json({ error: "Tên đăng nhập hoặc email đã được sử dụng." }, { status: 409 });
    } else if ((!account || !account.isOwner) && login === bindings.TIPOOK_ADMIN_EMAIL?.trim().toLowerCase() && bindings.TIPOOK_ADMIN_PASSWORD && bindings.TIPOOK_ADMIN_PASSWORD.length >= 10 && equalSecret(password, bindings.TIPOOK_ADMIN_PASSWORD)) {
      const passwordHash = await hashPassword(password);
      if (account) {
        // An unverified member email cannot acquire owner access by changing
        // configuration. Only the server's bootstrap secret can claim it.
        await env.DB!.batch([
          env.DB!.prepare("UPDATE website_accounts SET password_hash = ?, is_owner = 1 WHERE user_id = ? AND is_owner = 0").bind(passwordHash, account.userId),
          env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ?").bind(account.userId),
        ]);
      } else {
        const values = { userId: "member_" + crypto.randomUUID(), email: login, displayName: "Quản trị Tipook", passwordHash, isOwner: true, createdAt: new Date().toISOString() };
        await db.insert(websiteAccounts).values(values).onConflictDoNothing();
      }
      [account] = await db.select().from(websiteAccounts).where(eq(websiteAccounts.email, login)).limit(1);
    }
    // Do the same scrypt work for unknown emails to reduce account enumeration.
    const dummy = `scrypt-v1:${"0".repeat(32)}:${"0".repeat(128)}`;
    const valid = action === "register" ? Boolean(account) : await verifyPassword(password, account?.passwordHash || dummy);
    if (!valid || !account) return Response.json({ error: "Tên đăng nhập, email hoặc mật khẩu không đúng." }, { status: 401 });
    await assertActiveMember(account.userId);
    const isAdmin = isAdminIdentity(account);
    if (body.role === "admin" && !isAdmin) return Response.json({ error: "Tài khoản này không có quyền quản trị website." }, { status: 403 });
    const redirectTo = safeAuthReturn(typeof body.returnTo === "string" ? body.returnTo : null, isAdmin ? "/kho-mau-nha-dep-chat" : "/tai-khoan");
    if (account.isOwner) {
      if (!isAdmin) throw new AuthFlowError("Tài khoản quản lý chưa được cấu hình đúng.", 403);
      if (localAdminPasswordOnly(request)) return await createWebsiteSession(request, account, redirectTo);
      return await issueTotpChallenge(request, account, "login", redirectTo);
    }
    return await createWebsiteSession(request, account, redirectTo);
  } catch (error) {
    if (error instanceof AuthFlowError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store", ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) } });
    return Response.json({ error: "Chưa thể xử lý tài khoản. Vui lòng thử lại." }, { status: 500 });
  }
}
