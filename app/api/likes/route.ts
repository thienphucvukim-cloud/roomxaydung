import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { postLikes, posts } from "../../../db/schema";

async function currentUserId() {
  return (await headers()).get("oai-authenticated-user-id") ?? "private-member";
}

export async function GET(request: Request) {
  try {
    const ids = (new URL(request.url).searchParams.get("ids") || "").split(",").map(Number).filter(Number.isInteger);
    if (!ids.length) return Response.json({ likedPostIds: [] });
    const rows = await getDb().select({ postId: postLikes.postId }).from(postLikes).where(and(eq(postLikes.userId, await currentUserId()), inArray(postLikes.postId, ids)));
    return Response.json({ likedPostIds: rows.map((row) => row.postId) });
  } catch {
    return Response.json({ error: "Chưa thể tải lượt thích." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { postId?: number };
    const postId = Number(body.postId);
    if (!Number.isInteger(postId)) return Response.json({ error: "Bài viết không hợp lệ." }, { status: 400 });
    const db = getDb();
    const inserted = await db.insert(postLikes).values({ postId, userId: await currentUserId() }).onConflictDoNothing().returning();
    if (inserted.length) {
      const [post] = await db.select({ likes: posts.likes }).from(posts).where(eq(posts.id, postId));
      await db.update(posts).set({ likes: (post?.likes ?? 0) + 1 }).where(eq(posts.id, postId));
    }
    return Response.json({ liked: true, added: inserted.length === 1 });
  } catch {
    return Response.json({ error: "Chưa thể ghi nhận lúc này." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { postId?: number };
    const postId = Number(body.postId);
    if (!Number.isInteger(postId)) return Response.json({ error: "Bài viết không hợp lệ." }, { status: 400 });
    const db = getDb();
    const removed = await db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, await currentUserId()))).returning();
    if (removed.length) {
      const [post] = await db.select({ likes: posts.likes }).from(posts).where(eq(posts.id, postId));
      await db.update(posts).set({ likes: Math.max((post?.likes ?? 1) - 1, 0) }).where(eq(posts.id, postId));
    }
    return Response.json({ liked: false, removed: removed.length === 1 });
  } catch {
    return Response.json({ error: "Chưa thể bỏ lượt thích." }, { status: 500 });
  }
}
