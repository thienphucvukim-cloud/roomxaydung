"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Mail, Send, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authActionTarget } from "@/lib/action-auth-return";
import { postHref } from "@/lib/post-url";

export function ShareActionButton({ title, url, iconOnly = false, className = "", targetType, targetId, onShared }: {
  title: string;
  url?: string;
  iconOnly?: boolean;
  className?: string;
  targetType?: string;
  targetId?: string;
  onShared?: (created: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef(false);
  const sessionRef = useRef(0);
  const recordedRef = useRef(false);
  const linkId = useId();
  useEffect(() => () => { sessionRef.current += 1; }, []);

  const changeOpen = (next: boolean) => {
    sessionRef.current += 1;
    setOpen(next);
    setBusy(false);
    operationRef.current = false;
  };

  const openShare = () => {
    // Cards already know their public permalink. Do not put a network request
    // between a user gesture and the clipboard or native share APIs.
    const postId = targetType === "post" && targetId && /^[1-9]\d*$/.test(targetId) && Number.isSafeInteger(Number(targetId)) ? Number(targetId) : null;
    const path = url ?? (postId ? postHref({ id: postId }) : window.location.href);
    const resolved = new URL(path, window.location.origin);
    if (!/^https?:$/.test(resolved.protocol)) return;
    const data = { title, url: resolved.href };
    setLink(resolved.href);
    setCanShare(typeof navigator.share === "function" && (typeof navigator.canShare !== "function" || navigator.canShare(data)));
    setCopied(false);
    setMessage("");
    recordedRef.current = false;
    changeOpen(true);
  };

  const recordShare = async () => {
    if (!targetType || !targetId || recordedRef.current) return;
    recordedRef.current = true;
    try {
      const response = await fetch("/api/actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "share", targetType, targetId }),
      });
      if (response.ok) {
        const result = await response.json() as { created?: boolean };
        onShared?.(Boolean(result.created));
      }
    } catch { /* Sharing remains usable when activity recording is unavailable. */ }
  };

  const copyLink = async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    const session = sessionRef.current;
    setBusy(true);
    setCopied(false);
    setMessage("");
    try {
      await navigator.clipboard.writeText(link);
      if (session !== sessionRef.current) return;
      setCopied(true);
      void recordShare();
    } catch {
      if (session !== sessionRef.current) return;
      inputRef.current?.focus();
      inputRef.current?.select();
      setMessage("Không thể sao chép tự động. Liên kết đã được chọn; hãy nhấn giữ hoặc dùng Ctrl+C / ⌘C để sao chép.");
    } finally {
      if (session === sessionRef.current) {
        operationRef.current = false;
        setBusy(false);
      }
    }
  };

  const shareOnDevice = async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    const session = sessionRef.current;
    setBusy(true);
    setMessage("");
    try {
      // Called directly from this button click to retain transient activation.
      await navigator.share({ title, url: link });
      if (session !== sessionRef.current) return;
      void recordShare();
      changeOpen(false);
    } catch (error) {
      if (session !== sessionRef.current) return;
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage("Chưa thể mở ứng dụng chia sẻ. Bạn có thể chọn cách khác hoặc sao chép liên kết bên dưới.");
      }
    } finally {
      if (session === sessionRef.current) {
        operationRef.current = false;
        setBusy(false);
      }
    }
  };

  const optionClass = "flex min-h-12 flex-col items-center justify-center gap-2 rounded-xl border border-[#d0d5dd] px-2 py-3 text-xs font-semibold text-[#344054] transition hover:border-[#229ed9] hover:bg-[#f1faff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168ac0] sm:flex-row sm:text-sm";
  return <>
    <button ref={triggerRef} type="button" data-requires-account {...authActionTarget(targetType, targetId)} onClick={openShare} className={className} aria-label="Chia sẻ" title="Chia sẻ" aria-haspopup="dialog" aria-expanded={open}>
      <Share2 size={17} aria-hidden="true"/>
      <span className={iconOnly ? "sr-only" : undefined}>Chia sẻ</span>
    </button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white sm:max-w-md" onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }}>
        <DialogHeader className="pr-6">
          <DialogTitle>Chia sẻ bài viết</DialogTitle>
          <DialogDescription className="break-words leading-6">{title}</DialogDescription>
        </DialogHeader>
        {canShare && <button type="button" onClick={() => void shareOnDevice()} disabled={busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#229ed9] px-4 py-3 text-sm font-bold text-white hover:bg-[#168ac0] disabled:opacity-50"><Share2 size={19} aria-hidden="true"/>Chia sẻ qua ứng dụng</button>}
        <div className={`grid grid-cols-3 gap-2 ${busy ? "pointer-events-none opacity-50" : ""}`} inert={busy}>
          <a className={optionClass} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer"><span aria-hidden="true" className="text-lg font-extrabold leading-none text-[#1877f2]">f</span>Facebook</a>
          <a className={optionClass} href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer"><Send size={18} aria-hidden="true"/>Telegram</a>
          <a className={optionClass} href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(title + "\n\n" + link)}`}><Mail size={18} aria-hidden="true"/>Email</a>
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold text-[#475467]" htmlFor={linkId}>Liên kết chia sẻ</label>
          <input id={linkId} ref={inputRef} aria-label="Liên kết chia sẻ" readOnly value={link} onFocus={event => event.currentTarget.select()} className="w-full rounded-xl border border-[#d0d5dd] bg-[#f9fafb] px-3 py-3 text-sm text-[#344054] outline-none focus:border-[#229ed9]"/>
          <button type="button" onClick={() => void copyLink()} disabled={busy} className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${copied ? "bg-[#ecfdf3] text-[#027a48]" : "bg-[#eef8fc] text-[#168ac0] hover:bg-[#e2f5fc]"}`}>
            {copied ? <Check size={18} aria-hidden="true"/> : <Copy size={18} aria-hidden="true"/>}{copied ? "Đã sao chép liên kết" : "Sao chép liên kết"}
          </button>
        </div>
        <p role="status" aria-live="polite" className="text-xs leading-5 text-[#667085]">{message || (copied ? "Bạn có thể dán liên kết vào tin nhắn hoặc bài đăng để chia sẻ." : "Chọn nơi chia sẻ hoặc sao chép liên kết gửi cho bạn bè.")}</p>
      </DialogContent>
    </Dialog>
  </>;
}
