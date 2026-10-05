"use client";

import { SITE_EVENTS } from "@/lib/site-events";
import { useEffect, useId, useRef, useState } from "react";
import { Bookmark, Check, CircleHelp, FileDown, Heart, LoaderCircle, MessageCircle, Send, Share2, Star, Upload, UserPlus, UserRound, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { optimizeImageForUpload } from "@/lib/image-upload";
import { authActionTarget } from "@/lib/action-auth-return";
import { ChatThread } from "@/components/chat-thread";
import { AutoResizeTextarea } from "@/components/auto-resize-textarea";

type IconName = "heart" | "bookmark" | "star" | "follow" | "check";
const iconMap = { heart: Heart, bookmark: Bookmark, star: Star, follow: UserPlus, check: Check };
const actionChangedEvent = SITE_EVENTS.actionChanged;
type ActionChange = { actionType: string; targetType: string; targetId: string; active: boolean; count?: number };

function ExpertIcon() {
  return <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M3.5 24v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" fill="#0c4a6e"/>
    <path d="m8.5 16 3 7 3-7" fill="#f0f9ff"/>
    <path d="m10.5 18 1 1 1-1-1-1Zm1 1-1 3 1 1 1-1Z" fill="#38bdf8"/>
    <path d="M7 9.5v2a4.5 4.5 0 0 0 9 0v-2" fill="#ffdfbf" stroke="#0c4a6e" strokeWidth="1.35" strokeLinecap="round"/>
    <path d="M6.5 8.5a5 5 0 0 1 10 0v1h-10Z" fill="#fbbf24" stroke="#b45309" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M10 7V3.5h3V7" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.5 9.5h12" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M20 12h3a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2l-3 2v-3a3 3 0 0 1-1-2v-2a3 3 0 0 1 3-3Z" fill="#0284c7" stroke="#f0f9ff" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="m19.8 16.2 1.2 1.2 2.3-2.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

export function ToggleActionButton({
  actionType,
  targetType,
  targetId,
  label,
  activeLabel,
  icon = "bookmark",
  className = "",
  showCount = false,
  showLabelWithCount = false,
}: {
  actionType: string;
  targetType: string;
  targetId: string;
  label: string;
  activeLabel?: string;
  icon?: IconName;
  className?: string;
  showCount?: boolean;
  showLabelWithCount?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionCount, setActionCount] = useState<number | null>(null);
  const Icon = iconMap[icon];

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ actionType, targetType, targetId });
    if (showCount) query.set("withCount", "true");
    fetch("/api/actions?" + query, { signal: controller.signal, cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ actions?: unknown[]; count?: number }> : Promise.reject()).then((data) => {
      if (controller.signal.aborted) return;
      setActive(Boolean(data.actions?.length));
      if (showCount) setActionCount(data.count ?? null);
    }).catch(() => {});
    const update = (event: Event) => {
      const change = (event as CustomEvent<ActionChange>).detail;
      if (change.actionType !== actionType || change.targetType !== targetType || change.targetId !== targetId) return;
      controller.abort();
      setActive(change.active);
      if (typeof change.count === "number") setActionCount(change.count);
    };
    window.addEventListener(actionChangedEvent, update);
    return () => { controller.abort(); window.removeEventListener(actionChangedEvent, update); };
  }, [actionType, targetType, targetId, showCount]);

  const toggle = async () => {
    if (busy) return;
    const next = !active;
    setActive(next);
    setBusy(true);
    try {
      const response = await fetch("/api/actions", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType, targetType, targetId }),
      });
      if (!response.ok) throw new Error();
      window.dispatchEvent(new CustomEvent<ActionChange>(actionChangedEvent, { detail: { actionType, targetType, targetId, active: next } }));
      if (showCount) {
        const query = new URLSearchParams({ actionType, targetType, targetId, withCount: "true" });
        try {
          const countsResponse = await fetch("/api/actions?" + query);
          if (countsResponse.ok) {
            const data = await countsResponse.json() as { count: number };
            setActionCount(data.count);
            window.dispatchEvent(new CustomEvent<ActionChange>(actionChangedEvent, { detail: { actionType, targetType, targetId, active: next, count: data.count } }));
          }
        } catch { /* The action was saved even if its count cannot be refreshed. */ }
      }
    } catch {
      setActive(!next);
    } finally {
      setBusy(false);
    }
  };

  const actionLabel = active ? activeLabel ?? label : label;
  const countLabel = actionCount === null ? "—" : actionCount.toLocaleString("vi-VN");
  const visibleLabel = showCount ? showLabelWithCount ? `${actionLabel} (${countLabel})` : countLabel : active ? activeLabel ?? "Đã lưu" : label;
  return <button type="button" data-requires-account {...authActionTarget(targetType, targetId)} onClick={toggle} disabled={busy} className={className} aria-pressed={active} aria-label={showCount ? `${actionLabel} (${countLabel})` : undefined} title={showCount ? actionLabel : undefined}>
    {busy ? <LoaderCircle size={17} className="animate-spin"/> : <Icon size={17} className={active ? (icon === "heart" ? "fill-red-500 text-red-500" : "fill-current") : ""}/>}
    <span className={showCount ? "tabular-nums" : undefined}>{visibleLabel}</span>
  </button>;
}

export function ShareActionButton({ title, url, iconOnly = false, className = "", targetType, targetId, onShared }: { title: string; url?: string; iconOnly?: boolean; className?: string; targetType?: string; targetId?: string; onShared?: (created: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualLink, setManualLink] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);
  const share = async () => {
    if (busy) return;
    const link = new URL(url ?? window.location.href, window.location.origin).href;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setManualLink(link);
      setBusy(false);
      return;
    }
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 1800);
    setBusy(false);
    try {
      if (targetType && targetId) {
        const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionType: "share", targetType, targetId }) });
        const result = await response.json() as { created?: boolean };
        if (response.ok) onShared?.(Boolean(result.created));
      }
    } catch { /* The link was copied even if recording the share fails. */ }
  };
  const label = copied ? "Đã sao chép liên kết" : "Sao chép liên kết chia sẻ";
  return <>
    <button type="button" data-requires-account {...authActionTarget(targetType, targetId)} onClick={() => void share()} disabled={busy} className={className} aria-label={label} title={label}>
      {copied ? <Check size={17} aria-hidden="true"/> : <Share2 size={17} aria-hidden="true"/>}
      <span className={iconOnly ? "sr-only" : undefined} aria-live="polite">{copied ? "Đã sao chép" : "Chia sẻ"}</span>
    </button>
    <Dialog open={Boolean(manualLink)} onOpenChange={(open) => { if (!open) setManualLink(""); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Chia sẻ: {title}</DialogTitle></DialogHeader>
        <p className="text-sm text-[#667085]">Không thể sao chép tự động. Bạn có thể sao chép liên kết bên dưới để chia sẻ.</p>
        <input aria-label="Liên kết chia sẻ" readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} className="w-full rounded-lg border border-[#d0d5dd] px-3 py-2 text-sm"/>
      </DialogContent>
    </Dialog>
  </>;
}

export function RequestActionButton({
  requestType,
  targetType,
  targetId,
  label,
  title,
  description,
  className = "",
  allowFile = false,
  iconOnly,
  iconCount,
  onSuccess,
  recipientUserId,
  defaultOpen = false,
}: {
  requestType: string;
  targetType: string;
  targetId: string;
  label: string;
  title: string;
  description?: string;
  className?: string;
  allowFile?: boolean;
  iconOnly?: "comment" | "expert" | "file" | "help" | "admin";
  iconCount?: number;
  onSuccess?: () => void;
  recipientUserId?: string;
  defaultOpen?: boolean;
}) {
  const fieldId = useId();
  const internalOnly = requestType === "expert-question";
  const fileRequest = requestType === "drawing-file-request";
  const adminHelp = requestType === "admin-help";
  const [open, setOpen] = useState(defaultOpen);
  const [subject, setSubject] = useState(title);
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [attachmentKey, setAttachmentKey] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");


  const upload = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("Tệp đính kèm không được vượt quá 25 MB.");
      const form = new FormData();
      form.append("file", await optimizeImageForUpload(file));
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = await response.json() as { error?: string; attachment?: { key: string; name: string; type?: string; url?: string } };
      if (!response.ok || !data.attachment) throw new Error(data.error || "Không thể tải tệp.");
      setAttachmentKey(data.attachment.key);
      setAttachmentName(data.attachment.name);
      setAttachmentPreview(data.attachment.type?.startsWith("image/") ? data.attachment.url || "" : "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải tệp.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    if (!content.trim() && !(adminHelp && attachmentKey)) { setMessage("Vui lòng nhập nội dung."); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType, targetType, targetId, subject, content, contact, attachmentKey, recipientUserId, channels: fileRequest || adminHelp ? ["internal", "telegram"] : ["internal"] }),
      });
      const data = await response.json() as { error?: string; delivery?: Record<string, { status: string }> };
      if (!response.ok) throw new Error(data.error || "Chưa thể gửi yêu cầu.");
      const sent = Object.entries(data.delivery ?? {}).filter(([, result]) => result.status === "sent").map(([channel]) => channel === "internal" ? "Web nội bộ" : channel === "zalo" ? "Zalo" : channel === "messenger" ? "Messenger" : "Telegram");
      const pending = Object.entries(data.delivery ?? {}).filter(([, result]) => result.status !== "sent").map(([channel]) => channel === "zalo" ? "Zalo" : channel === "messenger" ? "Messenger" : "Telegram");
      setMessage(adminHelp ? (data.delivery?.telegram?.status === "sent" ? "Đã gửi tin nhắn cho admin. Chúng tôi sẽ liên hệ với bạn." : "Đã lưu tin nhắn vào hộp thư admin. Telegram chưa gửi được.") : fileRequest ? (data.delivery?.telegram?.status === "sent" ? "Đã gửi yêu cầu. Chúng tôi sẽ liên hệ với bạn." : "Đã lưu yêu cầu. Thông báo Telegram chưa gửi được, chúng tôi sẽ kiểm tra và liên hệ với bạn.") : internalOnly ? "Đã gửi tin nhắn đến hộp thư nội bộ của tác giả." : `Đã gửi: ${sent.join(", ") || "chưa có kênh"}.${pending.length ? ` Chưa cấu hình: ${pending.join(", ")}.` : ""}`);
      setContent("");
      setContact("");
      setAttachmentKey("");
      setAttachmentName("");
      setAttachmentPreview("");
      onSuccess?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa thể gửi yêu cầu.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button type="button" data-requires-account {...authActionTarget(targetType, targetId)} onClick={() => setOpen(true)} className={`group/request relative ${className}`} aria-label={iconOnly && iconCount !== undefined ? `${label} (${iconCount})` : label} title={iconOnly ? undefined : label}>{iconOnly === "comment" ? <MessageCircle size={19}/> : iconOnly === "expert" ? <ExpertIcon/> : iconOnly === "file" ? <FileDown size={19}/> : iconOnly === "help" ? <CircleHelp size={20}/> : iconOnly === "admin" ? <span aria-hidden="true" className="flex flex-col items-center gap-0.5"><UserRound size={20} strokeWidth={1.9}/><span className="text-[9px] font-semibold leading-none">admin</span></span> : label}{iconOnly && iconCount !== undefined && <span className="text-[11px] leading-4 tabular-nums">{iconCount}</span>}{iconOnly && <span role="tooltip" className={`pointer-events-none absolute z-30 hidden whitespace-nowrap rounded-md bg-[#182230] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover/request:block group-focus-visible/request:block ${iconOnly === "help" || iconOnly === "admin" ? "right-0 top-full mt-2 group-focus/request:block group-active/request:block" : `bottom-full mb-2 ${iconOnly === "expert" ? "right-0" : "left-1/2 -translate-x-1/2"}`}`}>{label}</span>}</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[520px] gap-0 overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl">
        <DialogHeader className="relative border-b border-[#e4e6eb] px-14 py-5 text-center sm:text-center">
          <DialogTitle className="text-xl font-bold text-[#050505]">{title}</DialogTitle>
          <DialogClose aria-label="Đóng cuộc trò chuyện" className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]"><X size={21}/></DialogClose>
        </DialogHeader>
        {internalOnly || requestType === "direct-message" ? (open && <ChatThread key={`${targetType}:${targetId}`} peerId={recipientUserId} targetType={targetType} targetId={targetId} subject={title} description={description} onSent={onSuccess} allowFile={allowFile}/>) : <div className="space-y-4 p-4">
          {(fileRequest || description) && <p className="text-sm leading-6 text-[#536273]">{fileRequest ? "Chúng tôi sẽ nhận yêu cầu và liên hệ với bạn để cung cấp file." : description}</p>}
          <label className="block text-sm font-semibold text-[#182230]" htmlFor={fieldId + "-subject"}>Tiêu đề</label>
          <input id={fieldId + "-subject"} value={subject} onChange={(event) => setSubject(event.target.value)} className="h-11 w-full rounded-xl border border-[#d0d5dd] px-3 text-sm outline-none focus:border-[#229ed9]"/>
          <label className="block text-sm font-semibold text-[#182230]" htmlFor={fieldId + "-content"}>Nội dung chi tiết</label>
          <AutoResizeTextarea id={fieldId + "-content"} value={content} onChange={(event) => setContent(event.target.value)} className="min-h-32 w-full rounded-xl border border-[#d0d5dd] p-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Mô tả nhu cầu, kinh nghiệm hoặc thông tin cần trao đổi..." maxLength={2000}/>
          {allowFile && <div className="space-y-2"><label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#98a2b3] bg-[#f8fafc] p-3 text-sm font-semibold text-[#344054] hover:border-[#229ed9] ${busy ? "pointer-events-none opacity-50" : ""}`}><Upload size={19}/><span className="min-w-0 flex-1 truncate">{attachmentName || "Đính kèm file hoặc ảnh"}</span><input type="file" disabled={busy} className="sr-only" aria-label="Đính kèm file hoặc ảnh" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }}/></label><p className="text-xs text-[#667085]">Một tệp tối đa 25 MB. Ảnh được tối ưu trước khi gửi.</p>{attachmentKey && <div className="flex items-start gap-3 rounded-xl border border-[#e3eaf2] p-3">{attachmentPreview && <img src={attachmentPreview} alt="Ảnh đính kèm" className="size-16 rounded-lg object-cover"/>}<span className="min-w-0 flex-1 break-words text-sm text-[#344054]">{attachmentName}</span><button type="button" disabled={busy} onClick={() => { setAttachmentKey(""); setAttachmentName(""); setAttachmentPreview(""); }} aria-label="Bỏ tệp đính kèm" className="grid size-7 shrink-0 place-items-center rounded-full text-[#667085] hover:bg-[#eef3f7] disabled:opacity-50"><X size={16}/></button></div>}</div>}
          <label className="block text-sm font-semibold text-[#182230]" htmlFor={fieldId + "-contact"}>Thông tin liên hệ</label>
          <input id={fieldId + "-contact"} value={contact} onChange={(event) => setContact(event.target.value)} className="h-11 w-full rounded-xl border border-[#d0d5dd] px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Email hoặc số điện thoại"/>
          {message && <p role="status" aria-live="polite" className={"rounded-lg px-3 py-2 text-sm " + (message.startsWith("Đã gửi") ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-[#147aa8]")}>{message}</p>}
          <Button type="button" onClick={submit} disabled={busy || (!content.trim() && !(adminHelp && attachmentKey))} className="h-11 w-full rounded-xl bg-[#229ed9] font-bold hover:bg-[#168ac0]">{busy ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={17}/>}Gửi yêu cầu</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}

export function DetailActionButton({ label, title, children, className = "" }: { label: string; title: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className={className}>{label}</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white">
        <DialogHeader><DialogTitle className="pr-10 text-xl font-bold text-[#0b2e59]">{title}</DialogTitle></DialogHeader>
        <div className="text-sm leading-7 text-[#3f5064]">{children}</div>
      </DialogContent>
    </Dialog>
  </>;
}

export function FilterChips({ scope, items }: { scope: string; items: { label: string; value: string }[] }) {
  const [active, setActive] = useState(items[0]?.value ?? "all");
  const apply = (value: string) => {
    setActive(value);
    document.querySelectorAll<HTMLElement>('[data-filter-scope="' + scope + '"]').forEach((element) => {
      const tags = (element.dataset.filterTags || "").split("|");
      element.hidden = value !== "all" && !tags.includes(value);
    });
  };
  return <div className="flex flex-wrap gap-2">{items.map((item) => <button type="button" key={item.value} onClick={() => apply(item.value)} className={"rounded-full px-4 py-2 text-sm font-bold transition " + (active === item.value ? "bg-[#229ed9] text-white" : "border border-[#e3eaf2] bg-white text-[#3f5064] hover:border-[#229ed9]")}>{item.label}</button>)}</div>;
}

export function CatalogPublishButton({ className = "" }: { className?: string }) {
  return <button type="button" onClick={() => document.getElementById("catalog-publish")?.click()} className={className}>Bắt đầu đăng bán</button>;
}
