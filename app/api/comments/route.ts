import { asc, eq, sql } from "drizzle-orm";
import { currentMember } from "../../../lib/member-identity";
import { getDb } from "../../../db";
import { postComments, posts } from "../../../db/schema";

function validImageKey(value: string | null | undefined) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

export async function GET(request: Request) {
  const postId = Number(new URL(request.url).searchParams.get("postId"));
  if (!Number.isInteger(postId)) return Response.json({ error: "Bài viết không hợp lệ." }, { status: 400 });
  try {
    const comments = await getDb().select().from(postComments).where(eq(postComments.postId, postId)).orderBy(asc(postComments.createdAt), asc(postComments.id)).limit(100);
    return Response.json({ comments: comments.map((comment) => ({ ...comment, imageUrl: validImageKey(comment.imageKey) ? "/api/files?key=" + encodeURIComponent(comment.imageKey as string) : null })) });
  } catch {
    return Response.json({ error: "Chưa thể tải bình luận." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { postId?: number; content?: string; imageKey?: string };
    const postId = Number(body.postId);
    const content = body.content?.trim() ?? "";
    const imageKey = body.imageKey?.trim() ?? "";
    if (!Number.isInteger(postId) || (!content && !imageKey)) return Response.json({ error: "Vui lòng nhập bình luận hoặc chọn ảnh." }, { status: 400 });
    if (imageKey && !validImageKey(imageKey)) return Response.json({ error: "Ảnh bình luận không hợp lệ." }, { status: 400 });
    if (content.length > 600) return Response.json({ error: "Bình luận tối đa 600 ký tự." }, { status: 400 });
    const { userId, authorName } = await currentMember();
    const db = getDb();
    const [comment] = await db.insert(postComments).values({ postId, content, imageKey: imageKey || null, userId, authorName }).returning();
    await db.update(posts).set({ comments: sql`${posts.comments} + 1` }).where(eq(posts.id, postId));
    return Response.json({ comment: { ...comment, imageUrl: validImageKey(comment.imageKey) ? "/api/files?key=" + encodeURIComponent(comment.imageKey as string) : null } }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể gửi bình luận lúc này." }, { status: 500 });
  }
}
