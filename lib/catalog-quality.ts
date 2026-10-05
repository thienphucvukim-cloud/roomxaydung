import { sql, type SQL } from "drizzle-orm";
import { catalogQualityFlags, posts } from "@/db/schema";
import { POST_CATEGORIES } from "@/lib/legacy-contracts";

export const QUALITY_CATEGORIES = [POST_CATEGORIES.houseModels, POST_CATEGORIES.drawings, POST_CATEGORIES.interiors];
export function qualityOrder(targetType: "post" | "demo", targetId: SQL) {
  return sql<number>`exists (select 1 from ${catalogQualityFlags} where ${catalogQualityFlags.targetType} = ${targetType} and ${catalogQualityFlags.targetId} = ${targetId})`;
}
export const postQualityOrder = qualityOrder("post", sql`cast(${posts.id} as text)`);
