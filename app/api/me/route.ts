import { count, eq } from "drizzle-orm";
import { currentMember } from "../../../lib/member-identity";
import { getAuthenticatedIdentity, isAdminIdentity } from "../../../lib/website-auth";
import { getDb } from "../../../db";
import { memberProfiles, posts, userActions, userRequests } from "../../../db/schema";

export async function GET() {
  try {
    const { userId, email, displayName: name } = await currentMember();
    const db = getDb();
    await db.insert(memberProfiles).values({ userId, displayName: name, email }).onConflictDoUpdate({ target: memberProfiles.userId, set: { displayName: name, email, updatedAt: new Date().toISOString() } });
    const [[postCount], [actionCount], [requestCount], [profile]] = await Promise.all([
      db.select({ value: count() }).from(posts).where(eq(posts.userId, userId)),
      db.select({ value: count() }).from(userActions).where(eq(userActions.userId, userId)),
      db.select({ value: count() }).from(userRequests).where(eq(userRequests.userId, userId)),
      db.select({ accountType: memberProfiles.accountType, profession: memberProfiles.profession }).from(memberProfiles).where(eq(memberProfiles.userId, userId)).limit(1),
    ]);
    const identity = await getAuthenticatedIdentity();
    const authenticated = Boolean(identity);
    const isAdmin = isAdminIdentity(identity);
    return Response.json({ user: { id: userId, name, email, authenticated, isAdmin, accountType: profile?.accountType ?? "user", profession: profile?.profession ?? null }, counts: { posts: postCount.value, actions: actionCount.value, requests: requestCount.value } });
  } catch {
    return Response.json({ error: "Chưa thể tải hồ sơ." }, { status: 500 });
  }
}
