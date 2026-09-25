import { and, asc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { postComments, posts } from "../../../db/schema";

const discussionCategory = "Thảo luận mẫu nhà";

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

async function findDiscussion(targetId: string) {
  const [post] = await getDb().select().from(posts).where(and(eq(posts.category, discussionCategory), eq(posts.title, targetId))).limit(1);
  return post;
}

export async function GET(request: Request) {
  const targetId = new URL(request.url).searchParams.get("targetId")?.trim() ?? "";
  if (!targetId) return Response.json({ error: "Mẫu nhà không hợp lệ." }, { status: 400 });
  try {
    const post = await findDiscussion(targetId);
    if (!post) return Response.json({ comments: [] });
    const comments = await getDb().select().from(postComments).where(eq(postComments.postId, post.id)).orderBy(asc(postComments.createdAt), asc(postComments.id)).limit(100);
    return Response.json({ comments });
  } catch {
    return Response.json({ error: "Chưa thể tải bình luận." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { targetId?: string; content?: string };
    const targetId = body.targetId?.trim().slice(0, 120) ?? "";
    const content = body.content?.trim() ?? "";
    if (!targetId || !content) return Response.json({ error: "Vui lòng nhập bình luận." }, { status: 400 });
    if (content.length > 600) return Response.json({ error: "Bình luận tối đa 600 ký tự." }, { status: 400 });
    const db = getDb();
    let post = await findDiscussion(targetId);
    const member = await currentMember();
    if (!post) {
      [post] = await db.insert(posts).values({ userId: member.userId, authorName: member.authorName, category: discussionCategory, title: targetId, content: `Thảo luận về mẫu nhà: ${targetId}` }).returning();
    }
    if (!post) throw new Error("Không thể tạo luồng thảo luận.");
    const [comment] = await db.insert(postComments).values({ postId: post.id, content, ...member }).returning();
    await db.update(posts).set({ comments: sql`${posts.comments} + 1` }).where(eq(posts.id, post.id));
    return Response.json({ comment }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể gửi bình luận lúc này." }, { status: 500 });
  }
}
