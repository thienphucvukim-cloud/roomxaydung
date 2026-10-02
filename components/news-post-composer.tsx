"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CurrentMemberAvatar } from "@/components/member-avatar";
import { optimizeImageForUpload } from "@/lib/image-upload";

type PickedImage = { file: File; preview: string };
type Attachment = { key: string; name: string; type: string; size: number };

export function NewsPostComposer({ open, onOpenChange, onPublished }: { open: boolean; onOpenChange: (open: boolean) => void; onPublished: () => void }) {
  const [content, setContent] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previews = useRef<PickedImage[]>([]);
  useEffect(() => { previews.current = images; }, [images]);
  useEffect(() => () => { previews.current.forEach(image => URL.revokeObjectURL(image.preview)); }, []);

  const chooseImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (busy) return;
    if (files.some(file => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) {
      setError("Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF."); return;
    }
    if (files.some(file => file.size > 25 * 1024 * 1024)) { setError("Mỗi ảnh tối đa 25 MB."); return; }
    if (images.length + files.length > 10) { setError("Mỗi bài đăng tối đa 10 ảnh."); return; }
    setError("");
    setImages(previous => [...previous, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || (!content.trim() && !images.length)) return;
    setBusy(true); setError("");
    try {
      const attachments: Attachment[] = [];
      for (const image of images) {
        const form = new FormData();
        form.append("file", await optimizeImageForUpload(image.file));
        const response = await fetch("/api/files", { method: "POST", body: form });
        const payload = await response.json() as { error?: string; attachment?: Attachment };
        if (!response.ok || !payload.attachment) throw new Error(payload.error || "Không thể tải ảnh.");
        attachments.push(payload.attachment);
      }
      const response = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "Bảng tin", content: content.trim(), audience: "Công khai", attachments }),
      });
      const payload = await response.json() as { error?: string; post?: { id: number } };
      if (!response.ok || !payload.post) throw new Error(payload.error || "Chưa thể đăng bài. Vui lòng thử lại.");
      images.forEach(image => URL.revokeObjectURL(image.preview));
      setImages([]); setContent(""); onOpenChange(false); onPublished();
      window.dispatchEvent(new Event("tipook-content-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể đăng bài. Vui lòng thử lại.");
    } finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[560px]" showCloseButton={!busy}>
      <DialogHeader><DialogTitle>Tạo bài viết</DialogTitle><DialogDescription>Chia sẻ nội dung và hình ảnh của bạn trên bảng tin.</DialogDescription></DialogHeader>
      <form onSubmit={publish} className="space-y-4">
        <div className="flex items-center gap-3"><CurrentMemberAvatar className="size-10" /><span className="rounded-md bg-[#f0f2f5] px-3 py-1 text-xs font-semibold">Công khai</span></div>
        <textarea aria-label="Nội dung bài đăng" placeholder="Bạn đang nghĩ gì?" value={content} onChange={event => setContent(event.target.value)} maxLength={1200} disabled={busy} className="min-h-36 w-full resize-y rounded-lg border border-[#dddfe2] p-3 text-base outline-none focus:ring-2 focus:ring-[#229ed9]" />
        {images.length > 0 && <div className="grid grid-cols-3 gap-2">{images.map(image => <div key={image.preview} className="relative aspect-square overflow-hidden rounded-lg">
          <Image src={image.preview} alt={image.file.name} fill unoptimized className="object-cover" />
          <button type="button" disabled={busy} aria-label={`Bỏ ảnh ${image.file.name}`} onClick={() => { URL.revokeObjectURL(image.preview); setImages(previous => previous.filter(item => item.preview !== image.preview)); }} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white disabled:opacity-50"><X size={16} /></button>
        </div>)}</div>}
        <label className={`flex items-center justify-between rounded-lg border border-[#dddfe2] p-3 text-sm font-semibold ${busy ? "opacity-50" : "cursor-pointer hover:bg-[#f0f2f5]"}`}>
          <span>Thêm ảnh ({images.length}/10)</span><ImagePlus size={24} className="text-green-600" />
          <input type="file" aria-label="Thêm ảnh vào bài đăng" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={busy} onChange={chooseImages} className="sr-only" />
        </label>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button type="submit" data-requires-account disabled={busy || (!content.trim() && !images.length)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1877f2] text-sm font-semibold text-white disabled:opacity-50">{busy && <LoaderCircle size={18} className="animate-spin" />}{busy ? "Đang đăng..." : "Đăng bài"}</button>
      </form>
    </DialogContent>
  </Dialog>;
}
