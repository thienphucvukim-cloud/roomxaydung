"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { ArrowUpRight, Globe2, LoaderCircle, MapPin, MessageCircle, Send } from "lucide-react";
import { ClientNavigationLink } from "@/components/client-navigation-link";
import { CurrentMemberAvatar, MemberAvatar } from "@/components/member-avatar";
import { OwnerPostControls } from "@/components/site-editor";
import { ShareActionButton, ToggleActionButton } from "@/components/interactive-actions";
import type { NewsPost } from "@/lib/news-feed";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const actionClass = "flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-md px-1 text-xs font-semibold text-[#65676b] transition hover:bg-[#f0f2f5] focus-visible:outline-2 focus-visible:outline-[#229ed9] disabled:opacity-50 sm:text-sm";
type Comment = { id: number; authorName: string; content: string; imageUrl?: string | null };

export function NewsPostCard({ post, onFilter }: { post: NewsPost; onFilter?: (category: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>();
  const [commentLoading, setCommentLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState("");
  const canExpand = post.content.length > 280 || post.content.split("\n").length > 4;
  const images = post.images.slice(0, 5);

  const toggleComments = async () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (!next || commentLoading) return;
    setCommentLoading(true); setCommentError("");
    try {
      const response = await fetch(`/api/comments?postId=${post.id}`, { cache: "no-store" });
      const payload = await response.json() as { comments?: Comment[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Chưa thể tải bình luận.");
      setComments(payload.comments ?? []);
    } catch (cause) { setCommentError(cause instanceof Error ? cause.message : "Chưa thể tải bình luận."); }
    finally { setCommentLoading(false); }
  };

  const sendComment = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || !draft.trim()) return;
    setSending(true); setCommentError("");
    try {
      const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id, content: draft.trim() }) });
      const payload = await response.json() as { comment?: Comment; error?: string };
      if (!response.ok || !payload.comment) throw new Error(payload.error || "Chưa thể gửi bình luận.");
      setComments(previous => [...(previous ?? []), payload.comment!]); setDraft("");
    } catch (cause) { setCommentError(cause instanceof Error ? cause.message : "Chưa thể gửi bình luận."); }
    finally { setSending(false); }
  };

  return <article aria-labelledby={`news-post-${post.id}`} className="overflow-hidden rounded-xl border border-[#dddfe2] bg-white text-[#1c1e21] shadow-sm">
    <header className="flex items-start gap-3 px-4 pb-3 pt-4">
      <ClientNavigationLink href={`/nguoi-dung/${encodeURIComponent(post.userId)}`} aria-label={`Trang cá nhân của ${post.authorName}`} className="shrink-0 rounded-full">
        <MemberAvatar name={post.authorName} src={post.avatarUrl} className="size-11 text-sm" decorative />
      </ClientNavigationLink>
      <div className="min-w-0 flex-1">
        <ClientNavigationLink href={`/nguoi-dung/${encodeURIComponent(post.userId)}`} className="block w-fit max-w-full break-words text-[15px] font-semibold hover:underline">{post.authorName}</ClientNavigationLink>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#65676b]">
          <ClientNavigationLink href={post.sourceHref} className="hover:underline"><time dateTime={post.createdAt}>{dateFormat.format(new Date(post.createdAt))}</time></ClientNavigationLink>
          <span aria-hidden="true">·</span><Globe2 size={12} aria-label="Công khai" />
          <span aria-hidden="true">·</span>{onFilter ? <button type="button" onClick={() => onFilter(post.category)} className="hover:text-[#168ac0] hover:underline">{post.sourceLabel}</button> : <span>{post.sourceLabel}</span>}
        </div>
      </div>
      <OwnerPostControls postId={post.id} authorId={post.userId} />
    </header>

    <div className="px-4 pb-3">
      {post.category !== "Bảng tin" && <h3 id={`news-post-${post.id}`} className="break-words text-[15px] font-semibold leading-6">{post.title}</h3>}
      {post.category === "Bảng tin" && <h3 id={`news-post-${post.id}`} className="sr-only">{post.title}</h3>}
      {post.content && <>
        <p className={`mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 ${canExpand && !expanded ? "line-clamp-4" : ""}`}>{post.content}</p>
        {canExpand && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-1 text-sm font-semibold hover:underline">{expanded ? "Thu gọn" : "Xem thêm"}</button>}
      </>}
      {(post.location || post.feeling) && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#65676b]">
        {post.location && <span className="flex items-center gap-1"><MapPin size={13} />{post.location}</span>}
        {post.feeling && <span>{post.feeling}</span>}
      </div>}
      {post.pollQuestion && <p className="mt-3 rounded-lg bg-[#f0f2f5] p-3 text-sm font-semibold">{post.pollQuestion}</p>}
    </div>

    {images.length > 0 && <div className={`grid gap-0.5 bg-[#f0f2f5] ${images.length === 1 ? "grid-cols-1" : images.length <= 4 ? "grid-cols-2" : "grid-cols-6"}`}>
      {images.map((photo, index) => <ClientNavigationLink key={`${photo.url}:${index}`} href={post.sourceHref} aria-label={`Xem ảnh ${index + 1} của bài viết ${post.title}`} className={`relative block overflow-hidden ${images.length === 1 ? "" : images.length === 3 && index === 0 ? "row-span-2" : images.length === 5 ? index < 2 ? "col-span-3" : "col-span-2" : ""}`}>
        <Image src={photo.url} alt={photo.name || `${post.title} – ảnh ${index + 1}`} width={900} height={900} unoptimized className={images.length === 1 ? "max-h-[640px] w-full object-contain" : `h-full w-full object-cover ${images.length === 3 && index > 0 ? "aspect-[2/1]" : "aspect-square"}`} />
        {index === 4 && post.images.length > 5 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-3xl font-semibold text-white">+{post.images.length - 5}</span>}
      </ClientNavigationLink>)}
    </div>}

    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-xs text-[#65676b]">{post.sourceLabel}</span>
      <ClientNavigationLink href={post.sourceHref} className="flex min-h-9 items-center gap-1 rounded-md bg-[#e7f3ff] px-3 text-sm font-semibold text-[#1877f2] hover:bg-[#dbeaff]">Xem bài viết<ArrowUpRight size={16} /></ClientNavigationLink>
    </div>
    <div className="mx-4 grid grid-cols-3 gap-1 border-t border-[#e4e6eb] py-1">
      <ToggleActionButton actionType="like" targetType="post" targetId={String(post.id)} label="Thích" activeLabel="Đã thích" icon="heart" className={actionClass} />
      <button type="button" onClick={() => void toggleComments()} aria-expanded={commentsOpen} className={actionClass}><MessageCircle size={17} /><span>Bình luận</span></button>
      <ShareActionButton title={post.title} url={post.sourceHref} targetType="post" targetId={String(post.id)} className={actionClass} />
    </div>
    {commentsOpen && <div className="space-y-3 border-t border-[#e4e6eb] px-4 py-3">
      {commentLoading && <p role="status" className="text-xs text-[#65676b]">Đang tải bình luận...</p>}
      {comments?.map(comment => <div key={comment.id} className="w-fit max-w-full rounded-2xl bg-[#f0f2f5] px-3 py-2"><p className="text-xs font-semibold">{comment.authorName}</p><p className="whitespace-pre-wrap break-words text-sm">{comment.content}</p>{comment.imageUrl && <Image src={comment.imageUrl} alt="Ảnh trong bình luận" width={320} height={240} unoptimized className="mt-2 max-h-60 w-auto rounded-lg object-contain" />}</div>)}
      {!commentLoading && comments?.length === 0 && <p className="text-xs text-[#65676b]">Chưa có bình luận. Hãy là người đầu tiên chia sẻ ý kiến.</p>}
      {commentError && <p role="alert" className="text-xs text-rose-600">{commentError}</p>}
      <form onSubmit={sendComment} data-requires-account className="flex items-center gap-2"><CurrentMemberAvatar className="size-8" /><div className="flex min-w-0 flex-1 items-center rounded-full bg-[#f0f2f5] pl-3 pr-1"><input aria-label="Nội dung bình luận" placeholder="Viết bình luận..." value={draft} onChange={event => setDraft(event.target.value)} maxLength={600} disabled={sending || commentLoading || !comments} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /><button type="submit" aria-label="Gửi bình luận" disabled={sending || commentLoading || !comments || !draft.trim()} className="grid size-9 shrink-0 place-items-center rounded-full text-[#1877f2] disabled:opacity-40">{sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}</button></div></form>
    </div>}
  </article>;
}
