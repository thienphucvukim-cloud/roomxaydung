import { and, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { memberProfiles, posts, userRequests, websiteAccounts } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { validOrigin } from "@/lib/website-auth";
import { AUTHOR_DELETED_STATES } from "@/lib/post-ownership";
import { requestStatuses } from "@/lib/admin-types";
import { env } from "cloudflare:workers";
import { CATALOG_PRICE_ERROR, isPricedCatalog, normalizeCatalogPrice } from "@/lib/catalog-price";

type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  const { resource } = await context.params;
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return Response.json({ error: "Số trang không hợp lệ." }, { status: 400 });
  const query = params.get("q")?.trim().slice(0, 120) || "";
  const filter = params.get("filter") || "";
  const requestedId = Number(params.get("id") || 0);
  if (params.has("id") && (!Number.isSafeInteger(requestedId) || requestedId < 1)) return Response.json({ error: "Mã bài viết không hợp lệ." }, { status: 400 });
  const size = 20;
  const db = getDb();
  try {
    let items, total;
    if (resource === "posts") {
      const audiences: Record<string, string> = { public: "Công khai", hidden: "Ẩn bởi quản trị", deleted: "Đã xóa bởi tác giả" };
      if (filter && !Object.hasOwn(audiences, filter)) return Response.json({ error: "Bộ lọc bài viết không hợp lệ." }, { status: 400 });
      const condition = and(filter ? filter === "deleted" ? inArray(posts.audience, AUTHOR_DELETED_STATES) : filter === "hidden" ? inArray(posts.audience, ["Ẩn bởi quản trị", "Chỉ mình tôi"]) : eq(posts.audience, audiences[filter]) : inArray(posts.audience, ["Công khai", "Ẩn bởi quản trị", "Chỉ mình tôi", ...AUTHOR_DELETED_STATES]), requestedId ? eq(posts.id, requestedId) : undefined, query ? or(sql`instr(lower(${posts.title}), lower(${query})) > 0`, sql`instr(lower(${posts.authorName}), lower(${query})) > 0`) : undefined);
      [items, [total]] = await Promise.all([db.select({ id: posts.id, title: posts.title, content: posts.content, authorName: posts.authorName, category: posts.category, priceLabel: posts.priceLabel, audience: posts.audience, createdAt: posts.createdAt }).from(posts).where(condition).orderBy(desc(posts.createdAt), desc(posts.id)).limit(size).offset((page - 1) * size), db.select({ value: count() }).from(posts).where(condition)]);
    } else if (resource === "requests") {
      const condition = and(eq(userRequests.recipientUserId, admin.userId!), ne(userRequests.requestType, "direct-message"), query ? or(sql`instr(lower(${userRequests.subject}), lower(${query})) > 0`, sql`instr(lower(${userRequests.authorName}), lower(${query})) > 0`) : undefined, filter ? eq(userRequests.status, filter) : undefined);
      [items, [total]] = await Promise.all([db.select({ id: userRequests.id, subject: userRequests.subject, content: userRequests.content, authorName: userRequests.authorName, contact: userRequests.contact, requestType: userRequests.requestType, status: userRequests.status, createdAt: userRequests.createdAt }).from(userRequests).where(condition).orderBy(desc(userRequests.createdAt), desc(userRequests.id)).limit(size).offset((page - 1) * size), db.select({ value: count() }).from(userRequests).where(condition)]);
    } else if (resource === "members") {
      const statusFilter = ["active", "disabled", "deleted"].includes(filter);
      if (filter && !statusFilter && !["user", "architect", "engineer"].includes(filter)) return Response.json({ error: "Bộ lọc thành viên không hợp lệ." }, { status: 400 });
      const bindings = env as unknown as Record<string, string | undefined>;
      const accountEmail = sql<string | null>`coalesce(${websiteAccounts.email}, ${memberProfiles.email})`;
      const canModerate = sql<boolean>`coalesce(${websiteAccounts.isOwner}, 0) = 0 and ${memberProfiles.userId} != ${admin.userId!} and ${memberProfiles.userId} != ${bindings.TIPOOK_ADMIN_USER_ID?.trim() || ""} and (${bindings.TIPOOK_ADMIN_EMAIL?.trim().toLowerCase() || ""} = '' or lower(coalesce(${accountEmail}, '')) != ${bindings.TIPOOK_ADMIN_EMAIL?.trim().toLowerCase() || ""})`;
      const condition = and(sql`${memberProfiles.userId} NOT LIKE 'guest_%'`, query ? or(sql`instr(lower(${memberProfiles.displayName}), lower(${query})) > 0`, sql`instr(lower(coalesce(${accountEmail}, '')), lower(${query})) > 0`, sql`instr(lower(coalesce(${websiteAccounts.username}, '')), lower(${query})) > 0`) : undefined,
        filter ? statusFilter ? eq(memberProfiles.accountStatus, filter) : eq(memberProfiles.accountType, filter) : ne(memberProfiles.accountStatus, "deleted"));
      // A join keeps both user IDs qualified. A subquery in a single-table
      // selection can otherwise compare website_accounts.user_id to itself.
      [items, [total]] = await Promise.all([db.select({ userId: memberProfiles.userId, displayName: memberProfiles.displayName, email: accountEmail, username: websiteAccounts.username,
        canModerate, canResetPassword: sql<boolean>`${canModerate} and ${websiteAccounts.userId} is not null and ${memberProfiles.accountStatus} = 'active'`,
        accountStatus: memberProfiles.accountStatus, moderationReason: memberProfiles.moderationReason, moderationVersion: memberProfiles.moderationVersion,
        accountType: memberProfiles.accountType, profession: memberProfiles.profession, updatedAt: memberProfiles.updatedAt, postCount: sql<number>`(select count(*) from posts where posts.user_id = ${memberProfiles.userId})`
      }).from(memberProfiles).leftJoin(websiteAccounts, eq(websiteAccounts.userId, memberProfiles.userId)).where(condition).orderBy(desc(memberProfiles.updatedAt), desc(memberProfiles.userId)).limit(size).offset((page - 1) * size),
      db.select({ value: count() }).from(memberProfiles).leftJoin(websiteAccounts, eq(websiteAccounts.userId, memberProfiles.userId)).where(condition)]);
    } else return Response.json({ error: "Không tìm thấy danh mục." }, { status: 404 });
    return Response.json({ items, total: total.value, page, pageSize: size }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Chưa thể tải dữ liệu quản trị." }, { status: 500 }); }
}

export async function PATCH(request: Request, context: Context) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { resource } = await context.params;
  try {
    const body = await request.json() as { id?: unknown; audience?: unknown; status?: unknown; title?: unknown; content?: unknown; priceLabel?: unknown; action?: unknown };
    if (typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id < 1) return Response.json({ error: "Mã dữ liệu không hợp lệ." }, { status: 400 });
    let rows;
    if (resource === "posts") {
      if (body.action !== undefined) return Response.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
      const updates: { title?: string; content?: string; audience?: string; priceLabel?: string } = {};
      if (body.priceLabel !== undefined) {
        const price = normalizeCatalogPrice(body.priceLabel);
        if (price === null) return Response.json({ error: CATALOG_PRICE_ERROR }, { status: 400 });
        const [post] = await getDb().select({ category: posts.category }).from(posts).where(eq(posts.id, body.id)).limit(1);
        if (!post) return Response.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
        if (!isPricedCatalog(post.category)) return Response.json({ error: "Chỉ hồ sơ bản vẽ và nội thất có giá bán." }, { status: 400 });
        updates.priceLabel = price;
      }
      if (body.audience !== undefined) {
        if (body.audience !== "Công khai" && body.audience !== "Ẩn bởi quản trị") return Response.json({ error: "Trạng thái bài viết không hợp lệ." }, { status: 400 });
        updates.audience = body.audience;
      }
      if (body.title !== undefined || body.content !== undefined) {
        if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 120 || typeof body.content !== "string" || body.content.length > 1200) return Response.json({ error: "Tiêu đề hoặc nội dung bài viết không hợp lệ." }, { status: 400 });
        updates.title = body.title.trim(); updates.content = body.content.trim();
      }
      if (!Object.keys(updates).length) return Response.json({ error: "Chưa có nội dung cần thay đổi." }, { status: 400 });
      rows = await getDb().update(posts).set(updates).where(and(eq(posts.id, body.id), inArray(posts.audience, ["Công khai", "Ẩn bởi quản trị", "Chỉ mình tôi"]))).returning({ id: posts.id });
    } else if (resource === "requests") {
      if (typeof body.status !== "string" || !Object.hasOwn(requestStatuses, body.status)) return Response.json({ error: "Trạng thái yêu cầu không hợp lệ." }, { status: 400 });
      rows = await getDb().update(userRequests).set({ status: body.status }).where(and(eq(userRequests.id, body.id), eq(userRequests.recipientUserId, admin.userId!), ne(userRequests.requestType, "direct-message"))).returning({ id: userRequests.id });
    } else return Response.json({ error: "Chức năng không được hỗ trợ." }, { status: 404 });
    if (!rows.length) return Response.json({ error: "Không tìm thấy nội dung có thể quản lý." }, { status: 404 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Chưa thể cập nhật dữ liệu." }, { status: 500 }); }
}

export async function DELETE(request: Request, context: Context) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { resource } = await context.params;
  if (resource !== "posts") return Response.json({ error: "Chức năng không được hỗ trợ." }, { status: 404 });
  let body: { id?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Dữ liệu yêu cầu không hợp lệ." }, { status: 400 }); }
  if (!body || typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id < 1) return Response.json({ error: "Mã bài đăng không hợp lệ." }, { status: 400 });
  try {
    // The database trigger cleans up content while retaining purchased private files.
    const rows = await getDb().delete(posts).where(and(eq(posts.id, body.id), inArray(posts.audience, ["Công khai", "Ẩn bởi quản trị", "Chỉ mình tôi", ...AUTHOR_DELETED_STATES]))).returning({ id: posts.id });
    if (!rows.length) return Response.json({ error: "Không tìm thấy bài đăng có thể xóa." }, { status: 404 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Chưa thể xóa bài đăng." }, { status: 500 }); }
}
