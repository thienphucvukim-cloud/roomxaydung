import { POST_CATEGORIES } from "@/lib/legacy-contracts";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { posts, websiteContent } from "../db/schema";
import { drawings, parseVndPrice } from "./drawing-catalog";
import { normalizeCatalogPrice } from "./catalog-price";

export type WalletProduct = { title: string; amount: number; sellerUserId: string; targetType: "drawing" | "post"; targetId: string; category?: string };

export async function resolveWalletProduct(targetType: string, targetId: string): Promise<WalletProduct | null> {
  if (targetType === "drawing") {
    const index = drawings.findIndex((item) => item.title === targetId);
    const drawing = drawings[index];
    if (!drawing) return null;
    const [override] = await getDb().select({ kind: websiteContent.kind, value: websiteContent.value }).from(websiteContent).where(eq(websiteContent.key, `drawing.${index}.price`)).limit(1);
    const price = override?.kind === "text" ? normalizeCatalogPrice(override.value) : drawing.price;
    if (price === null) return null;
    return { title: drawing.title, amount: parseVndPrice(price), sellerUserId: drawing.authorId, targetType, targetId };
  }
  if (targetType === "post" && /^\d+$/.test(targetId)) {
    const [post] = await getDb().select({ title: posts.title, userId: posts.userId, category: posts.category, price: posts.priceLabel }).from(posts).where(and(eq(posts.id, Number(targetId)), eq(posts.audience, "Công khai"))).limit(1);
    const amount = parseVndPrice(post?.price);
    const free = !post?.price?.trim() || /^(?:0\s*đ?|miễn phí)$/i.test(post.price.trim());
    return post && [POST_CATEGORIES.drawings, POST_CATEGORIES.interiors].includes(post.category) && (amount || free)
      ? { title: post.title, amount, sellerUserId: post.userId, targetType, targetId, category: post.category }
      : null;
  }
  return null;
}
