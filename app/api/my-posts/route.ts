import { normalizePostMetadata, postWithLegacyMetadata } from "@/lib/post-metadata";
import { and, asc, count, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { postAttachments, posts } from "@/db/schema";
import { getPaymentBuyerId } from "@/lib/payment-identity";
import { getAuthenticatedIdentity, isAdminIdentity, validOrigin } from "@/lib/website-auth";
import { AUTHOR_DELETED_STATES, AUTHOR_POST_STATES, MANAGED_POST_CATEGORIES, OWN_POST_DELETED, OWN_POST_HIDDEN, OWN_POST_MODERATED_DELETED } from "@/lib/post-ownership";

const headers = { "Cache-Control": "private, no-store" };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers });
const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function postImages(ids: number[]) {
  if (!ids.length) return [];
  const rows = await getDb().select().from(postAttachments).where(and(inArray(postAttachments.postId, ids),
    eq(postAttachments.accessType, "public"), inArray(postAttachments.mimeType, imageTypes))).orderBy(asc(postAttachments.id));
  return rows.map(row => ({ postId: row.postId, key: row.objectKey, name: row.fileName, type: row.mimeType, size: row.size, url: "/api/files?key=" + encodeURIComponent(row.objectKey) }));
}

export async function GET(request: Request) {
  const userId = await getPaymentBuyerId();
  if (!userId) return reply({ error: "Vui lòng đăng nhập để quản lý bài viết." }, 401);
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return reply({ error: "Số trang không hợp lệ." }, 400);
  const id = params.has("id") ? Number(params.get("id")) : undefined;
  if (id !== undefined && (!Number.isSafeInteger(id) || id < 1)) return reply({ error: "Mã bài không hợp lệ." }, 400);
  if (params.get("trash") === "true") return reply({ error: "Bài bạn đã xóa được lưu trong quản trị." }, 400);
  const condition = and(eq(posts.userId, userId), inArray(posts.category, MANAGED_POST_CATEGORIES),
    notInArray(posts.audience, [...AUTHOR_DELETED_STATES, "Đã xóa bởi quản trị"]),
    id === undefined ? undefined : eq(posts.id, id));
  try {
    const db = getDb();
    const [items, [total]] = await Promise.all([
      db.select().from(posts).where(condition).orderBy(desc(posts.createdAt), desc(posts.id)).limit(20).offset((page - 1) * 20),
      db.select({ value: count() }).from(posts).where(condition),
    ]);
    const images = await postImages(items.map(post => post.id));
    return reply({ posts: items.map(post => ({ ...postWithLegacyMetadata(post), images: images.filter(image => image.postId === post.id) })), total: total.value, totalPages: Math.max(1, Math.ceil(total.value / 20)), isAdmin: isAdminIdentity(await getAuthenticatedIdentity()) });
  } catch { return reply({ error: "Chưa thể tải bài viết của bạn." }, 500); }
}

async function mutate(request: Request, deleting: boolean) {
  if (!validOrigin(request)) return reply({ error: "Nguồn yêu cầu không hợp lệ." }, 403);
  const userId = await getPaymentBuyerId();
  if (!userId) return reply({ error: "Vui lòng đăng nhập để quản lý bài viết." }, 401);
  let body: Record<string, unknown>;
  try {
    body = normalizePostMetadata(await request.json());
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error();
  } catch { return reply({ error: "Dữ liệu không hợp lệ." }, 400); }
  if (typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id < 1) return reply({ error: "Mã bài không hợp lệ." }, 400);
  const allowed = deleting ? ["id"] : ["id", "title", "content", "specifications", "listingType", "imageKeys", "action"];
  if (Object.keys(body).some(key => !allowed.includes(key))) return reply({ error: "Bạn có thể quản lý nội dung và ảnh bài viết. File hồ sơ do quản trị viên quản lý." }, 400);
  const updates: Omit<Partial<typeof posts.$inferInsert>, "audience" | "content"> & { audience?: string | SQL; content?: string | SQL } = {};
  let states = AUTHOR_POST_STATES;
  if (deleting) {
    try {
      const db = getDb();
      const condition = and(eq(posts.id, body.id), eq(posts.userId, userId), inArray(posts.category, MANAGED_POST_CATEGORIES), inArray(posts.audience, [...AUTHOR_POST_STATES, "Ẩn bởi quản trị"]));
      const rows = isAdminIdentity(await getAuthenticatedIdentity())
        ? await db.delete(posts).where(condition).returning({ id: posts.id })
        : await db.update(posts).set({ audience: sql`case when ${posts.audience} = 'Ẩn bởi quản trị' then ${OWN_POST_MODERATED_DELETED} else ${OWN_POST_DELETED} end` }).where(condition).returning({ id: posts.id });
      if (!rows.length) return reply({ error: "Bài viết không thuộc bạn hoặc đã bị xóa." }, 404);
      return reply({ ok: true, id: rows[0].id });
    } catch { return reply({ error: "Chưa thể xóa bài viết." }, 500); }
  } else if (body.action !== undefined) {
    if (Object.keys(body).some(key => key !== "id" && key !== "action")) return reply({ error: "Thao tác không hợp lệ." }, 400);
    if (body.action === "hide") { updates.audience = OWN_POST_HIDDEN; states = ["Công khai"]; }
    else if (body.action === "publish") { updates.audience = "Công khai"; states = [OWN_POST_HIDDEN]; }
    else return reply({ error: "Thao tác không hợp lệ." }, 400);
  } else {
    for (const [key, max] of [["title", 120], ["content", 1200], ["specifications", 240], ["listingType", 80]] as const) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== "string" || body[key].length > max || (key === "title" && !body[key].trim())) return reply({ error: "Nội dung hoặc độ dài không hợp lệ." }, 400);
      updates[key] = body[key].trim();
    }
    states = [...AUTHOR_POST_STATES, "Ẩn bởi quản trị"];
    if (body.imageKeys !== undefined) {
      if (!Array.isArray(body.imageKeys) || body.imageKeys.length > 10 || body.imageKeys.some(key => typeof key !== "string") || new Set(body.imageKeys).size !== body.imageKeys.length) return reply({ error: "Mỗi bài tối đa 10 ảnh, không được trùng nhau." }, 400);
      // Allow an image-only edit without changing the written content.
      if (!Object.keys(updates).length) updates.content = sql`${posts.content}`;
    }
    if (!Object.keys(updates).length) return reply({ error: "Chưa có nội dung cần thay đổi." }, 400);
  }
  try {
    // Ownership and allowed state are checked in the same atomic update.
    const db = getDb();
    const condition = and(eq(posts.id, body.id), eq(posts.userId, userId), inArray(posts.category, MANAGED_POST_CATEGORIES), inArray(posts.audience, states));
    const update = db.update(posts).set(updates).where(condition).returning();
    let changed: typeof posts.$inferSelect[];
    if (Array.isArray(body.imageKeys)) {
      const [owned] = await db.select({ id: posts.id }).from(posts).where(condition).limit(1);
      if (!owned) return reply({ error: "Bài viết không thuộc bạn hoặc không thể thực hiện thao tác này." }, 404);
      const existing = await postImages([body.id]);
      const images: { key: string; name: string; type: string; size: number }[] = [];
      for (const key of body.imageKeys as string[]) {
        const retained = existing.find(image => image.key === key);
        if (retained) { images.push(retained); continue; }
        if (!/^[0-9a-f-]{36}$/i.test(key)) return reply({ error: "Ảnh không hợp lệ." }, 400);
        const [attached] = await db.select({ id: postAttachments.id }).from(postAttachments).where(eq(postAttachments.objectKey, key)).limit(1);
        if (attached) return reply({ error: "Ảnh đang thuộc bài khác hoặc là file hồ sơ được bảo vệ." }, 400);
        const object = await env.BUCKET?.head(key);
        const type = object?.httpMetadata?.contentType || "";
        if (!object || object.customMetadata?.ownerUserId !== userId || object.customMetadata?.accessType !== "public" || !isOptimizedImageObject(object)) return reply({ error: "Ảnh không thuộc bạn hoặc chưa được nén và chuyển sang WebP. Vui lòng tải lại ảnh." }, 400);
        let name = "Ảnh bài viết";
        try { name = decodeURIComponent(object.customMetadata.fileName || name).slice(0, 255); } catch { /* Use fallback. */ }
        images.push({ key, name, type, size: object.size });
      }
      // D1 batch is transactional: content, removals and cover order save together.
      // Each statement rechecks ownership/state; private files and stored objects remain intact.
      const results = await db.batch([update,
        db.delete(postAttachments).where(and(eq(postAttachments.postId, body.id), eq(postAttachments.accessType, "public"),
          inArray(postAttachments.mimeType, imageTypes), sql`exists (select 1 from ${posts} where ${condition})`)),
        ...images.map(image => db.insert(postAttachments).select(db.select({
          id: sql<number>`null`.as("id"), postId: sql<number>`${body.id}`.as("postId"), objectKey: sql<string>`${image.key}`.as("objectKey"),
          fileName: sql<string>`${image.name}`.as("fileName"), mimeType: sql<string>`${image.type}`.as("mimeType"), size: sql<number>`${image.size}`.as("size"),
          accessType: sql<string>`'public'`.as("accessType"), createdAt: sql<string>`${new Date().toISOString()}`.as("createdAt"),
        }).from(posts).where(condition))),
      ]);
      changed = results[0];
    } else changed = await update;
    const [post] = changed;
    if (!post) return reply({ error: "Bài viết không thuộc bạn hoặc không thể thực hiện thao tác này." }, 404);
    return reply({ post: { ...postWithLegacyMetadata(post), images: await postImages([post.id]) } });
  } catch { return reply({ error: "Chưa thể cập nhật bài viết." }, 500); }
}

export async function PATCH(request: Request) { return mutate(request, false); }
export async function DELETE(request: Request) { return mutate(request, true); }
import { isOptimizedImageObject } from "@/lib/image-upload-policy";
