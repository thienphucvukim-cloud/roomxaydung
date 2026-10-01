import { and, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { memberProfiles, posts, userRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { validOrigin } from "@/lib/website-auth";
import { requestStatuses } from "@/lib/admin-types";

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
      const condition = and(inArray(posts.audience, ["Công khai", "Ẩn bởi quản trị"]), requestedId ? eq(posts.id, requestedId) : undefined, query ? or(sql`instr(lower(${posts.title}), lower(${query})) > 0`, sql`instr(lower(${posts.authorName}), lower(${query})) > 0`) : undefined, filter ? eq(posts.audience, filter === "hidden" ? "Ẩn bởi quản trị" : "Công khai") : undefined);
      [items, [total]] = await Promise.all([db.select({ id: posts.id, title: posts.title, content: posts.content, authorName: posts.authorName, category: posts.category, audience: posts.audience, createdAt: posts.createdAt }).from(posts).where(condition).orderBy(desc(posts.createdAt), desc(posts.id)).limit(size).offset((page - 1) * size), db.select({ value: count() }).from(posts).where(condition)]);
    } else if (resource === "requests") {
      const condition = and(eq(userRequests.recipientUserId, admin.userId!), ne(userRequests.requestType, "direct-message"), query ? or(sql`instr(lower(${userRequests.subject}), lower(${query})) > 0`, sql`instr(lower(${userRequests.authorName}), lower(${query})) > 0`) : undefined, filter ? eq(userRequests.status, filter) : undefined);
      [items, [total]] = await Promise.all([db.select({ id: userRequests.id, subject: userRequests.subject, content: userRequests.content, authorName: userRequests.authorName, contact: userRequests.contact, requestType: userRequests.requestType, status: userRequests.status, createdAt: userRequests.createdAt }).from(userRequests).where(condition).orderBy(desc(userRequests.createdAt), desc(userRequests.id)).limit(size).offset((page - 1) * size), db.select({ value: count() }).from(userRequests).where(condition)]);
    } else if (resource === "members") {
      const condition = and(sql`${memberProfiles.userId} NOT LIKE 'guest_%'`, query ? or(sql`instr(lower(${memberProfiles.displayName}), lower(${query})) > 0`, sql`instr(lower(coalesce(${memberProfiles.email}, '')), lower(${query})) > 0`) : undefined, filter ? eq(memberProfiles.accountType, filter) : undefined);
      [items, [total]] = await Promise.all([db.select({ userId: memberProfiles.userId, displayName: memberProfiles.displayName, email: memberProfiles.email, accountType: memberProfiles.accountType, profession: memberProfiles.profession, updatedAt: memberProfiles.updatedAt, postCount: sql<number>`(select count(*) from posts where posts.user_id = ${memberProfiles.userId})` }).from(memberProfiles).where(condition).orderBy(desc(memberProfiles.updatedAt), desc(memberProfiles.userId)).limit(size).offset((page - 1) * size), db.select({ value: count() }).from(memberProfiles).where(condition)]);
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
    const body = await request.json() as { id?: unknown; audience?: unknown; status?: unknown; title?: unknown; content?: unknown };
    if (typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id < 1) return Response.json({ error: "Mã dữ liệu không hợp lệ." }, { status: 400 });
    let rows;
    if (resource === "posts") {
      const updates: { title?: string; content?: string; audience?: string } = {};
      if (body.audience !== undefined) {
        if (body.audience !== "Công khai" && body.audience !== "Ẩn bởi quản trị") return Response.json({ error: "Trạng thái bài viết không hợp lệ." }, { status: 400 });
        updates.audience = body.audience;
      }
      if (body.title !== undefined || body.content !== undefined) {
        if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 120 || typeof body.content !== "string" || body.content.length > 1200) return Response.json({ error: "Tiêu đề hoặc nội dung bài viết không hợp lệ." }, { status: 400 });
        updates.title = body.title.trim(); updates.content = body.content.trim();
      }
      if (!Object.keys(updates).length) return Response.json({ error: "Chưa có nội dung cần thay đổi." }, { status: 400 });
      rows = await getDb().update(posts).set(updates).where(and(eq(posts.id, body.id), inArray(posts.audience, ["Công khai", "Ẩn bởi quản trị"]))).returning({ id: posts.id });
    } else if (resource === "requests") {
      if (typeof body.status !== "string" || !Object.hasOwn(requestStatuses, body.status)) return Response.json({ error: "Trạng thái yêu cầu không hợp lệ." }, { status: 400 });
      rows = await getDb().update(userRequests).set({ status: body.status }).where(and(eq(userRequests.id, body.id), eq(userRequests.recipientUserId, admin.userId!), ne(userRequests.requestType, "direct-message"))).returning({ id: userRequests.id });
    } else return Response.json({ error: "Chức năng không được hỗ trợ." }, { status: 404 });
    if (!rows.length) return Response.json({ error: "Không tìm thấy nội dung có thể quản lý." }, { status: 404 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Chưa thể cập nhật dữ liệu." }, { status: 500 }); }
}
