"use client";

import { useState } from "react";
import { Check, Download, MessageCircle, RefreshCw } from "lucide-react";
import { RequestActionButton } from "@/components/interactive-actions";

export type InboxMessage = { id: number; senderUserId: string; senderName: string; subject: string; content: string; attachmentKey?: string | null; readAt?: string | null; createdAt: string };

function messageContent(content: string) {
  return content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => /^https?:\/\//.test(part)
    ? <a key={index} href={part} target="_blank" rel="noreferrer" className="break-all font-bold text-[#168ac0] underline">{part.includes("/api/downloads/drawing?") ? "Tải file bản vẽ" : part}</a>
    : <span key={index}>{part}</span>);
}

export function InboxPanel({ messages, onChange }: { messages: InboxMessage[]; onChange: (messages: InboxMessage[]) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/messages", { cache: "no-store" });
      const data = await response.json() as { messages?: InboxMessage[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể tải tin nhắn.");
      onChange(data.messages || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải tin nhắn."); }
    finally { setBusy(false); }
  };
  const markRead = async (id: number) => {
    try {
      const response = await fetch("/api/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error("Không thể đánh dấu tin nhắn đã đọc.");
      onChange(messages.map(message => message.id === id ? { ...message, readAt: new Date().toISOString() } : message));
      window.dispatchEvent(new Event("tipook-messages-changed"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật tin nhắn."); }
  };
  return <section id="tin-nhan" className="mt-5 scroll-mt-24 rounded-2xl border border-[#e3eaf2] bg-white p-5">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><MessageCircle size={20}/>Tin nhắn web nội bộ</h2><button type="button" onClick={() => void refresh()} disabled={busy} className="rounded-lg p-2 text-[#168ac0] hover:bg-sky-50" aria-label="Tải lại tin nhắn"><RefreshCw size={18} className={busy ? "animate-spin" : ""}/></button></div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    <div className="mt-4 space-y-3">{messages.map(message => <article key={message.id} className={`rounded-xl px-4 py-3 ${message.readAt ? "bg-[#f6f8fb]" : "border border-sky-100 bg-sky-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm text-[#182230]">{message.senderName}</b><time className="text-xs text-[#98a2b3]">{new Date(message.createdAt).toLocaleString("vi-VN")}</time></div>
      <p className="mt-1 text-sm font-semibold text-[#0b2e59]">{message.subject}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-[#667085]">{messageContent(message.content)}</p>
      {message.attachmentKey && <a href={`/api/files?key=${encodeURIComponent(message.attachmentKey)}&download=1`} className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#168ac0]"><Download size={16}/>Tải tệp đính kèm</a>}
      <div className="mt-3 flex flex-wrap gap-3">{!message.readAt && <button type="button" onClick={() => void markRead(message.id)} className="inline-flex items-center gap-1 text-xs font-bold text-[#168ac0]"><Check size={15}/>Đánh dấu đã đọc</button>}{!message.senderUserId.startsWith("tipook-") && <RequestActionButton requestType="direct-message" targetType="profile" targetId={message.senderUserId} recipientUserId={message.senderUserId} label="Trả lời" title={`Trả lời: ${message.subject}`} allowFile className="text-xs font-bold text-[#168ac0]"/>}</div>
    </article>)}{!messages.length && <p className="py-8 text-center text-sm text-[#667085]">Chưa có tin nhắn gửi trực tiếp đến bạn.</p>}</div>
  </section>;
}
