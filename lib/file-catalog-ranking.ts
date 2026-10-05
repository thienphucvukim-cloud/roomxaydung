import { asc, desc, sql, type SQL } from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { catalogDownloads, catalogRatings, catalogViews, posts, userActions } from "@/db/schema";
import { drawings } from "@/lib/drawing-catalog";
import { FILE_CATALOG_PAGE_SIZE, placePromotedItems } from "@/lib/catalog-promotions";
import { postQualityOrder, qualityOrder } from "@/lib/catalog-quality";
import type { FileCatalogSort } from "@/lib/file-catalog-sort";

export async function fileCatalogRanking(condition: SQL | undefined, sort: FileCatalogSort, page: number, modelKeys: string[], promotionPosition: SQL<number | null>) {
  const db = getDb();
  const stats = (targetType: string, targetId: SQL, downloads: number | SQL = 0, views: number | SQL = 0) => {
    const ratingCount = sort === "latest" ? sql<number>`0` : sql<number>`(select count(*) from ${catalogRatings} where target_type = ${targetType} and target_id = ${targetId})`;
    const score = sort === "downloads"
      ? sql<number>`${downloads} + (select count(*) from ${catalogDownloads} where target_type = ${targetType} and target_id = ${targetId})`
      : sort === "views"
        ? sql<number>`${views} + (select count(*) from ${catalogViews} where target_type = ${targetType} and target_id = ${targetId})`
        : sort === "rating"
          ? sql<number>`coalesce((select avg(rating) from ${catalogRatings} where target_type = ${targetType} and target_id = ${targetId}), 0)`
          : sort === "latest" ? sql<number>`0` : sql<number>`(select count(*) from ${userActions} where target_type = ${targetType} and target_id = ${targetId} and action_type in ('like', 'save'))`;
    return { score: score.as("score"), ratingCount: ratingCount.as("rating_count") };
  };
  const real = db.select({
    entryKey: sql<string>`'post:' || ${posts.id}`.as("entry_key"),
    postId: sql<number | null>`${posts.id}`.as("post_id"),
    quality: postQualityOrder.as("quality"),
    ...stats("post", sql`cast("posts"."id" as text)`),
    promotion: sql<number>`coalesce(${promotionPosition}, 17)`.as("promotion"),
    createdAt: sql<string>`${posts.createdAt}`.as("created_at"),
    tie: sql<number>`${posts.id}`.as("tie"),
  }).from(posts).where(condition);
  const selected = new Set(modelKeys);
  const demoRows = drawings.flatMap((drawing, index) => selected.has(drawing.title) ? [{ ...drawing, prefix: `drawing.${index}`, tie: -index }] : []);
  // A single JSON table avoids D1's compound SELECT limit for built-in cards.
  const demos = db.select({
    entryKey: sql<string>`'drawing:' || json_extract(demo_entries.value, '$.title')`.as("entry_key"),
    postId: sql<number | null>`null`.as("post_id"),
    quality: qualityOrder("demo", sql`json_extract(demo_entries.value, '$.prefix')`).as("quality"),
    ...stats("drawing", sql`json_extract(demo_entries.value, '$.title')`, sql`json_extract(demo_entries.value, '$.downloads')`, sql`json_extract(demo_entries.value, '$.views')`),
    promotion: sql<number>`17`.as("promotion"),
    createdAt: sql<string>`''`.as("created_at"),
    tie: sql<number>`json_extract(demo_entries.value, '$.tie')`.as("tie"),
  }).from(sql`json_each(${JSON.stringify(demoRows)}) as demo_entries`);
  const ranked = (demoRows.length ? unionAll(real, demos) : real).as("file_ranked");
  if (sort === "latest") {
    // Merge lightweight IDs before pagination so promoted slots and demo cards
    // cannot pull a flagged listing ahead of a normal listing on another page.
    const entries = await db.select().from(ranked).orderBy(asc(ranked.quality), desc(ranked.createdAt), desc(ranked.tie));
    const ordinary = entries.filter(entry => !entry.quality);
    const ordered = [...placePromotedItems(ordinary, entry => entry.promotion < 17 ? entry.promotion : null).filter((entry): entry is typeof ordinary[number] => entry !== null), ...entries.filter(entry => entry.quality)];
    return ordered.slice((page - 1) * FILE_CATALOG_PAGE_SIZE, page * FILE_CATALOG_PAGE_SIZE);
  }
  return db.select().from(ranked).orderBy(
    asc(ranked.quality),
    ...(sort === "featured" ? [asc(ranked.promotion)] : []),
    desc(ranked.score),
    ...(sort === "rating" ? [desc(ranked.ratingCount)] : []),
    desc(ranked.createdAt), desc(ranked.entryKey),
  ).limit(FILE_CATALOG_PAGE_SIZE).offset((page - 1) * FILE_CATALOG_PAGE_SIZE);
}
