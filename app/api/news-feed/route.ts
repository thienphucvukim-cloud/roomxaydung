import { and, asc, count, desc, eq, getTableColumns, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { memberProfiles, postAttachments, posts } from "@/db/schema";
import { NEWS_PAGE_SIZE, NEWS_SOURCES, newsSourceLink } from "@/lib/news-feed";
import { memberAvatarUrl } from "@/lib/member-avatar";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? 1);
  const category = params.get("category") || "";
  const postId = params.get("postId");
  if (postId !== null && (!/^[1-9]\d*$/.test(postId) || !Number.isSafeInteger(Number(postId)))) return Response.json({ error: "Bài đăng không hợp lệ." }, { status: 400 });
  const query = params.get("q")?.trim().slice(0, 120) || "";
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) {
    return Response.json({ error: "Số trang không hợp lệ." }, { status: 400 });
  }
  if (category && !NEWS_SOURCES.some(source => source.category === category)) {
    return Response.json({ error: "Danh mục bảng tin không hợp lệ." }, { status: 400 });
  }

  try {
    const db = getDb();
    // Rank before filtering so each link opens the correct page in its source catalog.
    const ranked = db.$with("news_posts").as(db.select({
      ...getTableColumns(posts),
      position: sql<number>`row_number() over (partition by ${posts.category} order by ${posts.createdAt} desc, ${posts.id} desc)`.as("source_position"),
    }).from(posts).where(and(
      eq(posts.audience, "Công khai"),
      inArray(posts.category, NEWS_SOURCES.map(source => source.category)),
    )));
    const condition = and(
      postId ? eq(ranked.id, Number(postId)) : undefined,
      category ? eq(ranked.category, category) : undefined,
      query ? or(...[ranked.title, ranked.content, ranked.authorName, ranked.location, ranked.feeling].map(column =>
        sql`instr(lower(coalesce(${column}, '')), lower(${query})) > 0`,
      )) : undefined,
    );
    const [totals, rows] = await Promise.all([
      db.with(ranked).select({ value: count() }).from(ranked).where(condition),
      db.with(ranked).select().from(ranked).where(condition)
        .orderBy(desc(ranked.createdAt), desc(ranked.id)).limit(NEWS_PAGE_SIZE).offset((page - 1) * NEWS_PAGE_SIZE),
    ]);
    const images = rows.length ? await db.select({
      postId: postAttachments.postId,
      objectKey: postAttachments.objectKey,
      name: postAttachments.fileName,
    }).from(postAttachments).where(and(
      inArray(postAttachments.postId, rows.map(post => post.id)),
      eq(postAttachments.accessType, "public"),
      inArray(postAttachments.mimeType, ["image/jpeg", "image/png", "image/webp", "image/gif"]),
    )).orderBy(asc(postAttachments.id)) : [];
    const imagesByPost = new Map<number, { url: string; name: string }[]>();
    const authors = rows.length ? await db.select({ userId: memberProfiles.userId, avatarKey: memberProfiles.avatarKey, googleAvatarUrl: memberProfiles.googleAvatarUrl })
      .from(memberProfiles).where(inArray(memberProfiles.userId, [...new Set(rows.map(post => post.userId))])) : [];
    const avatars = new Map(authors.map(author => [author.userId, memberAvatarUrl(author)]));
    for (const image of images) {
      const current = imagesByPost.get(image.postId) ?? [];
      current.push({ url: `/api/files?key=${encodeURIComponent(image.objectKey)}`, name: image.name });
      imagesByPost.set(image.postId, current);
    }
    return Response.json({
      posts: rows.map(post => ({
        id: post.id, userId: post.userId, authorName: post.authorName, avatarUrl: avatars.get(post.userId) ?? null, category: post.category,
        title: post.title, content: post.content, location: post.location, feeling: post.feeling,
        pollQuestion: post.pollQuestion, createdAt: post.createdAt,
        ...newsSourceLink(post.category, post.id, post.position),
        images: imagesByPost.get(post.id) ?? [],
      })),
      total: totals[0].value,
      page,
      totalPages: Math.max(1, Math.ceil(totals[0].value / NEWS_PAGE_SIZE)),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load news feed", error);
    return Response.json({ error: "Chưa thể tải bảng tin. Vui lòng thử lại." }, { status: 500 });
  }
}
