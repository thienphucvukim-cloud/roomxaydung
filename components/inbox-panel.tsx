"use client";

import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { ChatThread, type ChatMessage } from "@/components/chat-thread";

type Conversation = { peerId: string; name: string; unread: number; lastMessage?: ChatMessage };

export function InboxPanel({ active = true }: { active?: boolean } = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch("/api/messages?mode=conversations", { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { conversations?: Conversation[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Không thể tải hội thoại.");
        setConversations(data.conversations || []); setError("");
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải hội thoại."); }
      finally { inFlight = false; if (!controller.signal.aborted) setBusy(false); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("tipook-messages-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("tipook-messages-changed", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [refreshKey, active]);
  return <section id="tin-nhan" className="mt-5 scroll-mt-24 overflow-hidden rounded-2xl border border-[#e3eaf2] bg-white">
    <div className="flex items-center justify-between gap-3 border-b border-[#e3eaf2] p-4"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><MessageCircle size={20}/>Tin nhắn</h2><button type="button" onClick={() => { setBusy(true); setRefreshKey(value => value + 1); }} disabled={busy} className="rounded-lg p-2 text-[#168ac0] hover:bg-sky-50" aria-label="Tải lại hội thoại"><RefreshCw size={18} className={busy ? "animate-spin" : ""}/></button></div>
    {error && <p role="alert" className="p-3 text-sm text-rose-700">{error}</p>}
    <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="max-h-[520px] overflow-y-auto border-b border-[#e3eaf2] md:border-b-0 md:border-r">{conversations.map(conversation => <button key={conversation.peerId} type="button" onClick={() => setSelected(conversation.peerId)} aria-pressed={selected === conversation.peerId} className={`block w-full border-b border-[#eef1f4] px-4 py-3 text-left ${selected === conversation.peerId ? "bg-sky-50" : "hover:bg-[#f6f8fb]"}`}>
        <span className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-[#0b2e59]">{conversation.name === "Thành viên" && conversation.lastMessage?.senderUserId === conversation.peerId ? conversation.lastMessage.senderName : conversation.name}</strong>{conversation.unread > 0 && <span className="rounded-full bg-[#229ed9] px-2 py-0.5 text-xs text-white">{conversation.unread}</span>}</span>
        <span className="mt-1 block truncate text-xs text-[#667085]">{conversation.lastMessage?.content}</span>
      </button>)}{!conversations.length && <p className="p-6 text-center text-sm text-[#667085]">{busy ? "Đang tải…" : "Chưa có cuộc trò chuyện."}</p>}</div>
      <div className="min-w-0">{selected ? <ChatThread key={selected} peerId={selected} active={active}/> : <p className="p-12 text-center text-sm text-[#667085]">Chọn một cuộc trò chuyện để xem và trả lời.</p>}</div>
    </div>
  </section>;
}
