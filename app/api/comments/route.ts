import { asc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { postComments, posts } from "../../../db/schema";

async function currentMember() {
  const h = await headers();
  const encodedName = h.get("oai-authenticated-user-full-name");
  const email = h.get("oai-authenticated-user-email");
  return {
    userId: h.get("oai-authenticated-user-id") ?? "private-member",
    authorName: encodedName && h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
      ? decodeURIComponent(encodedName)
      : email?.split("@")[0] ?? "Thành viên",
  };
}

export async function GET(request: Request) {
  const postId = Number(new URL(request.url).searchParams.get("postId"));
  if (!Number.isInteger(postId)) return Response.json({ error: "Bài viết không hợp lệ." }, { status: 400 });
  try {
    const comments = await getDb().select().from(postComments).where(eq(postComments.postId, postId)).orderBy(asc(postComments.createdAt), asc(postComments.id)).limit(100);
    return Response.json({ comments });
  } catch {
    return Response.json({ error: "Chưa thể tải bình luận." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { postId?: number; content?: string };
    const postId = Number(body.postId);
    const content = body.content?.trim() ?? "";
    if (!Number.isInteger(postId) || !content) return Response.json({ error: "Vui lòng nhập bình luận." }, { status: 400 });
    if (content.length > 600) return Response.json({ error: "Bình luận tối đa 600 ký tự." }, { status: 400 });
    const member = await currentMember();
    const db = getDb();
    const [comment] = await db.insert(postComments).values({ postId, content, ...member }).returning();
    await db.update(posts).set({ comments: sql`${posts.comments} + 1` }).where(eq(posts.id, postId));
    return Response.json({ comment }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể gửi bình luận lúc này." }, { status: 500 });
  }
}
