import { and, asc, desc, eq, gt, lt, lte, max, or, sql, type SQL } from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db";
import { catalogViews, posts, userActions } from "@/db/schema";
import { houseModels } from "@/lib/house-models";
import { getSiteContent } from "@/lib/site-content";
import { CATALOG_PAGE_SIZE } from "@/lib/catalog-pagination";
import { houseModelOrderKey, HOUSE_MODEL_RANDOM_MODULUS, type HouseModelSort } from "@/lib/house-model-feed";
import { postQualityOrder, qualityOrder } from "@/lib/catalog-quality";

export function houseCatalogCursor(value: string | null, sort: HouseModelSort) {
  if (value === null) return undefined;
  if (!/^hc:\d+:\d+:\d+:\d+$/.test(value)) return null;
  const [snapshot, quality, score, tie] = value.slice(3).split(":").map(Number);
  if ([snapshot, quality, score, tie].some(value => !Number.isSafeInteger(value)) || quality > 1 || (sort === "random" && score >= HOUSE_MODEL_RANDOM_MODULUS)) return null;
  return { snapshot, quality, score, tie };
}
export async function houseCatalogRanking(condition: SQL | undefined, sort: HouseModelSort, seed: number, modelKeys: string[], cursor: ReturnType<typeof houseCatalogCursor>) {
  const db = getDb();
  const snapshot = cursor?.snapshot ?? (await db.select({ value: max(posts.id) }).from(posts).where(condition))[0].value ?? 0;
  const random = sql`((${posts.id} * 48271 + cast(${seed} as integer)) % 2147483647)`;
  const stats = (type: "post" | "house-model", id: SQL) => sort === "views"
    ? sql<number>`(select count(*) from ${catalogViews} where target_type = ${type} and target_id = ${id})`
    : sql<number>`(select count(*) from ${userActions} where target_type = ${type} and target_id = ${id} and action_type = 'like')`;
  const real = db.select({
    entryKey: sql<string>`'post:' || ${posts.id}`.as("entry_key"),
    postId: sql<number | null>`${posts.id}`.as("post_id"),
    quality: postQualityOrder.as("quality"),
    score: (sort === "random" ? sql<number>`((${random} * ${random}) % 2147483647)` : stats("post", sql`cast(${posts.id} as text)`)).as("score"),
    tie: sql<number>`${posts.id}`.as("tie"),
  }).from(posts).where(and(condition, lte(posts.id, snapshot)));
  const selected = new Set(modelKeys), content = await getSiteContent();
  const demoRows = houseModels.flatMap((model, index) => !selected.has(model.title) || content[`facade.${index}.visibility`]?.value === "deleted" ? [] : [{ title: model.title, prefix: `facade.${index}`, score: houseModelOrderKey(10_000_000 + index, seed), tie: Number.MAX_SAFE_INTEGER - houseModels.length + index }]);
  const demos = db.select({
    entryKey: sql<string>`'model:' || json_extract(demo_entries.value, '$.title')`.as("entry_key"),
    postId: sql<number | null>`null`.as("post_id"),
    quality: qualityOrder("demo", sql`json_extract(demo_entries.value, '$.prefix')`).as("quality"),
    score: (sort === "random" ? sql<number>`json_extract(demo_entries.value, '$.score')` : stats("house-model", sql`json_extract(demo_entries.value, '$.title')`)).as("score"),
    tie: sql<number>`json_extract(demo_entries.value, '$.tie')`.as("tie"),
  }).from(sql`json_each(${JSON.stringify(demoRows)}) as demo_entries`);
  const ranked = (demoRows.length ? unionAll(real, demos) : real).as("house_ranked");
  const after = cursor ? or(gt(ranked.quality, cursor.quality), and(eq(ranked.quality, cursor.quality), or(
    sort === "random" ? gt(ranked.score, cursor.score) : lt(ranked.score, cursor.score),
    and(eq(ranked.score, cursor.score), gt(ranked.tie, cursor.tie)),
  ))) : undefined;
  const rows = await db.select().from(ranked).where(after).orderBy(asc(ranked.quality), sort === "random" ? asc(ranked.score) : desc(ranked.score), asc(ranked.tie)).limit(CATALOG_PAGE_SIZE + 1);
  const entries = rows.slice(0, CATALOG_PAGE_SIZE), last = entries.at(-1);
  return { entries, nextCursor: rows.length > CATALOG_PAGE_SIZE && last ? `hc:${snapshot}:${last.quality}:${last.score}:${last.tie}` : null };
}
