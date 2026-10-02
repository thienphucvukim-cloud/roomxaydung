import { asc, desc, sql, type SQL } from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { catalogDownloads, catalogRatings, catalogViews, posts, userActions } from "@/db/schema";
import { drawings } from "@/lib/drawing-catalog";
import { FILE_CATALOG_PAGE_SIZE } from "@/lib/catalog-promotions";
import type { FileCatalogSort } from "@/lib/file-catalog-sort";

export async function fileCatalogRanking(condition: SQL | undefined, sort: FileCatalogSort, page: number, modelKeys: string[], promotionPosition: SQL<number | null>) {
  const db = getDb();
  const stats = (targetType: string, targetId: SQL, downloads = 0, views = 0) => {
    const ratingCount = sql<number>`(select count(*) from ${catalogRatings} where target_type = ${targetType} and target_id = ${targetId})`;
    const score = sort === "downloads"
      ? sql<number>`${downloads} + (select count(*) from ${catalogDownloads} where target_type = ${targetType} and target_id = ${targetId})`
      : sort === "views"
        ? sql<number>`${views} + (select count(*) from ${catalogViews} where target_type = ${targetType} and target_id = ${targetId})`
        : sort === "rating"
          ? sql<number>`coalesce((select avg(rating) from ${catalogRatings} where target_type = ${targetType} and target_id = ${targetId}), 0)`
          : sql<number>`(select count(*) from ${userActions} where target_type = ${targetType} and target_id = ${targetId} and action_type in ('like', 'save'))`;
    return { score: score.as("score"), ratingCount: ratingCount.as("rating_count") };
  };
  const real = db.select({
    entryKey: sql<string>`'post:' || ${posts.id}`.as("entry_key"),
    postId: sql<number | null>`${posts.id}`.as("post_id"),
    ...stats("post", sql`cast("posts"."id" as text)`),
    promotion: sql<number>`coalesce(${promotionPosition}, 17)`.as("promotion"),
    createdAt: sql<string>`${posts.createdAt}`.as("created_at"),
  }).from(posts).where(condition);
  const selected = new Set(modelKeys);
  const demos = drawings.filter(drawing => selected.has(drawing.title)).map(drawing => db.select({
    entryKey: sql<string>`${"drawing:" + drawing.title}`.as("entry_key"),
    postId: sql<number | null>`null`.as("post_id"),
    ...stats("drawing", sql`${drawing.title}`, drawing.downloads, drawing.views),
    promotion: sql<number>`17`.as("promotion"),
    createdAt: sql<string>`''`.as("created_at"),
  }).from(sql`(select 1)`));
  const ranked = (demos.length ? unionAll(real, demos[0], ...demos.slice(1)) : real).as("file_ranked");
  return db.select().from(ranked).orderBy(
    ...(sort === "featured" ? [asc(ranked.promotion)] : []),
    desc(ranked.score),
    ...(sort === "rating" ? [desc(ranked.ratingCount)] : []),
    desc(ranked.createdAt), desc(ranked.entryKey),
  ).limit(FILE_CATALOG_PAGE_SIZE).offset((page - 1) * FILE_CATALOG_PAGE_SIZE);
}
