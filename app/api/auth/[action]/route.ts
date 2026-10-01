import { randomBytes } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { authRateLimits, memberProfiles, websiteAccounts, websiteSessions } from "@/db/schema";
import { equalSecret, hashPassword, hashToken, verifyPassword } from "@/lib/password";
import { AUTH_COOKIE, authCookie, getAuthenticatedIdentity, isAdminIdentity, safeAuthReturn, SESSION_SECONDS, validOrigin } from "@/lib/website-auth";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { action } = await context.params;
  if (!["login", "register", "logout", "password"].includes(action)) return Response.json({ error: "Không tìm thấy chức năng." }, { status: 404 });
  try {
    const db = getDb();
    if (action === "logout") {
      const token = (await cookies()).get(AUTH_COOKIE)?.value;
      if (token) await db.delete(websiteSessions).where(eq(websiteSessions.tokenHash, hashToken(token)));
      const response = new Response(null, { status: 303, headers: { Location: "/dang-nhap", "Cache-Control": "no-store" } });
      response.headers.append("Set-Cookie", authCookie("", request, 0));
      response.headers.append("Set-Cookie", "__sites_local_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
      return response;
    }
    if (Number(request.headers.get("content-length") || 0) > 4096) return Response.json({ error: "Dữ liệu quá dài." }, { status: 413 });
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
    if (!body || typeof body !== "object") return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const identity = action === "password" ? await getAuthenticatedIdentity() : null;
    if (action === "password" && identity?.source !== "website") return Response.json({ error: "Vui lòng đăng nhập bằng email và mật khẩu." }, { status: 401 });
    if ((action !== "password" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) || !password || password.length > 128) return Response.json({ error: "Vui lòng nhập email và mật khẩu hợp lệ." }, { status: 400 });

    // Each key is incremented atomically; limits apply before expensive hashing.
    const now = Date.now();
    const bucket = Math.floor(now / 900_000);
    const ip = request.headers.get("cf-connecting-ip") || "local";
    for (const [value, limit] of [[`account:${action}:${identity?.email || email}`, 10], [`ip:${action}:${ip}`, 60]] as const) {
      const key = hashToken(`${value}:${bucket}`);
      const [rate] = await db.insert(authRateLimits).values({ key, attempts: 1, expiresAt: now + 900_000 })
        .onConflictDoUpdate({ target: authRateLimits.key, set: { attempts: sql`${authRateLimits.attempts} + 1` } }).returning();
      if (rate.attempts > limit) return Response.json({ error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút." }, { status: 429, headers: { "Retry-After": "900" } });
    }

    const bindings = env as unknown as Record<string, string | undefined>;
    let [account] = await db.select().from(websiteAccounts).where(eq(websiteAccounts.email, identity?.email || email)).limit(1);
    if (action === "password") {
      const nextPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      if (nextPassword.length < 10 || nextPassword.length > 128) return Response.json({ error: "Mật khẩu mới cần từ 10 đến 128 ký tự." }, { status: 400 });
      if (!account || !await verifyPassword(password, account.passwordHash)) return Response.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
      const token = (await cookies()).get(AUTH_COOKIE)?.value || "";
      const passwordHash = await hashPassword(nextPassword);
      await env.DB!.batch([
        env.DB!.prepare("UPDATE website_accounts SET password_hash = ? WHERE user_id = ?").bind(passwordHash, account.userId),
        env.DB!.prepare("DELETE FROM website_sessions WHERE user_id = ? AND token_hash != ?").bind(account.userId, hashToken(token)),
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
    await db.insert(memberProfiles).values({ userId: account.userId, displayName: account.displayName, email: account.email }).onConflictDoUpdate({ target: memberProfiles.userId, set: { displayName: account.displayName, email: account.email, updatedAt: new Date().toISOString() } });
    const token = randomBytes(32).toString("hex");
    await db.delete(websiteSessions).where(lt(websiteSessions.expiresAt, now));
    await db.delete(authRateLimits).where(lt(authRateLimits.expiresAt, now));
    const oldToken = (await cookies()).get(AUTH_COOKIE)?.value;
    if (oldToken) await db.delete(websiteSessions).where(eq(websiteSessions.tokenHash, hashToken(oldToken)));
    await db.insert(websiteSessions).values({ tokenHash: hashToken(token), userId: account.userId, expiresAt: now + SESSION_SECONDS * 1000 });
    const redirectTo = safeAuthReturn(typeof body.returnTo === "string" ? body.returnTo : null, isAdmin ? "/kho-mau-nha-dep-tipook" : "/tai-khoan");
    return Response.json({ ok: true, redirectTo, isAdmin }, { headers: { "Set-Cookie": authCookie(token, request), "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Chưa thể xử lý tài khoản. Vui lòng thử lại." }, { status: 500 });
  }
}
