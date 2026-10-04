import { POST_CATEGORIES } from "@/lib/legacy-contracts";
import { memberAccessResponse } from "@/lib/member-access";
import { and, asc, eq, sql } from "drizzle-orm";
import { currentMember } from "../../../lib/member-identity";
import { getDb } from "../../../db";
import { postComments, posts } from "../../../db/schema";
import { env } from "cloudflare:workers";
import { isOptimizedImageObject } from "@/lib/image-upload-policy";

const discussionCategory = POST_CATEGORIES.modelDiscussion;

function imageUrl(imageKey: string | null) {
  return imageKey && /^[0-9a-f-]{36}$/i.test(imageKey) ? "/api/files?key=" + encodeURIComponent(imageKey) : null;
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
    return Response.json({ comments: comments.map(comment => ({ ...comment, imageUrl: imageUrl(comment.imageKey) })) });
  } catch {
    return Response.json({ error: "Chưa thể tải bình luận." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  try {
    const body = await request.json() as { targetId?: string; content?: string; imageKey?: string };
    const targetId = body.targetId?.trim().slice(0, 120) ?? "";
    const content = body.content?.trim() ?? "";
    const imageKey = body.imageKey?.trim() ?? "";
    if (!targetId || (!content && !imageKey)) return Response.json({ error: "Vui lòng nhập bình luận hoặc chọn ảnh." }, { status: 400 });
    if (imageKey && !imageUrl(imageKey)) return Response.json({ error: "Ảnh bình luận không hợp lệ." }, { status: 400 });
    if (content.length > 600) return Response.json({ error: "Bình luận tối đa 600 ký tự." }, { status: 400 });
    const member = await currentMember();
    if (imageKey) {
      if (!env.BUCKET) throw new Error("Kho lưu trữ ảnh chưa được cấu hình.");
      const object = await env.BUCKET.head(imageKey);
      if (!object || object.customMetadata?.accessType !== "public" || !isOptimizedImageObject(object, "comment")) return Response.json({ error: "Vui lòng tải lại ảnh bình luận để nén và chuyển sang WebP." }, { status: 400 });
      if (object.customMetadata?.ownerUserId !== member.userId) return Response.json({ error: "Bạn không có quyền sử dụng ảnh này." }, { status: 403 });
    }
    const db = getDb();
    let post = await findDiscussion(targetId);
    if (!post) {
      [post] = await db.insert(posts).values({ userId: member.userId, authorName: member.authorName, category: discussionCategory, title: targetId, content: `Thảo luận về mẫu nhà: ${targetId}` }).returning();
    }
    if (!post) throw new Error("Không thể tạo luồng thảo luận.");
    const [comment] = await db.insert(postComments).values({ postId: post.id, content, imageKey: imageKey || null, ...member }).returning();
    await db.update(posts).set({ comments: sql`${posts.comments} + 1` }).where(eq(posts.id, post.id));
    return Response.json({ comment: { ...comment, imageUrl: imageUrl(comment.imageKey) } }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể gửi bình luận lúc này." }, { status: 500 });
  }
}
