import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { posts } from "../db/schema";
import { drawings, parseVndPrice } from "./drawing-catalog";

export type WalletProduct = { title: string; amount: number; sellerUserId: string; targetType: "drawing" | "post"; targetId: string };

export async function resolveWalletProduct(targetType: string, targetId: string): Promise<WalletProduct | null> {
  if (targetType === "drawing") {
    const drawing = drawings.find((item) => item.title === targetId);
    return drawing ? { title: drawing.title, amount: drawing.amount, sellerUserId: drawing.authorId, targetType, targetId } : null;
  }
  if (targetType === "post" && /^\d+$/.test(targetId)) {
    const [post] = await getDb().select({ title: posts.title, userId: posts.userId, category: posts.category, price: posts.pollQuestion }).from(posts).where(and(eq(posts.id, Number(targetId)), eq(posts.audience, "Công khai"))).limit(1);
    const amount = parseVndPrice(post?.price);
    const free = !post?.price?.trim() || /^(?:0\s*đ?|miễn phí)$/i.test(post.price.trim());
    return post && ["Bản vẽ cộng đồng", "Nội thất cộng đồng"].includes(post.category) && (amount || free)
      ? { title: post.title, amount, sellerUserId: post.userId, targetType, targetId }
      : null;
  }
  return null;
}
