import { and, desc, eq, inArray } from "drizzle-orm";
import { getPaymentBuyerId } from "@/lib/payment-identity";
import { getDb } from "@/db";
import { memberProfiles, postAttachments, posts, virtualProfiles } from "@/db/schema";
import { memberAccountStatus } from "@/lib/member-account-status";
import { memberAvatarUrl } from "@/lib/member-avatar";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = decodeURIComponent(id).slice(0, 180);
  if (await memberAccountStatus(userId) !== "active") return Response.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });
  const currentUserId = await getPaymentBuyerId();
  const db = getDb();
  const [[member], authoredPosts] = await Promise.all([
    db.select().from(memberProfiles).where(eq(memberProfiles.userId, userId)).limit(1),
    db.select().from(posts).where(and(eq(posts.userId, userId), eq(posts.audience, "Công khai"))).orderBy(desc(posts.createdAt), desc(posts.id)).limit(30),
  ]);
  let virtual: typeof virtualProfiles.$inferSelect | undefined;
  try {
    [virtual] = await db.select().from(virtualProfiles).where(eq(virtualProfiles.id, userId)).limit(1);
  } catch {
    virtual = undefined;
  }
  if (!member && !virtual && !authoredPosts.length) return Response.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });

  const displayName = member?.displayName ?? virtual?.displayName ?? authoredPosts[0]?.authorName ?? "Thành viên NhàĐẹpChất";
  const avatarUrl = member ? memberAvatarUrl(member) : virtual?.avatar;
  const profession = member?.profession ?? virtual?.profession ?? "Thành viên NhàĐẹpChất";
  const bio = virtual?.bio ?? (profession === "Kỹ sư" ? "Chia sẻ hồ sơ kỹ thuật và bản vẽ thi công trên NhàĐẹpChất." : profession === "Kiến trúc sư" ? "Chia sẻ thiết kế kiến trúc và ý tưởng nhà đẹp trên NhàĐẹpChất." : "Thành viên cộng đồng NhàĐẹpChất.");
  const location = virtual?.location ?? null;
  const postIds = authoredPosts.map((post) => post.id);
  const attachments = postIds.length ? await db.select().from(postAttachments).where(and(inArray(postAttachments.postId, postIds), eq(postAttachments.accessType, "public"))) : [];
  const firstImage = new Map<number, (typeof attachments)[number]>();
  for (const attachment of attachments) if (attachment.mimeType.startsWith("image/") && !firstImage.has(attachment.postId)) firstImage.set(attachment.postId, attachment);

  return Response.json({ displayName, avatarUrl, profession, bio, location, own: currentUserId === userId,
    authoredPosts: authoredPosts.map(post => ({id:post.id,userId:post.userId,title:post.title,category:post.category,content:post.content,
      imageUrl: firstImage.has(post.id) ? '/api/files?key=' + encodeURIComponent(firstImage.get(post.id)!.objectKey) : null})) },
    { headers: { 'Cache-Control': 'private, no-store' } });
}
