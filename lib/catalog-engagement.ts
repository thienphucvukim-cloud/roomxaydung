import { and, avg, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { catalogRatings, catalogViews, posts } from "@/db/schema";
import { drawings } from "@/lib/drawing-catalog";
import { facadeModels } from "@/lib/facade-catalog";

export type CatalogTarget = { targetType: "house-model" | "drawing" | "post"; targetId: string };
export type CatalogEngagement = { views: number; rating: number | null; ratingCount: number; myRating: number | null };

export async function resolveCatalogTarget(targetType: unknown, targetId: unknown) {
  if (typeof targetId !== "string" || !targetId || targetId.length > 180) return null;
  if (targetType === "house-model" && facadeModels.some(model => model.title === targetId)) return { targetType, targetId, kind: "facade" } as const;
  if (targetType === "drawing" && drawings.some(drawing => drawing.title === targetId)) return { targetType, targetId, kind: "file", canView: true } as const;
  if (targetType !== "post" || !/^[1-9]\d*$/.test(targetId) || !Number.isSafeInteger(Number(targetId))) return null;
  const [post] = await getDb().select({ category: posts.category }).from(posts).where(and(eq(posts.id, Number(targetId)), eq(posts.audience, "Công khai"))).limit(1);
  if (post?.category === "Bộ sưu tập ảnh") return { targetType, targetId, kind: "facade" } as const;
  if (post && ["Bản vẽ cộng đồng", "Nội thất cộng đồng"].includes(post.category)) return { targetType, targetId, kind: "file", canView: true } as const;
  return null;
}

export async function catalogEngagement(target: CatalogTarget, userId: string | null): Promise<CatalogEngagement> {
  const db = getDb();
  const ratingTarget = and(eq(catalogRatings.targetType, target.targetType), eq(catalogRatings.targetId, target.targetId));
  const [[viewRow], [ratingRow], ownRatings] = await Promise.all([
    db.select({ value: count() }).from(catalogViews).where(and(eq(catalogViews.targetType, target.targetType), eq(catalogViews.targetId, target.targetId))),
    db.select({ value: avg(catalogRatings.rating), total: count() }).from(catalogRatings).where(ratingTarget),
    userId ? db.select({ rating: catalogRatings.rating }).from(catalogRatings).where(and(ratingTarget, eq(catalogRatings.userId, userId))).limit(1) : Promise.resolve([]),
  ]);
  return { views: viewRow.value, rating: ratingRow.value === null ? null : Number(ratingRow.value), ratingCount: ratingRow.total, myRating: ownRatings[0]?.rating ?? null };
}
