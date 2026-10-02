import { count, eq } from "drizzle-orm";
import { currentMember } from "../../../lib/member-identity";
import { getAuthenticatedIdentity, isAdminIdentity } from "../../../lib/website-auth";
import { getDb } from "../../../db";
import { memberProfiles, posts, userActions, userRequests } from "../../../db/schema";
import { memberAvatarUrl } from "@/lib/member-avatar";

export async function GET() {
  try {
    const identity = await getAuthenticatedIdentity();
    if (!identity) return Response.json({ user: null, counts: { posts: 0, actions: 0, requests: 0 } }, { headers: { "Cache-Control": "private, no-store" } });
    const { userId, email, displayName: name } = await currentMember();
    const db = getDb();
    await db.insert(memberProfiles).values({ userId, displayName: name, email }).onConflictDoUpdate({ target: memberProfiles.userId, set: { displayName: name, email, updatedAt: new Date().toISOString() } });
    const [[postCount], [actionCount], [requestCount], [profile]] = await Promise.all([
      db.select({ value: count() }).from(posts).where(eq(posts.userId, userId)),
      db.select({ value: count() }).from(userActions).where(eq(userActions.userId, userId)),
      db.select({ value: count() }).from(userRequests).where(eq(userRequests.userId, userId)),
      db.select({ accountType: memberProfiles.accountType, profession: memberProfiles.profession, avatarKey: memberProfiles.avatarKey, googleAvatarUrl: memberProfiles.googleAvatarUrl }).from(memberProfiles).where(eq(memberProfiles.userId, userId)).limit(1),
    ]);
    const authenticated = Boolean(identity);
    const isAdmin = isAdminIdentity(identity);
    return Response.json({ user: { id: userId, name, email, avatarUrl: memberAvatarUrl(profile), hasCustomAvatar: Boolean(profile?.avatarKey), username: identity?.username ?? null, authenticated, isAdmin, passwordAccount: identity?.source === "website" && identity.hasPassword, accountType: profile?.accountType ?? "user", profession: profile?.profession ?? null }, counts: { posts: postCount.value, actions: actionCount.value, requests: requestCount.value } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Chưa thể tải hồ sơ." }, { status: 500 });
  }
}
