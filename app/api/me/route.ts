import { count, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { posts, userActions, userRequests } from "../../../db/schema";

export async function GET() {
  try {
    const h = await headers();
    const userId = h.get("oai-authenticated-user-id") ?? "private-member";
    const email = h.get("oai-authenticated-user-email") ?? "thanhvien@tipook.local";
    const encodedName = h.get("oai-authenticated-user-full-name");
    const name = encodedName && h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
      ? decodeURIComponent(encodedName)
      : email.split("@")[0] || "Thành viên Tipook";
    const db = getDb();
    const [[postCount], [actionCount], [requestCount]] = await Promise.all([
      db.select({ value: count() }).from(posts).where(eq(posts.userId, userId)),
      db.select({ value: count() }).from(userActions).where(eq(userActions.userId, userId)),
      db.select({ value: count() }).from(userRequests).where(eq(userRequests.userId, userId)),
    ]);
    return Response.json({ user: { id: userId, name, email }, counts: { posts: postCount.value, actions: actionCount.value, requests: requestCount.value } });
  } catch {
    return Response.json({ error: "Chưa thể tải hồ sơ." }, { status: 500 });
  }
}
