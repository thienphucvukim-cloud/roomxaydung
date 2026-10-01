"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { RequestActionButton } from "@/components/interactive-actions";

type Comment = { id: number; authorName: string; content: string };

export function ModelCardActions({ title, meta, recipientUserId }: { title: string; meta: string; image: string; recipientUserId: string }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
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

  return <>
    <div className="mt-3 flex items-center justify-between border-t border-[#e8eef5] pt-2 text-[11px] text-[#667085]"><span>{comments?.length ?? counts.comments} bình luận</span><span>{counts.expertQuestions} câu hỏi</span></div>
    <div className="mt-1 grid grid-cols-2 border-t border-[#edf1f5] pt-1">
      <button type="button" onClick={() => void toggle()} aria-label="Bình luận" title="Bình luận" className={`grid place-items-center rounded-lg py-2.5 hover:bg-[#f2f4f7] ${open ? "text-[#168ac0]" : "text-[#475467]"}`}><MessageCircle size={19}/></button>
      <RequestActionButton requestType="expert-question" targetType="house-model" targetId={title} label="Tư vấn" title={"Tư vấn: " + title} description={"Mẫu tham khảo: " + meta + ". Hãy nhập câu hỏi bạn muốn chuyên gia giải đáp."} allowFile iconOnly="expert" recipientUserId={recipientUserId} onSuccess={() => void refreshCounts()} className="grid place-items-center rounded-lg py-2.5 text-[#475467] hover:bg-[#f2f4f7]"/>
    </div>
    {open && <div className="space-y-2 border-t border-[#edf0f3] bg-[#fbfcfd] p-3">
      {comments?.map((comment) => <div key={comment.id} className="rounded-2xl bg-[#eef1f4] px-3 py-2"><b className="block text-xs text-[#182230]">{comment.authorName}</b><p className="mt-0.5 text-sm leading-5 text-[#344054]">{comment.content}</p></div>)}
      {comments === null && <p className="py-1 text-center text-xs text-[#667085]">Đang tải bình luận...</p>}
      {comments?.length === 0 && <p className="py-1 text-center text-xs text-[#667085]">Chưa có bình luận.</p>}
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      <div className="flex items-center gap-2"><img src="/avatars/user-nguyen-van-a.png" alt="" className="size-8 rounded-full object-cover"/><div className="flex flex-1 items-center rounded-full bg-[#eef1f4] pl-3 pr-1"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} maxLength={600} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Viết bình luận..."/><button type="button" onClick={() => void send()} disabled={busy || !draft.trim()} className="grid size-8 place-items-center text-[#229ed9] disabled:text-[#bcc0c4]" aria-label="Gửi bình luận"><Send size={16}/></button></div></div>
    </div>}
  </>;
}
