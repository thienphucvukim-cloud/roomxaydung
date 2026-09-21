import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { postLikes, posts } from "../../../db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { postId?: number };
    const postId = Number(body.postId);
    if (!Number.isInteger(postId)) return Response.json({ error: "Bài viết không hợp lệ." }, { status: 400 });
    const h = await headers();
    const userId = h.get("oai-authenticated-user-id") ?? "private-member";
    const db = getDb();
    const inserted = await db.insert(postLikes).values({ postId, userId }).onConflictDoNothing().returning();
    if (inserted.length) await db.update(posts).set({ likes: sql`${posts.likes} + 1` }).where(eq(posts.id, postId));
    return Response.json({ liked: true, added: inserted.length === 1 });
  } catch {
    return Response.json({ error: "Chưa thể ghi nhận lúc này." }, { status: 500 });
  }
}
