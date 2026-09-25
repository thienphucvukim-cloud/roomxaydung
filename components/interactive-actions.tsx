"use client";

import { useEffect, useId, useState } from "react";
import { Bookmark, Check, CircleHelp, FileDown, Heart, LoaderCircle, MessageCircle, Send, Share2, Star, Upload, UserPlus, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type IconName = "heart" | "bookmark" | "star" | "follow" | "check";
const iconMap = { heart: Heart, bookmark: Bookmark, star: Star, follow: UserPlus, check: Check };

export function ToggleActionButton({
  actionType,
  targetType,
  targetId,
  label,
  activeLabel,
  icon = "bookmark",
  className = "",
}: {
  actionType: string;
  targetType: string;
  targetId: string;
  label: string;
  activeLabel?: string;
  icon?: IconName;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const Icon = iconMap[icon];

  useEffect(() => {
    const query = new URLSearchParams({ actionType, targetType, targetId });
    fetch("/api/actions?" + query).then((response) => response.ok ? response.json() as Promise<{ actions?: unknown[] }> : Promise.reject()).then((data) => setActive(Boolean(data.actions?.length))).catch(() => {});
  }, [actionType, targetType, targetId]);

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
    } catch {
      setActive(!next);
    } finally {
      setBusy(false);
    }
  };

  return <button type="button" onClick={toggle} disabled={busy} className={className} aria-pressed={active}>
    {busy ? <LoaderCircle size={17} className="animate-spin"/> : <Icon size={17} className={active ? "fill-current" : ""}/>}
    <span>{active ? activeLabel ?? "Đã lưu" : label}</span>
  </button>;
}

export function ShareActionButton({ title, className = "", targetType, targetId, onShared }: { title: string; className?: string; targetType?: string; targetId?: string; onShared?: (created: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = { title, text: title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
      if (targetType && targetId) {
        const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionType: "share", targetType, targetId }) });
        const result = await response.json() as { created?: boolean };
        if (response.ok) onShared?.(Boolean(result.created));
      }
    } catch {}
  };
  return <button type="button" onClick={share} className={className}><Share2 size={17}/><span>{copied ? "Đã sao chép" : "Chia sẻ"}</span></button>;
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
  onSuccess,
  recipientUserId,
}: {
  requestType: string;
  targetType: string;
  targetId: string;
  label: string;
  title: string;
  description?: string;
  className?: string;
  allowFile?: boolean;
  iconOnly?: "comment" | "expert" | "file";
  onSuccess?: () => void;
  recipientUserId?: string;
}) {
  const fieldId = useId();
  const routedDelivery = requestType === "expert-question" || requestType === "drawing-purchase" || requestType === "drawing-file-request";
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(title);
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [attachmentKey, setAttachmentKey] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState(routedDelivery ? ["internal", "zalo", "messenger", "telegram"] : ["internal"]);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/files", { method: "POST", body: form });
      const data = await response.json() as { error?: string; attachment?: { key: string; name: string } };
      if (!response.ok || !data.attachment) throw new Error(data.error || "Không thể tải tệp.");
      setAttachmentKey(data.attachment.key);
      setAttachmentName(data.attachment.name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải tệp.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!content.trim()) { setMessage("Vui lòng nhập nội dung."); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType, targetType, targetId, subject, content, contact, attachmentKey, recipientUserId, channels }),
      });
      const data = await response.json() as { error?: string; delivery?: Record<string, { status: string }> };
      if (!response.ok) throw new Error(data.error || "Chưa thể gửi yêu cầu.");
      const sent = Object.entries(data.delivery ?? {}).filter(([, result]) => result.status === "sent").map(([channel]) => channel === "internal" ? "Web nội bộ" : channel === "zalo" ? "Zalo" : channel === "messenger" ? "Messenger" : "Telegram");
      const pending = Object.entries(data.delivery ?? {}).filter(([, result]) => result.status !== "sent").map(([channel]) => channel === "zalo" ? "Zalo" : channel === "messenger" ? "Messenger" : "Telegram");
      setMessage(`Đã gửi: ${sent.join(", ") || "chưa có kênh"}.${pending.length ? ` Chưa cấu hình: ${pending.join(", ")}.` : ""}`);
      setContent("");
      setContact("");
      setAttachmentKey("");
      setAttachmentName("");
      onSuccess?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa thể gửi yêu cầu.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className={`group/request relative ${className}`} aria-label={label} title={iconOnly ? undefined : label}>{iconOnly === "comment" ? <MessageCircle size={19}/> : iconOnly === "expert" ? <CircleHelp size={19}/> : iconOnly === "file" ? <FileDown size={19}/> : label}{iconOnly && <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#182230] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover/request:block group-focus-visible/request:block">{label}</span>}</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] max-w-[520px] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl">
        <DialogHeader className="relative border-b border-[#e4e6eb] px-14 py-5 text-center sm:text-center">
          <DialogTitle className="text-xl font-bold text-[#050505]">{title}</DialogTitle>
          <DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]"><X size={21}/></DialogClose>
        </DialogHeader>
        <div className="space-y-4 p-4">
          {description && <p className="text-sm leading-6 text-[#536273]">{description}</p>}
          <label className="block text-sm font-semibold text-[#182230]" htmlFor={fieldId + "-subject"}>Tiêu đề</label>
          <input id={fieldId + "-subject"} value={subject} onChange={(event) => setSubject(event.target.value)} className="h-11 w-full rounded-xl border border-[#d0d5dd] px-3 text-sm outline-none focus:border-[#229ed9]"/>
          <label className="block text-sm font-semibold text-[#182230]" htmlFor={fieldId + "-content"}>Nội dung chi tiết</label>
          <textarea id={fieldId + "-content"} value={content} onChange={(event) => setContent(event.target.value)} className="min-h-32 w-full resize-y rounded-xl border border-[#d0d5dd] p-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Mô tả nhu cầu, kinh nghiệm hoặc thông tin cần trao đổi..." maxLength={2000}/>
          <label className="block text-sm font-semibold text-[#182230]" htmlFor={fieldId + "-contact"}>Thông tin liên hệ</label>
          <input id={fieldId + "-contact"} value={contact} onChange={(event) => setContact(event.target.value)} className="h-11 w-full rounded-xl border border-[#d0d5dd] px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Email hoặc số điện thoại"/>
          {allowFile && <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#98a2b3] bg-[#f8fafc] p-3 text-sm font-semibold text-[#344054] hover:border-[#229ed9]"><Upload size={19}/><span className="min-w-0 flex-1 truncate">{attachmentName || "Đính kèm hồ sơ hoặc tài liệu"}</span><input type="file" className="hidden" onChange={(event) => upload(event.target.files?.[0])}/></label>}
          {routedDelivery && <fieldset><legend className="mb-2 text-sm font-semibold text-[#182230]">Gửi qua các kênh</legend><div className="grid grid-cols-2 gap-2">{[["internal","Web nội bộ"],["zalo","Zalo"],["messenger","Messenger"],["telegram","Telegram"]].map(([value, name]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#d0d5dd] px-3 py-2.5 text-sm font-medium text-[#344054]"><input type="checkbox" checked={channels.includes(value)} onChange={() => setChannels((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} className="size-4 accent-[#229ed9]"/>{name}</label>)}</div></fieldset>}
          {message && <p className={"rounded-lg px-3 py-2 text-sm " + (message.startsWith("Đã gửi") ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-[#147aa8]")}>{message}</p>}
          <Button type="button" onClick={submit} disabled={busy || !content.trim() || !channels.length} className="h-11 w-full rounded-xl bg-[#229ed9] font-bold hover:bg-[#168ac0]">{busy ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={17}/>}Gửi yêu cầu</Button>
        </div>
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
