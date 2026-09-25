"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, MessageCircle, Send, Share2, X } from "lucide-react";
import { RequestActionButton } from "@/components/interactive-actions";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Comment = { id: number; authorName: string; content: string };

export function ModelCardActions({ title, meta, image, recipientUserId }: { title: string; meta: string; image: string; recipientUserId: string }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [counts, setCounts] = useState({ comments: 0, shares: 0, expertQuestions: 0 });

  const refreshCounts = () => fetch("/api/model-engagement?targetId=" + encodeURIComponent(title))
    .then((response) => response.ok ? response.json() as Promise<typeof counts> : Promise.reject())
    .then(setCounts)
    .catch(() => {});

  useEffect(() => { void refreshCounts(); }, [title]);

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

  const send = async () => {
    const value = draft.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/model-comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId: title, content: value }) });
      const data = await response.json() as { error?: string; comment?: Comment };
      if (!response.ok || !data.comment) throw new Error(data.error || "Chưa thể gửi bình luận.");
      setComments((current) => [...(current ?? []), data.comment as Comment]);
      setDraft("");
      setCounts((current) => ({ ...current, comments: current.comments + 1 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chưa thể gửi bình luận.");
    } finally {
      setBusy(false);
    }
  };

  const shareToFeed = async () => {
    if (sharing) return;
    setSharing(true);
    setShareError("");
    try {
      const imageResponse = await fetch(image);
      if (!imageResponse.ok) throw new Error("Không thể tải ảnh mẫu để chia sẻ.");
      const blob = await imageResponse.blob();
      const formData = new FormData();
      formData.append("file", new File([blob], "mau-nha-dep.png", { type: blob.type || "image/png" }));
      const uploadResponse = await fetch("/api/files", { method: "POST", body: formData });
      const uploadData = await uploadResponse.json() as { error?: string; attachment?: { key: string; name: string; type: string; size: number } };
      if (!uploadResponse.ok || !uploadData.attachment) throw new Error(uploadData.error || "Không thể tải ảnh mẫu.");
      const response = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: ("Mẫu nhà đẹp: " + title).slice(0, 120), content: shareText.trim() || `${title} · ${meta}`, category: "Mẫu nhà đẹp", audience: "Công khai", attachments: [uploadData.attachment] }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Chưa thể chia sẻ lên Bảng tin.");
      await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionType: "share", targetType: "house-model", targetId: title }) });
      await refreshCounts();
      setShareText("");
      setShareOpen(false);
    } catch (reason) {
      setShareError(reason instanceof Error ? reason.message : "Chưa thể chia sẻ lên Bảng tin.");
    } finally {
      setSharing(false);
    }
  };

  return <>
    <div className="mt-3 flex items-center justify-between border-t border-[#e8eef5] pt-2 text-[11px] text-[#667085]"><span>{comments?.length ?? counts.comments} bình luận</span><span>{counts.shares} lượt chia sẻ</span><span>{counts.expertQuestions} câu hỏi</span></div>
    <div className="mt-1 grid grid-cols-3 border-t border-[#edf1f5] pt-1">
      <button type="button" onClick={() => void toggle()} aria-label="Bình luận" title="Bình luận" className={`grid place-items-center rounded-lg py-2.5 hover:bg-[#f2f4f7] ${open ? "text-[#168ac0]" : "text-[#475467]"}`}><MessageCircle size={19}/></button>
      <button type="button" onClick={() => setShareOpen(true)} aria-label="Chia sẻ lên Bảng tin" title="Chia sẻ lên Bảng tin" className="grid place-items-center rounded-lg py-2.5 text-[#475467] hover:bg-[#f2f4f7]"><Share2 size={19}/></button>
      <RequestActionButton requestType="expert-question" targetType="house-model" targetId={title} label="Hỏi chuyên gia" title={"Hỏi chuyên gia: " + title} description={"Mẫu tham khảo: " + meta + ". Hãy nhập câu hỏi bạn muốn chuyên gia giải đáp."} allowFile iconOnly="expert" recipientUserId={recipientUserId} onSuccess={() => void refreshCounts()} className="grid place-items-center rounded-lg py-2.5 text-[#475467] hover:bg-[#f2f4f7]"/>
    </div>
    {open && <div className="space-y-2 border-t border-[#edf0f3] bg-[#fbfcfd] p-3">
      {comments?.map((comment) => <div key={comment.id} className="rounded-2xl bg-[#eef1f4] px-3 py-2"><b className="block text-xs text-[#182230]">{comment.authorName}</b><p className="mt-0.5 text-sm leading-5 text-[#344054]">{comment.content}</p></div>)}
      {comments === null && <p className="py-1 text-center text-xs text-[#667085]">Đang tải bình luận...</p>}
      {comments?.length === 0 && <p className="py-1 text-center text-xs text-[#667085]">Chưa có bình luận.</p>}
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      <div className="flex items-center gap-2"><img src="/avatars/user-nguyen-van-a.png" alt="" className="size-8 rounded-full object-cover"/><div className="flex flex-1 items-center rounded-full bg-[#eef1f4] pl-3 pr-1"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} maxLength={600} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Viết bình luận..."/><button type="button" onClick={() => void send()} disabled={busy || !draft.trim()} className="grid size-8 place-items-center text-[#229ed9] disabled:text-[#bcc0c4]" aria-label="Gửi bình luận"><Send size={16}/></button></div></div>
    </div>}
    <Dialog open={shareOpen} onOpenChange={setShareOpen}>
      <DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] max-w-[520px] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0">
        <header className="relative border-b px-14 py-4 text-center"><DialogTitle className="text-xl font-extrabold">Chia sẻ lên Bảng tin</DialogTitle><DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose></header>
        <div className="p-4"><div className="flex items-center gap-3"><img src="/avatars/user-nguyen-van-a.png" alt="" className="size-10 rounded-full object-cover"/><div><b className="block text-sm">Thành viên Tipook</b><small className="text-[#667085]">Công khai</small></div></div><textarea value={shareText} onChange={(event) => setShareText(event.target.value)} rows={4} maxLength={1200} className="mt-4 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Nói gì đó về mẫu nhà này..."/><div className="mt-3 flex gap-3 rounded-xl border bg-[#f8fafc] p-3"><img src={image} alt={title} className="size-20 rounded-lg object-cover"/><div className="min-w-0"><b className="line-clamp-2 text-sm">{title}</b><p className="mt-1 text-xs text-[#667085]">{meta}</p></div></div>{shareError && <p className="mt-3 text-sm font-semibold text-rose-600">{shareError}</p>}<button type="button" onClick={() => void shareToFeed()} disabled={sharing} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] font-bold text-white disabled:opacity-60">{sharing ? <LoaderCircle size={18} className="animate-spin"/> : <Share2 size={18}/>}Chia sẻ lên Bảng tin</button></div>
      </DialogContent>
    </Dialog>
  </>;
}
