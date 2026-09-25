import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BriefcaseBusiness, FileText, Info, Mail, MapPin, MessageCircle } from "lucide-react";
import { getDb } from "../../../db";
import { memberProfiles, postAttachments, posts, virtualProfiles } from "../../../db/schema";
import { ProfileActions } from "@/components/profile-actions";

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = decodeURIComponent(id).slice(0, 180);
  const currentUserId = (await headers()).get("oai-authenticated-user-id") ?? "private-member";
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
  if (!member && !virtual && !authoredPosts.length) notFound();

  const displayName = member?.displayName ?? virtual?.displayName ?? authoredPosts[0]?.authorName ?? "Thành viên Tipook";
  const profession = member?.profession ?? virtual?.profession ?? "Thành viên Tipook";
  const bio = virtual?.bio ?? (profession === "Kỹ sư" ? "Chia sẻ hồ sơ kỹ thuật và bản vẽ thi công trên Tipook." : profession === "Kiến trúc sư" ? "Chia sẻ thiết kế kiến trúc và ý tưởng nhà đẹp trên Tipook." : "Thành viên cộng đồng Tipook.");
  const location = virtual?.location ?? null;
  const postIds = authoredPosts.map((post) => post.id);
  const attachments = postIds.length ? await db.select().from(postAttachments).where(and(inArray(postAttachments.postId, postIds), eq(postAttachments.accessType, "public"))) : [];
  const firstImage = new Map<number, (typeof attachments)[number]>();
  for (const attachment of attachments) if (attachment.mimeType.startsWith("image/") && !firstImage.has(attachment.postId)) firstImage.set(attachment.postId, attachment);

  return <main className="mx-auto min-h-[calc(100vh-72px)] max-w-5xl px-4 py-8 lg:px-8">
    <section className="overflow-hidden rounded-3xl border border-[#dfe8f1] bg-white shadow-sm">
      <div className="h-36 bg-gradient-to-r from-[#073b74] via-[#0d6594] to-[#229ed9] sm:h-48"/>
      <div className="px-5 pb-6 sm:px-8"><div className="-mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><span className="inline-flex rounded-full border-4 border-white bg-[#e8f6fc] px-5 py-3 text-xl font-extrabold text-[#0b2e59] shadow-sm">{displayName}</span><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#667085]"><span className="flex items-center gap-2"><BriefcaseBusiness size={16}/>{profession}</span>{location && <span className="flex items-center gap-2"><MapPin size={16}/>{location}</span>}<span className="flex items-center gap-2"><FileText size={16}/>{authoredPosts.length} bài đăng</span></div></div></div><p className="mt-4 max-w-2xl leading-7 text-[#536273]">{bio}</p>{currentUserId !== userId && <ProfileActions userId={userId}/>}</div>
    </section>

    <section className="mt-6 grid gap-5 md:grid-cols-2">
      <article className="rounded-2xl border border-[#e3eaf2] bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><Info size={20}/>Thông tin giới thiệu</h2><p className="mt-3 text-sm leading-7 text-[#667085]">{bio}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#536273]"><span className="rounded-full bg-[#f1f5f9] px-3 py-1.5">{profession}</span>{location && <span className="rounded-full bg-[#f1f5f9] px-3 py-1.5">{location}</span>}</div></article>
      <article className="rounded-2xl border border-[#e3eaf2] bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><Mail size={20}/>Thông tin liên hệ</h2><p className="mt-3 text-sm leading-7 text-[#667085]">Thông tin liên hệ cá nhân được bảo vệ. Bạn có thể trao đổi trực tiếp với thành viên qua hệ thống tin nhắn Tipook.</p><Link href={`/chat?user=${encodeURIComponent(userId)}`} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#229ed9] px-4 text-sm font-bold text-white hover:bg-[#168ac0]"><MessageCircle size={17}/>Nhắn tin cho {displayName}</Link></article>
    </section>

    <section className="mt-6"><h1 className="text-xl font-extrabold text-[#0b2e59]">Bài viết của {displayName}</h1>{authoredPosts.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{authoredPosts.map((post) => { const image = firstImage.get(post.id); return <article key={post.id} className="overflow-hidden rounded-2xl border border-[#e3eaf2] bg-white shadow-sm">{image ? <img src={`/api/files?key=${encodeURIComponent(image.objectKey)}`} alt={post.title} className="aspect-[4/3] w-full object-cover"/> : <div className="grid aspect-[4/3] place-items-center bg-[#f3f6f9] text-[#8aa0b5]"><FileText size={38}/></div>}<div className="p-4"><p className="text-xs font-bold text-[#168ac0]">{post.category}</p><h2 className="mt-1 line-clamp-2 font-extrabold text-[#182230]">{post.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#667085]">{post.content}</p></div></article>; })}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#d0d5dd] bg-white py-14 text-center text-sm text-[#667085]">Người dùng này chưa có bài đăng công khai.</div>}</section>
  </main>;
}