import { cookies, headers } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { websiteAccounts, websiteSessions } from "@/db/schema";
import { hashToken } from "@/lib/password";
import { memberAccountStatus } from "@/lib/member-account-status";
import { AUTH_COOKIE } from "@/lib/session-cookie";

export { AUTH_COOKIE } from "@/lib/session-cookie";
export { safeAuthReturn } from "@/lib/auth-return";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export type Identity = { userId: string; email: string | null; username?: string | null; displayName: string; source: "website" | "sites"; isOwner?: boolean; hasPassword?: boolean };
export async function getAuthenticatedIdentity(): Promise<Identity | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const [account] = await getDb().select({ userId: websiteAccounts.userId, email: websiteAccounts.email, username: websiteAccounts.username, passwordHash: websiteAccounts.passwordHash, displayName: websiteAccounts.displayName, isOwner: websiteAccounts.isOwner, ownerVerified: websiteSessions.ownerVerified })
      .from(websiteSessions).innerJoin(websiteAccounts, eq(websiteSessions.userId, websiteAccounts.userId))
      .where(and(eq(websiteSessions.tokenHash, hashToken(token)), gt(websiteSessions.expiresAt, Date.now()), sql`not exists (select 1 from member_profiles where user_id = ${websiteAccounts.userId} and account_status != 'active')`)).limit(1);
    if (account && (!account.isOwner || account.ownerVerified)) return { userId: account.userId, email: account.email, username: account.username, displayName: account.displayName, isOwner: account.isOwner, hasPassword: account.passwordHash.startsWith("scrypt-v1:"), source: "website" };
    // A stale website session must never silently turn into another account.
    return null;
  }
  const h = await headers();
  const userId = h.get("oai-authenticated-user-id")?.trim();
  const email = h.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!userId || !email) return null;
  if (await memberAccountStatus(userId) !== "active") return null;
  let displayName = email.split("@")[0];
  if (h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
    try { displayName = decodeURIComponent(h.get("oai-authenticated-user-full-name") || displayName); } catch { /* Keep email name. */ }
  }
  return { userId, email, displayName, source: "sites" };
}
export function isAdminIdentity(identity: Pick<Identity, "userId" | "email" | "isOwner"> | null) {
  const bindings = env as unknown as Record<string, string | undefined>;
  return Boolean(identity && identity.isOwner !== false && ((bindings.TIPOOK_ADMIN_USER_ID?.trim() && identity.userId === bindings.TIPOOK_ADMIN_USER_ID.trim())
    || (bindings.TIPOOK_ADMIN_EMAIL?.trim() && identity.email?.toLowerCase() === bindings.TIPOOK_ADMIN_EMAIL.trim().toLowerCase())));
}
export function authCookie(token: string, request: Request, maxAge = SESSION_SECONDS) {
  return `${AUTH_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" && (!origin || origin === new URL(request.url).origin);
}
