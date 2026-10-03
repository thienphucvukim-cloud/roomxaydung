import { memberAccessResponse } from "@/lib/member-access";
import { and, asc, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { currentMember } from "../../../lib/member-identity";
import { getDb } from "../../../db";
import { memberProfiles, postComments, posts } from "../../../db/schema";
import { getPaymentBuyerId } from "@/lib/payment-identity";
import { OWN_POST_HIDDEN } from "@/lib/post-ownership";
import { memberAvatarUrl } from "@/lib/member-avatar";

function validImageKey(value: string | null | undefined) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const postId = Number(params.get("postId"));
  const paginated = params.has("limit");
  const limit = Number(params.get("limit") ?? 100);
  const beforeId = params.has("beforeId") ? Number(params.get("beforeId")) : undefined;
  if (!Number.isSafeInteger(postId) || postId < 1) return Response.json({ error: "Bài viết không hợp lệ." }, { status: 400 });
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || (beforeId !== undefined && (!paginated || !Number.isSafeInteger(beforeId) || beforeId < 1))) return Response.json({ error: "Trang bình luận không hợp lệ." }, { status: 400 });
  try {
    const userId = await getPaymentBuyerId();
    const [post] = await getDb().select({ id: posts.id }).from(posts).where(and(eq(posts.id, postId),
      or(eq(posts.audience, "Công khai"), userId ? and(eq(posts.userId, userId), inArray(posts.audience, [OWN_POST_HIDDEN, "Ẩn bởi quản trị"])) : undefined))).limit(1);
    if (!post) return Response.json({ error: "Bài viết không còn hiển thị." }, { status: 404 });
    const db = getDb();
    const [rows, totals] = await Promise.all([
      db.select().from(postComments).where(and(eq(postComments.postId, postId), beforeId === undefined ? undefined : lt(postComments.id, beforeId)))
        .orderBy(...(paginated ? [desc(postComments.id)] : [asc(postComments.createdAt), asc(postComments.id)])).limit(paginated ? limit + 1 : limit),
      db.select({ value: count() }).from(postComments).where(eq(postComments.postId, postId)),
    ]);
    const selected = rows.slice(0, limit);
    const nextCursor = paginated && rows.length > limit ? selected.at(-1)?.id ?? null : null;
    const comments = paginated ? selected.reverse() : selected;
    const authors = comments.length ? await db.select().from(memberProfiles).where(inArray(memberProfiles.userId, [...new Set(comments.map(comment => comment.userId))])) : [];
    const avatars = new Map(authors.map(author => [author.userId, memberAvatarUrl(author)]));
    return Response.json({ total: totals[0].value, nextCursor, comments: comments.map((comment) => ({ ...comment, avatarUrl: avatars.get(comment.userId) ?? null, imageUrl: validImageKey(comment.imageKey) ? "/api/files?key=" + encodeURIComponent(comment.imageKey as string) : null })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Chưa thể tải bình luận." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  try {
    const body = await request.json() as { postId?: number; content?: string; imageKey?: string };
    const postId = Number(body.postId);
    if ((body.content !== undefined && typeof body.content !== "string") || (body.imageKey !== undefined && typeof body.imageKey !== "string")) return Response.json({ error: "Bình luận không hợp lệ." }, { status: 400 });
    const content = body.content?.trim() ?? "";
    const imageKey = body.imageKey?.trim() ?? "";
    if (!Number.isSafeInteger(postId) || postId < 1 || (!content && !imageKey)) return Response.json({ error: "Vui lòng nhập bình luận hoặc chọn ảnh." }, { status: 400 });
    if (imageKey && !validImageKey(imageKey)) return Response.json({ error: "Ảnh bình luận không hợp lệ." }, { status: 400 });
    if (content.length > 600) return Response.json({ error: "Bình luận tối đa 600 ký tự." }, { status: 400 });
    const { userId, authorName } = await currentMember();
    const db = getDb();
    const [post] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, postId), eq(posts.audience, "Công khai"))).limit(1);
    if (!post) return Response.json({ error: "Bài viết không còn hiển thị." }, { status: 404 });
    if (imageKey) {
      if (!env.BUCKET) throw new Error("Kho lưu trữ ảnh chưa được cấu hình.");
      const image = await env.BUCKET.head(imageKey);
      if (!image || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.httpMetadata?.contentType ?? "") || image.customMetadata?.accessType === "private") return Response.json({ error: "Ảnh bình luận không hợp lệ hoặc không còn tồn tại." }, { status: 400 });
      if (image.customMetadata?.ownerUserId !== userId) return Response.json({ error: "Vui lòng tải ảnh bình luận từ tài khoản của bạn." }, { status: 403 });
    }
    const [comment] = await db.insert(postComments).values({ postId, content, imageKey: imageKey || null, userId, authorName }).returning();
    await db.update(posts).set({ comments: sql`${posts.comments} + 1` }).where(eq(posts.id, postId));
    const [profiles, totals] = await Promise.all([
      db.select().from(memberProfiles).where(eq(memberProfiles.userId, userId)).limit(1),
      db.select({ value: count() }).from(postComments).where(eq(postComments.postId, postId)),
    ]);
    return Response.json({ total: totals[0].value, comment: { ...comment, avatarUrl: profiles[0] ? memberAvatarUrl(profiles[0]) : null, imageUrl: validImageKey(comment.imageKey) ? "/api/files?key=" + encodeURIComponent(comment.imageKey as string) : null } }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể gửi bình luận lúc này." }, { status: 500 });
  }
}
