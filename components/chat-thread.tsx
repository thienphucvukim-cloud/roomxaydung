"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, Paperclip, Send, X } from "lucide-react";
import { optimizeImageForUpload } from "@/lib/image-upload";

export type ChatMessage = { id: number; senderUserId: string; senderName: string; recipientUserId: string; subject: string; content: string; attachmentKey?: string | null; readAt?: string | null; createdAt: string };
type ThreadData = { messages?: ChatMessage[]; currentUserId?: string; peerId?: string; peerName?: string; hasMore?: boolean; error?: string };

export function ChatThread({ peerId, targetType, targetId, subject = "Tin nhắn", description, onSent, allowFile = true, active = true }: { peerId?: string; targetType?: string; targetId?: string; subject?: string; description?: string; onSent?: () => void; allowFile?: boolean; active?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [identity, setIdentity] = useState({ userId: "", peerId: "", name: "" });
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<{ key: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const initialLoaded = useRef(false);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);
  const query = new URLSearchParams({ ...(peerId ? { peerId } : {}), ...(targetType ? { targetType, targetId: targetId || "" } : {}) }).toString();

  const load = useCallback(async (signal?: AbortSignal, before?: number) => {
    const response = await fetch(`/api/messages?${query}${before ? `&before=${before}` : ""}`, { cache: "no-store", signal });
    const data = await response.json() as ThreadData;
    if (!response.ok || !data.currentUserId || !data.peerId) throw new Error(data.error || "Vui lòng đăng nhập để trò chuyện.");
    setIdentity({ userId: data.currentUserId, peerId: data.peerId, name: data.peerName || "Tác giả" });
    const incoming = data.messages || [];
    setMessages(previous => [...new Map([...previous, ...incoming].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id));
    if (before || !initialLoaded.current) setHasMore(Boolean(data.hasMore));
    initialLoaded.current = true;
    const unread = incoming.filter(message => message.recipientUserId === data.currentUserId && !message.readAt).map(message => message.id);
    if (unread.length && activeRef.current && document.visibilityState === "visible") {
      const read = await fetch("/api/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: unread }), signal });
      if (read.ok) {
        setMessages(previous => previous.map(message => unread.includes(message.id) ? { ...message, readAt: new Date().toISOString() } : message));
        window.dispatchEvent(new Event("tipook-messages-changed"));
      }
    }
  }, [query]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try { await load(controller.signal); setError(""); }
      catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải hội thoại."); }
      finally { inFlight = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load, active]);

  useEffect(() => {
    if (stickToBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (sending || uploading || !content.trim() || !identity.peerId) return;
    setSending(true); setError("");
    try {
      const expert = Boolean(targetType && targetType !== "profile");
      const response = await fetch(expert ? "/api/requests" : "/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expert ? { requestType: "expert-question", targetType, targetId, recipientUserId: identity.peerId, subject, content, attachmentKey: attachment?.key, channels: ["internal"] } : { peerId: identity.peerId, content, attachmentKey: attachment?.key }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể gửi tin nhắn.");
      setContent(""); setAttachment(null); stickToBottom.current = true;
      window.dispatchEvent(new Event("tipook-messages-changed"));
      onSent?.();
      try { await load(); } catch { setError("Đã gửi tin nhắn. Đang chờ tải lại hội thoại."); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể gửi tin nhắn."); }
    finally { setSending(false); }
  };

  const upload = async (file?: File) => {
    if (!file || uploading || sending) return;
    setUploading(true); setError("");
    try {
      const form = new FormData(); form.append("file", await optimizeImageForUpload(file));
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = await response.json() as { attachment?: { key: string; name: string }; error?: string };
      if (!response.ok || !data.attachment) throw new Error(data.error || "Không thể tải tệp.");
      setAttachment(data.attachment);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải tệp."); }
    finally { setUploading(false); }
  };

  const older = async () => {
    if (loadingOlder || !messages.length) return;
    setLoadingOlder(true); stickToBottom.current = false;
    const element = scroll.current;
    const height = element?.scrollHeight || 0;
    try {
      await load(undefined, messages[0].id);
      requestAnimationFrame(() => { if (element) element.scrollTop += element.scrollHeight - height; });
    } catch { setError("Không thể tải tin nhắn cũ."); }
    finally { setLoadingOlder(false); }
  };

  const readOnly = Boolean(identity.peerId) && (identity.peerId.startsWith("tipook-") || identity.peerId === identity.userId);
  return <div className="flex min-h-0 flex-col">
    <div className="border-b border-[#e3eaf2] px-4 py-3"><p className="font-bold text-[#0b2e59]">{identity.name || "Đang mở cuộc trò chuyện…"}</p>{description && <p className="mt-1 text-xs leading-5 text-[#667085]">{description}</p>}</div>
    <div ref={scroll} onScroll={() => { const element = scroll.current; if (element) stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }} className="h-[min(48vh,420px)] min-h-48 space-y-3 overflow-y-auto bg-[#f4f7fb] p-4" role="log" aria-label="Lịch sử trò chuyện">
      {hasMore && <button type="button" onClick={() => void older()} disabled={loadingOlder} className="mx-auto block text-xs font-semibold text-[#168ac0]">{loadingOlder ? "Đang tải…" : "Xem tin nhắn cũ"}</button>}
      {loading && <p className="text-center text-sm text-[#667085]">Đang tải tin nhắn…</p>}
      {!loading && !messages.length && <p className="py-12 text-center text-sm text-[#667085]">Gửi tin nhắn đầu tiên để bắt đầu trò chuyện.</p>}
      {messages.map(message => {
        const own = message.senderUserId === identity.userId;
        return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${own ? "rounded-br-sm bg-[#229ed9] text-white" : "rounded-bl-sm bg-white text-[#344054]"}`}>
          {message.subject !== "Tin nhắn" && <p className={`mb-1 text-xs font-semibold ${own ? "text-white/80" : "text-[#168ac0]"}`}>{message.subject}</p>}
          <p className="whitespace-pre-wrap break-words leading-6">{message.content.split(/(https?:\/\/[^\s]+)/g).map((part, index) => /^https?:\/\//.test(part) ? <a key={index} href={part} target="_blank" rel="noreferrer" className="break-all underline">{part}</a> : part)}</p>
          {message.attachmentKey && <a href={`/api/files?key=${encodeURIComponent(message.attachmentKey)}&download=1`} className="mt-2 inline-flex items-center gap-1 underline"><Download size={14}/>Tệp đính kèm</a>}
          <p className={`mt-1 text-right text-[10px] ${own ? "text-white/75" : "text-[#98a2b3]"}`}>{new Date(message.createdAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}{own ? message.readAt ? " · Đã đọc" : " · Đã gửi" : ""}</p>
        </div></div>;
      })}
    </div>
    {error && <p role="alert" className="px-4 py-2 text-sm text-rose-700">{error}</p>}
    {attachment && <p className="flex items-center gap-2 px-4 py-2 text-xs text-[#168ac0]"><Paperclip size={14}/><span className="truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} disabled={sending} aria-label="Bỏ tệp đính kèm"><X size={14}/></button></p>}
    {readOnly ? <p className="p-4 text-sm text-[#667085]">Thông báo hệ thống không nhận trả lời.</p> : <form data-requires-account onSubmit={event => { event.preventDefault(); void send(); }} className="flex items-end gap-2 border-t border-[#e3eaf2] bg-white p-3">
      {allowFile && <label className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-[#168ac0] hover:bg-sky-50">{uploading ? <LoaderCircle size={19} className="animate-spin"/> : <Paperclip size={19}/>}<input type="file" aria-label="Đính kèm tệp" className="sr-only" disabled={sending || uploading || loading} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }}/></label>}
      <textarea aria-label="Tin nhắn" placeholder="Nhập tin nhắn…" value={content} disabled={sending} onChange={event => setContent(event.target.value)} maxLength={2000} rows={2} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} className="min-w-0 flex-1 resize-none rounded-xl border border-[#d0d5dd] px-3 py-2 text-sm outline-none focus:border-[#229ed9]"/>
      <button type="submit" disabled={sending || uploading || loading || !content.trim() || !identity.peerId} aria-label="Gửi tin nhắn" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#229ed9] text-white disabled:opacity-50">{sending ? <LoaderCircle size={19} className="animate-spin"/> : <Send size={19}/>}</button>
    </form>}
  </div>;
}
