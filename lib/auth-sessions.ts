import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { authRateLimits, memberProfiles, websiteSessions } from "@/db/schema";
import { hashToken } from "@/lib/password";
import { AUTH_COOKIE, authCookie, isAdminIdentity, safeAuthReturn, SESSION_SECONDS } from "@/lib/website-auth";
import { AuthFlowError } from "@/lib/auth-security";

export async function createWebsiteSession(request: Request, account: { userId: string; email: string; displayName: string; isOwner: boolean; passwordHash: string }, returnTo: string | null, ownerVerified = false, ownerCredential: string | null = null) {
  const isAdmin = isAdminIdentity(account);
  if (account.isOwner && (!isAdmin || !ownerVerified || !ownerCredential)) throw new AuthFlowError("Tài khoản quản lý cần xác nhận bằng ứng dụng xác thực.", 403);
  const db = getDb();
  const now = Date.now();
  await db.insert(memberProfiles).values({ userId: account.userId, displayName: account.displayName, email: account.email }).onConflictDoUpdate({ target: memberProfiles.userId, set: { displayName: account.displayName, email: account.email, updatedAt: new Date().toISOString() } });
  const token = randomBytes(32).toString("hex");
  await db.delete(websiteSessions).where(lt(websiteSessions.expiresAt, now));
  await db.delete(authRateLimits).where(lt(authRateLimits.expiresAt, now));
  const oldToken = (await cookies()).get(AUTH_COOKIE)?.value;
  if (oldToken) await db.delete(websiteSessions).where(eq(websiteSessions.tokenHash, hashToken(oldToken)));
  const inserted = await env.DB!.prepare("INSERT INTO website_sessions (token_hash, user_id, expires_at, owner_verified) SELECT ?, user_id, ?, ? FROM website_accounts WHERE user_id = ? AND password_hash = ? AND is_owner = ? AND (? = 0 OR EXISTS (SELECT 1 FROM admin_totp_credentials WHERE user_id = website_accounts.user_id AND secret_encrypted = ?)) RETURNING token_hash")
    .bind(hashToken(token), now + SESSION_SECONDS * 1000, ownerVerified ? 1 : 0, account.userId, account.passwordHash, account.isOwner ? 1 : 0, account.isOwner ? 1 : 0, ownerCredential).first();
  if (!inserted) throw new AuthFlowError("Tài khoản đã thay đổi. Vui lòng đăng nhập lại.", 401);
  const redirectTo = safeAuthReturn(returnTo, isAdmin ? "/kho-mau-nha-dep-tipook" : "/tai-khoan");
  return Response.json({ ok: true, redirectTo, isAdmin }, { headers: { "Set-Cookie": authCookie(token, request), "Cache-Control": "no-store" } });
}
