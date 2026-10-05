"use client";

import { SITE_EVENTS } from "@/lib/site-events";
import { POST_CATEGORIES } from "@/lib/legacy-contracts";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { ArrowUpRight, Globe2, ImagePlus, LoaderCircle, MapPin, MessageCircle, Send, X } from "lucide-react";
import { ClientNavigationLink } from "@/components/client-navigation-link";
import { CurrentMemberAvatar, MemberAvatar } from "@/components/member-avatar";
import { OwnerPostControls } from "@/components/site-editor";
import { RequestActionButton, ShareActionButton, ToggleActionButton } from "@/components/interactive-actions";
import { PurchaseActionButton } from "@/components/purchase-action-button";
import { postHref } from "@/lib/post-url";
import { NewsPhotoViewer } from "@/components/news-photo-viewer";
import { AutoResizeTextarea } from "@/components/auto-resize-textarea";
import { optimizeImageForUpload } from "@/lib/image-upload";
import { formatFeedPrice, formatPriceDescription } from "@/lib/price-description";
import { parseVndPrice } from "@/lib/drawing-catalog";
import type { NewsPost } from "@/lib/news-feed";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const actionClass = "flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md px-1 font-semibold text-[#65676b] transition hover:bg-[#f0f2f5] focus-visible:outline-2 focus-visible:outline-[#229ed9] disabled:opacity-50 [&>span]:whitespace-nowrap [&>span]:text-xs sm:[&>span]:text-sm [&>svg]:shrink-0";
type Comment = { id: number; userId: string; authorName: string; avatarUrl?: string | null; content: string; createdAt: string; imageUrl?: string | null };
type CommentResponse = { comments?: Comment[]; total: number; nextCursor?: number | null; error?: string };
type CommentImage = { key: string; url: string; name: string };
type Gallery = { photos: NewsPost["images"]; index: number };

export function NewsPostCard({ post, onFilter, detail = false }: { post: NewsPost; onFilter?: (category: string) => void; detail?: boolean }) {
  const [expanded, setExpanded] = useState(detail);
  const [commentsOpen, setCommentsOpen] = useState(detail);
  const [comments, setComments] = useState<Comment[]>();
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentRevision, setCommentRevision] = useState(0);
  const [commentTotal, setCommentTotal] = useState<number>();
  const [olderCursor, setOlderCursor] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [commentImage, setCommentImage] = useState<CommentImage>();
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const photoTrigger = useRef<HTMLButtonElement | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const loaded = useRef(false);
  const requestBusy = useRef(false);
  const mounted = useRef(true);
  const canExpand = post.content.length > 280 || post.content.split("\n").length > 4;
  const images = post.images.slice(0, 5);
  const title = formatPriceDescription(post.title);
  const content = formatPriceDescription(post.content);
  const displayedTotal = commentTotal ?? post.comments ?? 0;
  const hasFileActions = detail && (post.category === POST_CATEGORIES.drawings || post.category === POST_CATEGORIES.interiors);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!commentsOpen) return;
    const controller = new AbortController();
    const refresh = async () => {
      if (requestBusy.current || controller.signal.aborted) return;
      requestBusy.current = true;
      if (!loaded.current) setCommentLoading(true);
      try {
        const response = await fetch(`/api/comments?postId=${post.id}&limit=20`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as CommentResponse;
        if (!response.ok) throw new Error(payload.error || "Chưa thể tải bình luận.");
        if (controller.signal.aborted) return;
        setComments(previous => [...new Map([...(previous ?? []), ...(payload.comments ?? [])].map(item => [item.id, item])).values()].sort((a, b) => a.id - b.id));
        setCommentTotal(previous => Math.max(previous ?? 0, payload.total));
        if (!loaded.current) setOlderCursor(payload.nextCursor ?? null);
        loaded.current = true;
        setCommentError("");
      } catch (cause) {
        if (!controller.signal.aborted) setCommentError(cause instanceof Error ? cause.message : "Chưa thể tải bình luận.");
      } finally {
        if (!controller.signal.aborted) { requestBusy.current = false; setCommentLoading(false); }
      }
    };
    void refresh();
    const update = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    return () => { controller.abort(); requestBusy.current = false; window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, [commentsOpen, post.id, commentRevision]);

  const loadOlder = async () => {
    if (!olderCursor || requestBusy.current) return;
    requestBusy.current = true; setCommentLoading(true); setCommentError("");
    try {
      const response = await fetch(`/api/comments?postId=${post.id}&limit=20&beforeId=${olderCursor}`, { cache: "no-store" });
      const payload = await response.json() as CommentResponse;
      if (!response.ok) throw new Error(payload.error || "Chưa thể tải bình luận trước.");
      if (!mounted.current) return;
      setComments(previous => [...new Map([...(previous ?? []), ...(payload.comments ?? [])].map(item => [item.id, item])).values()].sort((a, b) => a.id - b.id));
      setOlderCursor(payload.nextCursor ?? null); setCommentTotal(payload.total);
    } catch (cause) { if (mounted.current) setCommentError(cause instanceof Error ? cause.message : "Chưa thể tải bình luận trước."); }
    finally { requestBusy.current = false; if (mounted.current) setCommentLoading(false); }
  };

  const chooseCommentImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || sending || uploading) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) { setCommentError("Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF."); return; }
    setUploading(true); setCommentError("");
    try {
      const form = new FormData(); form.append("file", await optimizeImageForUpload(file, "comment")); form.append("purpose", "comment-image");
      const response = await fetch("/api/files", { method: "POST", body: form });
      const payload = await response.json() as { attachment?: CommentImage; error?: string };
      if (!response.ok || !payload.attachment) throw new Error(payload.error || "Không thể tải ảnh bình luận.");
      if (mounted.current) setCommentImage(payload.attachment);
    } catch (cause) { if (mounted.current) setCommentError(cause instanceof Error ? cause.message : "Không thể tải ảnh bình luận."); }
    finally { if (mounted.current) setUploading(false); }
  };

  const sendComment = async (event?: FormEvent) => {
    event?.preventDefault();
    if (sending || uploading || (!draft.trim() && !commentImage)) return;
    setSending(true); setCommentError("");
    try {
      const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id, content: draft.trim(), imageKey: commentImage?.key }) });
      const payload = await response.json() as { comment?: Comment; total?: number; error?: string };
      if (!response.ok || !payload.comment) throw new Error(payload.error || "Chưa thể gửi bình luận.");
      if (!mounted.current) return;
      setComments(previous => [...new Map([...(previous ?? []), payload.comment!].map(item => [item.id, item])).values()].sort((a, b) => a.id - b.id));
      setCommentTotal(value => typeof payload.total === "number" ? Math.max(value ?? 0, payload.total) : (value ?? post.comments ?? 0) + 1);
      setDraft(""); setCommentImage(undefined);
      window.dispatchEvent(new Event(SITE_EVENTS.contentChanged));
      window.setTimeout(() => commentInput.current?.focus(), 0);
    } catch (cause) { if (mounted.current) setCommentError(cause instanceof Error ? cause.message : "Chưa thể gửi bình luận."); }
    finally { if (mounted.current) setSending(false); }
  };

  const openPhoto = (photos: NewsPost["images"], index: number, trigger: HTMLButtonElement) => {
    photoTrigger.current = trigger; setGallery({ photos, index }); setCommentsOpen(true);
  };

  const postHeader = <header className="flex flex-wrap items-start gap-3 px-4 pb-3 pt-4">
    <ClientNavigationLink href={`/nguoi-dung/${encodeURIComponent(post.userId)}`} aria-label={`Trang cá nhân của ${post.authorName}`} className="shrink-0 rounded-full">
      <MemberAvatar name={post.authorName} src={post.avatarUrl} className="size-11 text-sm" decorative />
    </ClientNavigationLink>
    <div className="min-w-0 flex-1">
      <ClientNavigationLink href={`/nguoi-dung/${encodeURIComponent(post.userId)}`} className="block w-fit max-w-full break-words text-[15px] font-semibold hover:underline">{post.authorName}</ClientNavigationLink>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#65676b]">
        <time dateTime={post.createdAt}><ClientNavigationLink href={postHref(post)}>{dateFormat.format(new Date(post.createdAt))}</ClientNavigationLink></time>
        <span aria-hidden="true">·</span><Globe2 size={12} aria-label="Công khai" />
        <span aria-hidden="true">·</span>{onFilter && !gallery ? <button type="button" onClick={() => onFilter(post.category)} className="hover:text-[#168ac0] hover:underline">{post.sourceLabel}</button> : <span>{post.sourceLabel}</span>}
      </div>
    </div>
    <OwnerPostControls postId={post.id} authorId={post.userId} />
  </header>;

  const postContent = <div className="px-4 pb-3">
    {detail ? <h1 className="break-words text-xl font-bold leading-7">{title}</h1> : post.category !== POST_CATEGORIES.news && <h3 className="break-words text-[15px] font-semibold leading-6"><ClientNavigationLink href={postHref(post)}>{title}</ClientNavigationLink></h3>}
    {post.content && <>
      <p className={`mt-1 whitespace-pre-wrap break-words text-[15px] leading-6 ${canExpand && !expanded && !gallery ? "line-clamp-4" : ""}`}>{content}</p>
      {canExpand && !gallery && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-1 text-sm font-semibold hover:underline">{expanded ? "Thu gọn" : "Xem thêm"}</button>}
    </>}
    {(post.specifications || post.listingType) && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#65676b]">
      {post.specifications && <span className="flex items-center gap-1"><MapPin size={13} />{formatPriceDescription(post.specifications)}</span>}
      {post.listingType && <span>{formatPriceDescription(post.listingType)}</span>}
    </div>}
    {post.priceLabel && <p className="mt-3 rounded-lg bg-[#f0f2f5] p-3 text-sm font-semibold">{formatFeedPrice(post.priceLabel)}</p>}
  </div>;

  const postLink = <div className="flex items-center justify-between gap-3 px-4 py-3">
    <span className="text-xs text-[#65676b]">{post.sourceLabel}</span>
    {!detail && <ClientNavigationLink href={postHref(post)} className="flex min-h-9 items-center gap-1 rounded-md bg-[#e7f3ff] px-3 text-sm font-semibold text-[#1877f2] hover:bg-[#dbeaff]">Xem bài viết<ArrowUpRight size={16} /></ClientNavigationLink>}
    {hasFileActions && <div className="flex flex-wrap justify-end gap-2">
      <RequestActionButton requestType="drawing-file-request" targetType="post" targetId={String(post.id)} recipientUserId={post.userId} label="Yêu cầu file" title={"Yêu cầu file: " + post.title} description="Tin nhắn sẽ được gửi trực tiếp đến người đăng." className="flex min-h-10 items-center gap-2 rounded-lg border border-[#cfeaf5] bg-[#f1faff] px-3 text-sm font-semibold text-[#168ac0]"/>
      <PurchaseActionButton targetType="post" targetId={String(post.id)} title={post.title} price={post.priceLabel || "Miễn phí"} label={parseVndPrice(post.priceLabel || "") ? "Mua file" : "Tải file"} className="flex min-h-10 items-center gap-2 rounded-lg bg-[#229ed9] px-3 text-sm font-semibold text-white"/>
    </div>}
  </div>;

  const actions = <div className="mx-4 grid grid-cols-3 gap-1 border-t border-[#e4e6eb] py-1">
    <ToggleActionButton actionType="like" targetType="post" targetId={String(post.id)} label="Thích" activeLabel="Đã thích" icon="heart" showCount showLabelWithCount className={actionClass} />
    <button type="button" onClick={() => { setCommentsOpen(true); window.setTimeout(() => commentInput.current?.focus(), 0); }} aria-expanded={commentsOpen} className={actionClass}><MessageCircle size={17} /><span>Bình luận{displayedTotal > 0 ? ` (${displayedTotal.toLocaleString("vi-VN")})` : ""}</span></button>
    <ShareActionButton title={post.title} url={postHref(post)} targetType="post" targetId={String(post.id)} className={actionClass} />
  </div>;

  const commentThread = <section aria-label="Bình luận bài viết" className="space-y-3 border-t border-[#e4e6eb] px-4 py-3">
    <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Bình luận</h4>{!gallery && !detail && <button type="button" onClick={() => setCommentsOpen(false)} className="text-xs text-[#65676b] hover:underline">Ẩn bình luận</button>}</div>
    {olderCursor && <button type="button" disabled={commentLoading} onClick={() => void loadOlder()} className="text-sm font-semibold text-[#65676b] hover:underline disabled:opacity-50">Xem bình luận trước</button>}
    {commentLoading && <p role="status" className="flex items-center gap-2 text-xs text-[#65676b]"><LoaderCircle size={14} className="animate-spin" />Đang tải bình luận...</p>}
    {comments?.map(comment => <div key={comment.id} className="flex items-start gap-2">
      <ClientNavigationLink href={`/nguoi-dung/${encodeURIComponent(comment.userId)}`} aria-label={`Trang cá nhân của ${comment.authorName}`} className="shrink-0"><MemberAvatar name={comment.authorName} src={comment.avatarUrl} className="size-8 text-xs" decorative /></ClientNavigationLink>
      <div className="min-w-0 max-w-full">
        <div className="w-fit max-w-full rounded-2xl bg-[#f0f2f5] px-3 py-2"><ClientNavigationLink href={`/nguoi-dung/${encodeURIComponent(comment.userId)}`} className="break-words text-xs font-semibold hover:underline">{comment.authorName}</ClientNavigationLink>{comment.content && <p className="whitespace-pre-wrap break-words text-sm">{formatPriceDescription(comment.content)}</p>}</div>
        {comment.imageUrl && <button type="button" aria-label={`Xem ảnh bình luận của ${comment.authorName}`} onClick={event => openPhoto([{ url: comment.imageUrl!, name: `Ảnh bình luận của ${comment.authorName}` }], 0, event.currentTarget)} className="mt-2 block overflow-hidden rounded-lg"><Image src={comment.imageUrl} alt="Ảnh trong bình luận" width={320} height={240} unoptimized className="max-h-60 w-auto object-contain" /></button>}
        <time dateTime={comment.createdAt} className="mt-1 block text-[11px] text-[#65676b]">{dateFormat.format(new Date(comment.createdAt))}</time>
      </div>
    </div>)}
    {!commentLoading && comments?.length === 0 && <p className="text-xs text-[#65676b]">Chưa có bình luận. Hãy là người đầu tiên chia sẻ ý kiến.</p>}
    {commentError && <p role="alert" className="text-xs text-rose-600">{commentError}{comments === undefined && <button type="button" onClick={() => setCommentRevision(value => value + 1)} className="ml-2 font-semibold underline">Thử lại</button>}</p>}
    <form onSubmit={sendComment} data-requires-account className="flex items-start gap-2">
      <CurrentMemberAvatar className="size-8 shrink-0" />
      <div className="min-w-0 flex-1">
        {commentImage && <div className="relative mb-2 w-fit"><Image src={commentImage.url} alt="Ảnh chuẩn bị gửi" width={160} height={120} unoptimized className="max-h-28 w-auto rounded-lg object-contain" /><button type="button" disabled={sending || uploading} onClick={() => setCommentImage(undefined)} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#344054] text-white disabled:opacity-50" aria-label="Bỏ ảnh bình luận"><X size={14} /></button></div>}
        <div className="flex min-w-0 items-end rounded-2xl bg-[#f0f2f5] pl-3 pr-1">
          <AutoResizeTextarea ref={commentInput} aria-label="Nội dung bình luận" placeholder="Viết bình luận..." value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendComment(); } }} maxLength={600} rows={1} disabled={sending} className="min-h-10 min-w-0 flex-1 bg-transparent py-2 text-sm leading-6 outline-none" />
          <label className={`grid size-9 shrink-0 place-items-center rounded-full text-[#1877f2] ${sending || uploading ? "opacity-40" : "cursor-pointer hover:bg-[#e4e6eb]"}`} title="Thêm ảnh bình luận">{uploading ? <LoaderCircle size={18} className="animate-spin" /> : <ImagePlus size={18} />}<input type="file" aria-label="Thêm ảnh bình luận" accept="image/jpeg,image/png,image/webp,image/gif" disabled={sending || uploading} onChange={event => void chooseCommentImage(event)} className="sr-only" /></label>
          <button type="submit" aria-label="Gửi bình luận" disabled={sending || uploading || (!draft.trim() && !commentImage)} className="grid size-9 shrink-0 place-items-center rounded-full text-[#1877f2] hover:bg-[#e4e6eb] disabled:opacity-40">{sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}</button>
        </div>
        {uploading && <p role="status" className="mt-1 text-xs text-[#65676b]">Đang tải ảnh...</p>}
      </div>
    </form>
  </section>;

  return <article id={`post-${post.id}`} data-auth-post-id={post.id} data-auth-post-href={postHref(post)} ref={articleRef} aria-label={title} className="scroll-mt-24 overflow-hidden rounded-xl border border-[#dddfe2] bg-white text-[#1c1e21] shadow-sm">
    {postHeader}{postContent}
    {images.length > 0 && <div className={`grid gap-0.5 bg-[#f0f2f5] ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "h-[clamp(240px,48vw,480px)] grid-cols-2" : `h-[clamp(320px,75vw,640px)] grid-rows-2 ${images.length <= 4 ? "grid-cols-2" : "grid-cols-6"}`}`}>
      {images.map((photo, index) => <button key={`${photo.url}:${index}`} type="button" onClick={event => openPhoto(post.images, index, event.currentTarget)} aria-haspopup="dialog" aria-label={`Xem ảnh ${index + 1} của bài viết ${post.title}`} className={`relative block min-h-0 min-w-0 overflow-hidden focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[#229ed9] ${images.length === 1 ? "" : images.length === 3 && index === 0 ? "row-span-2" : images.length === 5 ? index < 2 ? "col-span-3" : "col-span-2" : ""}`}>
        <Image src={photo.url} alt={photo.name || `${post.title} – ảnh ${index + 1}`} width={900} height={900} unoptimized className={images.length === 1 ? "max-h-[640px] w-full object-contain" : "h-full w-full object-cover"} />
        {index === 4 && post.images.length > 5 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-3xl font-semibold text-white">+{post.images.length - 5}</span>}
      </button>)}
    </div>}
    {postLink}{actions}
    {commentsOpen && !gallery && commentThread}
    <NewsPhotoViewer postId={post.id} photos={gallery?.photos ?? []} index={gallery?.index ?? null} onIndexChange={index => setGallery(previous => previous ? { ...previous, index } : null)} onClose={() => setGallery(null)} onRestoreFocus={() => {
      const trigger = photoTrigger.current;
      if (trigger?.isConnected) trigger.focus();
      else Array.from(articleRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(button => button.getAttribute("aria-label") === trigger?.getAttribute("aria-label"))?.focus();
    }} title={title}>
      {postHeader}{postContent}{postLink}{actions}{commentThread}
    </NewsPhotoViewer>
  </article>;
}
