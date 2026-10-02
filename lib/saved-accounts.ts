import { cookies } from "next/headers";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { websiteAccounts, websiteSessions } from "@/db/schema";
import { hashToken } from "@/lib/password";
import { AUTH_COOKIE, SESSION_SECONDS } from "@/lib/website-auth";

export const SAVED_ACCOUNTS_COOKIE = "tipook_saved_accounts";
export const MAX_SAVED_ACCOUNTS = 5;

export async function savedAccountTokens() {
  const jar = await cookies();
  const values = [jar.get(AUTH_COOKIE)?.value, ...(jar.get(SAVED_ACCOUNTS_COOKIE)?.value || "").split(".")];
  return [...new Set(values.filter((value): value is string => Boolean(value && /^[a-f0-9]{64}$/.test(value))))].slice(0, MAX_SAVED_ACCOUNTS + 1);
}

// Only live sessions for active accounts may be listed or selected. Owner
// sessions retain the same verification requirement as normal authentication.
export async function getSavedAccounts() {
  const tokens = await savedAccountTokens();
  if (!tokens.length) return [];
  const rows = await getDb().select({ userId: websiteAccounts.userId, name: websiteAccounts.displayName,
    username: websiteAccounts.username, email: websiteAccounts.email, tokenHash: websiteSessions.tokenHash })
    .from(websiteSessions).innerJoin(websiteAccounts, eq(websiteSessions.userId, websiteAccounts.userId))
    .where(and(inArray(websiteSessions.tokenHash, tokens.map(hashToken)), gt(websiteSessions.expiresAt, Date.now()),
      sql`(${websiteAccounts.isOwner} = 0 or ${websiteSessions.ownerVerified} = 1)`,
      sql`not exists (select 1 from member_profiles where user_id = ${websiteAccounts.userId} and account_status != 'active')`));
  const seen = new Set<string>();
  return tokens.flatMap(token => {
    const row = rows.find(account => account.tokenHash === hashToken(token));
    if (!row || seen.has(row.userId)) return [];
    seen.add(row.userId);
    return [{ ...row, token }];
  });
}

export function savedAccountsCookie(tokens: string[], request: Request) {
  const value = [...new Set(tokens)].slice(0, MAX_SAVED_ACCOUNTS).join(".");
  return `${SAVED_ACCOUNTS_COOKIE}=${value}; Path=/; Max-Age=${value ? SESSION_SECONDS : 0}; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
