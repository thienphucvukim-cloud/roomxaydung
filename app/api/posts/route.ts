import { and, asc, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { currentMember } from "../../../lib/member-identity";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { memberProfiles, postAttachments, posts, userRequests } from "../../../db/schema";
import { CATALOG_PAGE_SIZE } from "../../../lib/catalog-pagination";
import { parseVndPrice } from "../../../lib/drawing-catalog";

type AttachmentInput = {
  key?: string;
  name?: string;
  type?: string;
  size?: number;
};

function publicAttachment(attachment: { id?: number; objectKey: string; fileName: string; mimeType: string; size: number }) {
  return {
    id: attachment.id,
    key: attachment.objectKey,
    name: attachment.fileName,
    type: attachment.mimeType,
    size: attachment.size,
    url: "/api/files?key=" + encodeURIComponent(attachment.objectKey),
  };
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const params = new URL(request.url).searchParams;
    const category = params.get("category");
    const paginated = ["Bộ sưu tập ảnh", "Bản vẽ cộng đồng", "Nội thất cộng đồng"].includes(category ?? "") && params.has("page");
    const page = Number(params.get("page") ?? 1);
    if (paginated && (!Number.isSafeInteger(page) || page < 1 || page > 1000000)) {
      return Response.json({ error: "Số trang không hợp lệ." }, { status: 400 });
    }
    const query = params.get("q")?.trim().slice(0, 120) ?? "";
    const search = paginated && query ? or(...[posts.title, posts.content, posts.authorName, posts.feeling, posts.location, posts.pollQuestion].map((column) => sql`instr(lower(coalesce(${column}, '')), lower(${query})) > 0`)) : undefined;
    const condition = and(eq(posts.audience, "Công khai"), category ? eq(posts.category, category) : ne(posts.category, "Thảo luận mẫu nhà"), search);
    const total = paginated ? (await db.select({ value: count() }).from(posts).where(condition))[0].value : undefined;
    const rows = await db.select().from(posts).where(condition).orderBy(desc(posts.createdAt), desc(posts.id)).limit(paginated ? CATALOG_PAGE_SIZE : 30).offset(paginated ? (page - 1) * CATALOG_PAGE_SIZE : 0);
    let attachmentRows: Array<typeof postAttachments.$inferSelect> = [];
    if (rows.length) {
      try {
        attachmentRows = await db.select().from(postAttachments).where(inArray(postAttachments.postId, rows.map((post) => post.id))).orderBy(asc(postAttachments.id));
      } catch {
        attachmentRows = [];
      }
    }
    const byPost = new Map<number, ReturnType<typeof publicAttachment>[]>();
    for (const attachment of attachmentRows) {
      if (attachment.accessType !== "public") continue;
      const current = byPost.get(attachment.postId) ?? [];
      current.push(publicAttachment(attachment));
      byPost.set(attachment.postId, current);
    }
    const galleryPostIds = rows.filter(post => post.category === "Bộ sưu tập ảnh").map(post => String(post.id));
    const questionCounts = galleryPostIds.length
      ? await db.select({ targetId: userRequests.targetId, value: count() }).from(userRequests)
        .where(and(eq(userRequests.requestType, "expert-question"), eq(userRequests.targetType, "post"), inArray(userRequests.targetId, galleryPostIds)))
        .groupBy(userRequests.targetId)
      : [];
    const questionsByPost = new Map(questionCounts.map(row => [row.targetId, row.value]));
    return Response.json({ posts: rows.map((post) => ({ ...post, ...(post.category === "Bộ sưu tập ảnh" ? { expertQuestions: questionsByPost.get(String(post.id)) ?? 0 } : {}), attachments: byPost.get(post.id) ?? [] })), ...(paginated ? { total, page, pageSize: CATALOG_PAGE_SIZE } : {}) });
  } catch (cause) {
    console.error("Failed to load posts", cause);
    return Response.json({ error: "Chưa thể tải bài đăng. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, email, authorName } = await currentMember();
    const body = await request.json() as { title?: string; content?: string; category?: string; location?: string; audience?: string; feeling?: string; pollQuestion?: string; attachments?: AttachmentInput[]; paidFiles?: AttachmentInput[]; coverImageKey?: unknown };
    const category = body.category?.trim() ?? "";
    if (!["Bản vẽ cộng đồng", "Nội thất cộng đồng", "Bộ sưu tập ảnh"].includes(category)) return Response.json({ error: "Danh mục đăng tải không hợp lệ." }, { status: 400 });
    const isFileListing = category === "Bản vẽ cộng đồng" || category === "Nội thất cộng đồng";
    const price = body.pollQuestion?.trim() || "";
    if (isFileListing && price && !/^(?:0\s*đ?|miễn phí)$/i.test(price) && !parseVndPrice(price)) return Response.json({ error: "Giá bán phải từ 2.000đ hoặc để trống cho hồ sơ miễn phí." }, { status: 400 });
    const enteredTitle = body.title?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    const fallbackTitle = category === "Bản vẽ cộng đồng"
      ? "Bản vẽ mới"
      : category === "Nội thất cộng đồng"
        ? "Hồ sơ nội thất mới"
        : category === "Bộ sưu tập ảnh"
        ? "Bộ sưu tập mẫu nhà"
        : "Bộ sưu tập mẫu nhà";
    const title = enteredTitle || content.slice(0, 80) || fallbackTitle;
    if (enteredTitle.length > 120 || content.length > 1200) return Response.json({ error: "Nội dung vượt quá độ dài cho phép." }, { status: 400 });

    const db = getDb();
    const effectiveUserId = userId;
    const [profile] = await db.select({ accountType: memberProfiles.accountType }).from(memberProfiles).where(eq(memberProfiles.userId, effectiveUserId)).limit(1);
    if (isFileListing && profile?.accountType !== "engineer" && profile?.accountType !== "architect") {
      return Response.json({ error: "Bạn cần chuyển sang tài khoản Kỹ sư hoặc Kiến trúc sư trước khi đăng bản vẽ." }, { status: 403 });
    }

    const validAttachment = (attachment: AttachmentInput, maxSize: number) =>
      typeof attachment.key === "string" &&
      /^[0-9a-f-]{36}$/i.test(attachment.key) &&
      typeof attachment.name === "string" &&
      attachment.name.length > 0 &&
      attachment.name.length <= 255 &&
      typeof attachment.size === "number" &&
      attachment.size > 0 &&
      attachment.size <= maxSize;
    const attachments = (body.attachments ?? []).slice(0, 10).filter((attachment) => validAttachment(attachment, 25 * 1024 * 1024));
    if (body.coverImageKey !== undefined) {
      if (typeof body.coverImageKey !== "string" || !attachments.some(attachment => attachment.key === body.coverImageKey)) {
        return Response.json({ error: "Ảnh đại diện phải là một ảnh được chọn cho bài đăng." }, { status: 400 });
      }
      // The first public attachment is the cover, persisted by insertion order.
      // Older posts keep their first uploaded image as their default cover.
      attachments.sort((a, b) => Number(b.key === body.coverImageKey) - Number(a.key === body.coverImageKey));
    }
    const paidFiles = (body.paidFiles ?? []).slice(0, 5).filter((attachment) => validAttachment(attachment, 100 * 1024 * 1024));
    if (isFileListing && !paidFiles.length) return Response.json({ error: "Vui lòng chọn ít nhất một file hồ sơ." }, { status: 400 });
    if (!isFileListing && paidFiles.length) return Response.json({ error: "Bộ sưu tập ảnh không hỗ trợ file bán." }, { status: 400 });
    const keys = [...attachments, ...paidFiles].map(file => file.key);
    if (new Set(keys).size !== keys.length) return Response.json({ error: "Không thể đính kèm cùng một tệp nhiều lần." }, { status: 400 });
    for (const [files, accessType] of [[attachments, "public"], [paidFiles, "private"]] as const) {
      for (const file of files) {
        const object = await env.BUCKET?.head(file.key as string);
        if (!object || object.customMetadata?.ownerUserId !== userId || object.customMetadata?.accessType !== accessType || object.size !== file.size) {
          return Response.json({ error: "Tệp đính kèm không thuộc phiên tài khoản này hoặc không đúng quyền truy cập." }, { status: 400 });
        }
        if (accessType === "public" && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(object.httpMetadata?.contentType || "")) {
          return Response.json({ error: "Ảnh đại diện phải là JPG, PNG, WebP hoặc GIF." }, { status: 400 });
        }
        const [attached] = await db.select({ id: postAttachments.id }).from(postAttachments).where(eq(postAttachments.objectKey, file.key as string)).limit(1);
        if (attached) return Response.json({ error: "Tệp đã được dùng trong một bài đăng khác. Vui lòng tải lại tệp." }, { status: 409 });
      }
    }

    await db.insert(memberProfiles).values({
      userId: effectiveUserId,
      displayName: authorName,
      email: email ?? null,
    }).onConflictDoUpdate({
      target: memberProfiles.userId,
      set: {
        displayName: authorName,
        email: email ?? null,
        updatedAt: new Date().toISOString(),
      },
    });

    const [post] = await db.insert(posts).values({
      userId: effectiveUserId,
      authorName,
      category,
      title,
      content,
      location: body.location?.trim() || null,
      audience: body.audience?.slice(0, 40) || "Công khai",
      feeling: body.feeling?.slice(0, 80) || null,
      pollQuestion: body.pollQuestion?.trim().slice(0, 240) || null,
    }).returning();

    let savedAttachments: ReturnType<typeof publicAttachment>[] = [];
    const attachmentValues = [
      ...attachments.map((attachment) => ({ postId: post.id, objectKey: attachment.key as string, fileName: attachment.name as string, mimeType: attachment.type?.slice(0, 120) || "application/octet-stream", size: attachment.size as number, accessType: "public" })),
      ...paidFiles.map((attachment) => ({ postId: post.id, objectKey: attachment.key as string, fileName: attachment.name as string, mimeType: attachment.type?.slice(0, 120) || "application/octet-stream", size: attachment.size as number, accessType: "private" })),
    ];
    if (attachmentValues.length) {
      const inserted = await db.insert(postAttachments).values(attachmentValues).returning();
      savedAttachments = inserted.filter((attachment) => attachment.accessType === "public").sort((a, b) => a.id - b.id).map(publicAttachment);
    }

    return Response.json({ post: { ...post, attachments: savedAttachments } }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể đăng bài lúc này. Vui lòng thử lại." }, { status: 500 });
  }
}
