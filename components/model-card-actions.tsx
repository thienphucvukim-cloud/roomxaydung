"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, LoaderCircle, Send, X } from "lucide-react";
import { ModelCardFooter } from "@/components/model-card-footer";
import { optimizeImageForUpload } from "@/lib/image-upload";
import { PostCommentPanel } from "@/components/post-comment-panel";
import { CurrentMemberAvatar } from "@/components/member-avatar";

type Comment = { id: number; authorName: string; content: string; imageUrl?: string | null };
type CommentImage = { key: string; url: string };

export function ModelCardActions({ title, meta, image, recipientUserId }: { title: string; meta: string; image: string; recipientUserId: string }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [commentImage, setCommentImage] = useState<CommentImage>();
  const imageInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ comments: 0, expertQuestions: 0 });

  const refreshCounts = useCallback(() => fetch("/api/model-engagement?targetId=" + encodeURIComponent(title))
    .then((response) => response.ok ? response.json() as Promise<typeof counts> : Promise.reject())
    .then(setCounts)
    .catch(() => {}), [title]);

  useEffect(() => { void refreshCounts(); }, [refreshCounts]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || comments) return;
    try {
      const response = await fetch("/api/model-comments?targetId=" + encodeURIComponent(title));
      const data = await response.json() as { comments?: Comment[] };
      setComments(response.ok ? data.comments ?? [] : []);
    } catch {
      setComments([]);
    }
  };

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy || uploading) return;
    if (!file.type.startsWith("image/")) { setError("Bình luận chỉ hỗ trợ tệp ảnh."); return; }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", await optimizeImageForUpload(file, "comment"));
      form.append("purpose", "comment-image");
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = await response.json() as { error?: string; attachment?: CommentImage };
      if (!response.ok || !data.attachment?.url) throw new Error(data.error || "Không thể tải ảnh bình luận.");
      setCommentImage(data.attachment);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải ảnh bình luận.");
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    const value = draft.trim();
    if ((!value && !commentImage) || busy || uploading) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/model-comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId: title, content: value, imageKey: commentImage?.key }) });
      const data = await response.json() as { error?: string; comment?: Comment };
      if (!response.ok || !data.comment) throw new Error(data.error || "Chưa thể gửi bình luận.");
      setComments((current) => [...(current ?? []), data.comment as Comment]);
      setDraft("");
      setCommentImage(undefined);
      setCounts((current) => ({ ...current, comments: current.comments + 1 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chưa thể gửi bình luận.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <ModelCardFooter title={title} meta={meta} targetType="house-model" targetId={title} recipientUserId={recipientUserId} comments={counts.comments} expertQuestions={counts.expertQuestions} commentOpen={open} onToggleComments={() => void toggle()} onQuestionSent={() => void refreshCounts()}/>
    <PostCommentPanel modelQuery={title} open={open} onOpenChange={setOpen} title={title} image={image} meta={meta}>
      {comments?.map((comment) => <div key={comment.id} className="rounded-2xl bg-[#eef1f4] px-3 py-2"><b className="block text-xs text-[#182230]">{comment.authorName}</b>{comment.content && <p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-[#344054]">{comment.content}</p>}{comment.imageUrl && <img src={comment.imageUrl} alt="Ảnh trong bình luận" className="mt-2 max-h-64 max-w-full rounded-xl object-contain"/>}</div>)}
      {comments === null && <p className="py-1 text-center text-xs text-[#667085]">Đang tải bình luận...</p>}
      {comments?.length === 0 && <p className="py-1 text-center text-xs text-[#667085]">Chưa có bình luận.</p>}
      {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
      <div data-requires-account className="flex items-start gap-2">
        <CurrentMemberAvatar className="size-8"/>
        <div className="min-w-0 flex-1">
          {commentImage && <div className="relative mb-2 w-fit"><img src={commentImage.url} alt="Ảnh chuẩn bị gửi" className="max-h-28 max-w-full rounded-xl object-contain"/><button type="button" onClick={() => setCommentImage(undefined)} disabled={busy || uploading} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#344054] text-white disabled:opacity-50" aria-label="Bỏ ảnh"><X size={14}/></button></div>}
          <div className="flex items-center rounded-full bg-[#eef1f4] pl-3 pr-1">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} disabled={busy} maxLength={600} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Viết bình luận..."/>
            <button type="button" onClick={() => imageInput.current?.click()} disabled={busy || uploading} title="Thêm ảnh" aria-label="Thêm ảnh" className="grid size-8 shrink-0 place-items-center rounded-full text-[#229ed9] hover:bg-[#e4e6eb] disabled:opacity-50">{uploading ? <LoaderCircle size={17} className="animate-spin"/> : <ImagePlus size={17}/>}</button>
            <button type="button" onClick={() => void send()} disabled={busy || uploading || (!draft.trim() && !commentImage)} className="grid size-8 shrink-0 place-items-center text-[#229ed9] disabled:text-[#bcc0c4]" aria-label="Gửi bình luận">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Send size={16}/>}</button>
          </div>
          <input ref={imageInput} type="file" accept="image/*" className="hidden" disabled={busy || uploading} onChange={(event) => void chooseImage(event)}/>
          {uploading && <p role="status" className="mt-1 text-xs text-[#667085]">Đang tải ảnh...</p>}
        </div>
      </div>
    </PostCommentPanel>
  </>;
}
