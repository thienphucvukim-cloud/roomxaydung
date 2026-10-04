import { randomBytes } from "node:crypto";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { memberProfiles } from "@/db/schema";
import { hashToken } from "@/lib/password";
import { authCookie, isAdminIdentity, safeAuthReturn, SESSION_SECONDS } from "@/lib/website-auth";
import { AuthFlowError } from "@/lib/auth-security";
import { localAdminPasswordOnly } from "@/lib/local-admin-auth";
import { getSavedAccounts, MAX_SAVED_ACCOUNTS, savedAccountsCookie } from "@/lib/saved-accounts";

export async function createWebsiteSession(request: Request, account: { userId: string; email: string | null; displayName: string; isOwner: boolean; passwordHash: string }, returnTo: string | null, ownerVerified = false, ownerCredential: string | null = null, googleAvatarUrl?: string) {
  const isAdmin = isAdminIdentity(account);
  const localPasswordOnly = account.isOwner && localAdminPasswordOnly(request);
  if (account.isOwner && (!isAdmin || (!localPasswordOnly && (!ownerVerified || !ownerCredential)))) throw new AuthFlowError("Tài khoản quản lý cần xác nhận bằng ứng dụng xác thực.", 403);
  const db = getDb();
  const now = Date.now();
  const profile = db.insert(memberProfiles).values({ userId: account.userId, displayName: account.displayName, email: account.email, ...(googleAvatarUrl ? { googleAvatarUrl } : {}) })
    .onConflictDoUpdate({ target: memberProfiles.userId, set: { displayName: account.displayName, email: account.email, updatedAt: new Date().toISOString(), ...(googleAvatarUrl ? { googleAvatarUrl } : {}) } }).toSQL();
  const token = randomBytes(32).toString("hex");
  const saved = await getSavedAccounts();
  const retained = saved.filter(item => item.userId !== account.userId).slice(0, MAX_SAVED_ACCOUNTS - 1);
  // Profile, session and discarded saved sessions use one database round trip.
  // The account/password/status/TOTP guard is evaluated atomically at insert.
  const statements = [env.DB!.prepare(profile.sql).bind(...profile.params),
    env.DB!.prepare("INSERT INTO website_sessions (token_hash, user_id, expires_at, owner_verified) SELECT ?, user_id, ?, ? FROM website_accounts WHERE user_id = ? AND password_hash = ? AND is_owner = ? AND NOT EXISTS (SELECT 1 FROM member_profiles WHERE user_id = website_accounts.user_id AND account_status != 'active') AND (? = 0 OR EXISTS (SELECT 1 FROM admin_totp_credentials WHERE user_id = website_accounts.user_id AND secret_encrypted = ?)) RETURNING token_hash")
      .bind(hashToken(token), now + SESSION_SECONDS * 1000, ownerVerified || localPasswordOnly ? 1 : 0, account.userId, account.passwordHash, account.isOwner ? 1 : 0, account.isOwner && !localPasswordOnly ? 1 : 0, ownerCredential),
    ...saved.filter(item => !retained.includes(item)).map(item => env.DB!.prepare("DELETE FROM website_sessions WHERE token_hash = ? AND EXISTS (SELECT 1 FROM website_sessions WHERE token_hash = ?)").bind(item.tokenHash, hashToken(token))),
  ];
  const result = await env.DB!.batch(statements);
  if (!result[1]?.results?.length) throw new AuthFlowError("Tài khoản đã thay đổi. Vui lòng đăng nhập lại.", 401);
  const redirectTo = safeAuthReturn(returnTo, isAdmin ? "/kho-mau-nha-dep-chat" : "/tai-khoan");
  const response = Response.json({ ok: true, redirectTo, isAdmin }, { headers: { "Set-Cookie": authCookie(token, request), "Cache-Control": "no-store" } });
  response.headers.append("Set-Cookie", savedAccountsCookie([token, ...retained.map(item => item.token)], request));
  return response;
}
