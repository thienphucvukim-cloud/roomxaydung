import { memberAccessResponse } from "@/lib/member-access";
import { and, asc, count, desc, eq, getTableColumns, gt, inArray, lt, lte, max, ne, or, sql } from "drizzle-orm";
import { currentMember } from "../../../lib/member-identity";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { catalogDownloads, catalogViews, userActions, memberProfiles, postAttachments, posts, userRequests } from "../../../db/schema";
import { CATALOG_PAGE_SIZE } from "../../../lib/catalog-pagination";
import { FILE_CATALOG_PAGE_SIZE, PROMOTION_CATEGORIES } from "../../../lib/catalog-promotions";
import { parseVndPrice } from "../../../lib/drawing-catalog";
import { FACADE_RANDOM_MODULUS, facadeOrderKey, parseFacadeSort } from "../../../lib/facade-feed";
import { AUTHOR_POST_STATES } from "@/lib/post-ownership";
import { parseFileCatalogSort } from "@/lib/file-catalog-sort";
import { fileCatalogRanking } from "@/lib/file-catalog-ranking";

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
    const facadeFeed = category === "Bộ sưu tập ảnh";
    const randomFeed = category === "Bộ sưu tập ảnh" && params.has("seed");
    const sort = parseFacadeSort(params.get("sort"));
    const rankedFeed = randomFeed && sort !== "random";
    const seed = Number(params.get("seed"));
    const cursor = params.get("cursor");
    const cursorParts = cursor?.split(":").map(Number);
    if (randomFeed && (!Number.isSafeInteger(seed) || seed < 1 || seed >= FACADE_RANDOM_MODULUS ||
      (cursor !== null && (!/^\d+:\d+:\d+$/.test(cursor) || cursorParts?.some(value => !Number.isSafeInteger(value)) || cursorParts?.length !== 3 || (!rankedFeed && cursorParts[1] >= FACADE_RANDOM_MODULUS))))) {
      return Response.json({ error: "Thứ tự tải ảnh không hợp lệ." }, { status: 400 });
    }
    const paginated = ["Bộ sưu tập ảnh", "Bản vẽ cộng đồng", "Nội thất cộng đồng"].includes(category ?? "") && params.has("page");
    const fileCatalog = paginated && PROMOTION_CATEGORIES.some(value => value === category);
    const fileSort = parseFileCatalogSort(params.get("sort"));
    let modelKeys: string[] = [];
    if (fileCatalog && category === "Bản vẽ cộng đồng" && params.has("modelKeys")) {
      try {
        const keys: unknown = JSON.parse(params.get("modelKeys")!);
        if (!Array.isArray(keys) || keys.length > 50 || keys.some(key => typeof key !== "string" || key.length > 180)) throw new Error();
        modelKeys = keys;
      } catch { return Response.json({ error: "Danh sách bản vẽ không hợp lệ." }, { status: 400 }); }
    }
    const pageSize = fileCatalog ? FILE_CATALOG_PAGE_SIZE : CATALOG_PAGE_SIZE;
    const promotionPosition = fileCatalog ? sql<number | null>`(select cp.position from catalog_promotions cp where cp.post_id = ${posts.id} and cp.category = ${posts.category} and cp.starts_at <= ${new Date().toISOString()} and cp.expires_at > ${new Date().toISOString()} limit 1)` : sql<null>`null`;
    const page = Number(params.get("page") ?? 1);
    if (paginated && (!Number.isSafeInteger(page) || page < 1 || page > 1000000)) {
      return Response.json({ error: "Số trang không hợp lệ." }, { status: 400 });
    }
    const query = params.get("q")?.trim().slice(0, 120) ?? "";
    const search = (paginated || randomFeed) && query ? or(...[posts.title, posts.content, posts.authorName, posts.feeling, posts.location, posts.pollQuestion].map((column) => sql`instr(lower(coalesce(${column}, '')), lower(${query})) > 0`)) : undefined;
    const targetPostId = params.get("postId");
    if (targetPostId !== null && (!/^[1-9]\d*$/.test(targetPostId) || !Number.isSafeInteger(Number(targetPostId)))) {
      return Response.json({ error: "Bài đăng không hợp lệ." }, { status: 400 });
    }
    // Show drawing previews directly from their source post so edits, visibility
    // and deletion stay in sync. Private attachments never enter this feed.
    const categoryCondition = facadeFeed
      ? inArray(posts.category, ["Bộ sưu tập ảnh", "Bản vẽ cộng đồng"])
      : category ? eq(posts.category, category) : ne(posts.category, "Thảo luận mẫu nhà");
    const condition = and(eq(posts.audience, "Công khai"), categoryCondition, search, targetPostId ? eq(posts.id, Number(targetPostId)) : undefined);
    const total = paginated ? (await db.select({ value: count() }).from(posts).where(condition))[0].value : undefined;
    const snapshot = randomFeed ? cursorParts?.[0] ?? (await db.select({ value: max(posts.id) }).from(posts).where(condition))[0].value ?? 0 : 0;
    const randomValue = sql`((${posts.id} * 48271 + cast(${seed} as integer)) % 2147483647)`;
    const randomOrder = sql<number>`((${randomValue} * ${randomValue}) % 2147483647)`;
    const rankScore = sort === "views"
      ? sql<number>`(select count(*) from ${catalogViews} where ${catalogViews.targetType} = 'post' and ${catalogViews.targetId} = cast("posts"."id" as text))`
      : sql<number>`(select count(*) from ${userActions} where ${userActions.actionType} = 'like' and ${userActions.targetType} = 'post' and ${userActions.targetId} = cast("posts"."id" as text))`;
    const feedOrder = rankedFeed ? rankScore : randomOrder;
    const feedCondition = randomFeed ? and(condition, lte(posts.id, snapshot), cursorParts ? or(rankedFeed ? lt(feedOrder, cursorParts[1]) : gt(feedOrder, cursorParts[1]), and(eq(feedOrder, cursorParts[1]), gt(posts.id, cursorParts[2]))) : undefined) : condition;
    const catalogOrder = fileCatalog && fileSort !== "latest" ? await fileCatalogRanking(condition, fileSort, page, targetPostId ? [] : modelKeys, promotionPosition) : null;
    const selectedPostIds = catalogOrder?.flatMap(entry => entry.postId === null ? [] : [entry.postId]);
    const fetchedRows = await db.select({ ...getTableColumns(posts), promotionPosition, sortScore: rankedFeed ? rankScore : sql<number>`0`, ...(fileCatalog ? { downloads: sql<number>`(select count(*) from ${catalogDownloads} where ${catalogDownloads.targetType} = 'post' and ${catalogDownloads.targetId} = cast("posts"."id" as text))` } : {}) }).from(posts).where(catalogOrder ? and(condition, inArray(posts.id, selectedPostIds?.length ? selectedPostIds : [-1])) : feedCondition)
      .orderBy(...(randomFeed ? [rankedFeed ? desc(feedOrder) : asc(feedOrder), asc(posts.id)] : [...(fileCatalog ? [asc(sql`coalesce(${promotionPosition}, 17)`)] : []), desc(posts.createdAt), desc(posts.id)]))
      .limit(randomFeed ? CATALOG_PAGE_SIZE + 1 : paginated ? pageSize : 30).offset(!catalogOrder && !randomFeed && paginated ? (page - 1) * pageSize : 0);
    const rows = randomFeed ? fetchedRows.slice(0, CATALOG_PAGE_SIZE) : fetchedRows;
    const last = rows.at(-1);
    const nextCursor = randomFeed && fetchedRows.length > CATALOG_PAGE_SIZE && last ? `${snapshot}:${rankedFeed ? last.sortScore : facadeOrderKey(last.id, seed)}:${last.id}` : null;
    const modelScores = rankedFeed ? Object.fromEntries((sort === "views"
      ? await db.select({ key: catalogViews.targetId, score: count() }).from(catalogViews).where(eq(catalogViews.targetType, "house-model")).groupBy(catalogViews.targetId)
      : await db.select({ key: userActions.targetId, score: count() }).from(userActions).where(and(eq(userActions.targetType, "house-model"), eq(userActions.actionType, "like"))).groupBy(userActions.targetId)
    ).map(row => [row.key, row.score])) : undefined;
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
    const galleryPostIds = rows.filter(post => ["Bộ sưu tập ảnh", "Bản vẽ cộng đồng"].includes(post.category)).map(post => String(post.id));
    const questionCounts = galleryPostIds.length
      ? await db.select({ targetId: userRequests.targetId, value: count() }).from(userRequests)
        .where(and(eq(userRequests.requestType, "expert-question"), eq(userRequests.targetType, "post"), inArray(userRequests.targetId, galleryPostIds)))
        .groupBy(userRequests.targetId)
      : [];
    const questionsByPost = new Map(questionCounts.map(row => [row.targetId, row.value]));
    return Response.json({ posts: rows.map((post) => ({ ...post, ...(facadeFeed ? { expertQuestions: questionsByPost.get(String(post.id)) ?? 0 } : {}), attachments: byPost.get(post.id) ?? [] })), ...(catalogOrder ? { catalogOrder: catalogOrder.map(entry => entry.entryKey) } : {}), ...(randomFeed ? { nextCursor, ...(rankedFeed ? { modelScores } : {}) } : paginated ? { total, page, pageSize } : {}) });
  } catch (cause) {
    console.error("Failed to load posts", cause);
    return Response.json({ error: "Chưa thể tải bài đăng. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await memberAccessResponse();
  if (denied) return denied;
  try {
    const { userId, email, authorName } = await currentMember();
    const body = await request.json() as { title?: string; content?: string; category?: string; location?: string; audience?: string; feeling?: string; pollQuestion?: string; attachments?: AttachmentInput[]; paidFiles?: AttachmentInput[]; coverImageKey?: unknown };
    if (body.audience !== undefined && !AUTHOR_POST_STATES.includes(body.audience)) return Response.json({ error: "Quyền hiển thị bài đăng không hợp lệ." }, { status: 400 });
    const category = body.category?.trim() ?? "";
    if (!["Bảng tin", "Bản vẽ cộng đồng", "Nội thất cộng đồng", "Bộ sưu tập ảnh"].includes(category)) return Response.json({ error: "Danh mục đăng tải không hợp lệ." }, { status: 400 });
    const isFileListing = category === "Bản vẽ cộng đồng" || category === "Nội thất cộng đồng";
    const price = body.pollQuestion?.trim() || "";
    if (isFileListing && price && !/^(?:0\s*đ?|miễn phí)$/i.test(price) && !parseVndPrice(price)) return Response.json({ error: "Giá bán phải từ 2.000đ hoặc để trống cho hồ sơ miễn phí." }, { status: 400 });
    const enteredTitle = body.title?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    if (category === "Bảng tin" && !content && !body.attachments?.length) return Response.json({ error: "Vui lòng nhập nội dung hoặc thêm ảnh." }, { status: 400 });
    const fallbackTitle = category === "Bảng tin" ? "Bài đăng trên bảng tin" : category === "Bản vẽ cộng đồng"
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
    if (category === "Bảng tin" && !content && !attachments.length) return Response.json({ error: "Vui lòng nhập nội dung hoặc thêm ảnh hợp lệ." }, { status: 400 });
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
