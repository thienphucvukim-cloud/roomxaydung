"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Photo = { url: string; name: string };

export function NewsPhotoViewer({ photos, index, onIndexChange, onClose, onRestoreFocus, title, children, postId }: {
  postId?: number;
  photos: Photo[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onRestoreFocus: () => void;
  title: string;
  children: ReactNode;
}) {
  const [zoomed, setZoomed] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const selected = index === null ? 0 : Math.min(index, photos.length - 1);
  const photo = photos[selected];
  const move = (delta: number) => {
    if (photos.length < 2) return;
    setZoomed(false);
    onIndexChange((selected + delta + photos.length) % photos.length);
  };

  return <Dialog open={index !== null && Boolean(photo)} onOpenChange={open => { if (!open) { setZoomed(false); onClose(); } }}>
    <DialogContent data-auth-post-id={postId} showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); onRestoreFocus(); }} className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0 sm:max-w-none lg:flex-row" onKeyDown={event => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
    }}>
      <DialogTitle className="sr-only">Ảnh của bài viết: {title}</DialogTitle>
      <DialogDescription className="sr-only">Dùng phím mũi tên hoặc vuốt để chuyển ảnh. Nhấn Escape để đóng.</DialogDescription>
      <div className="relative flex min-h-0 shrink-0 flex-col bg-[#0b0b0c] text-white max-lg:h-[52dvh] lg:h-full lg:min-w-0 lg:flex-1">
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <DialogClose aria-label="Đóng trình xem ảnh" className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"><X size={23} /></DialogClose>
          <span role="status" className="rounded-full bg-black/40 px-3 py-1 text-sm">Ảnh {selected + 1} / {photos.length}</span>
          <button type="button" aria-label={zoomed ? "Thu nhỏ ảnh" : "Phóng to ảnh"} aria-pressed={zoomed} onClick={() => setZoomed(value => !value)} className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25">{zoomed ? <ZoomOut size={21} /> : <ZoomIn size={21} />}</button>
        </div>
        <div className={`flex min-h-0 flex-1 ${zoomed ? "overflow-auto" : "items-center justify-center overflow-hidden"}`} onTouchStart={event => {
          const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY };
        }} onTouchEnd={event => {
          const start = touchStart.current; touchStart.current = null;
          if (!start || zoomed) return;
          const touch = event.changedTouches[0];
          const distance = touch.clientX - start.x;
          if (Math.abs(distance) > 50 && Math.abs(distance) > Math.abs(touch.clientY - start.y)) move(distance < 0 ? 1 : -1);
        }}>
          {photo && <Image key={photo.url} src={photo.url} alt={photo.name || `${title} – ảnh ${selected + 1}`} width={1920} height={1920} unoptimized className={zoomed ? "m-auto h-auto w-auto max-w-none shrink-0" : "h-full w-full object-contain"} />}
        </div>
        {photos.length > 1 && <>
          <button type="button" aria-label="Ảnh trước" onClick={() => move(-1)} className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/80"><ChevronLeft size={28} /></button>
          <button type="button" aria-label="Ảnh tiếp theo" onClick={() => move(1)} className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 hover:bg-black/80"><ChevronRight size={28} /></button>
          <div className="flex shrink-0 justify-start gap-2 overflow-x-auto px-4 py-2" aria-label="Danh sách ảnh">{photos.map((item, position) => <button key={`${item.url}:${position}`} type="button" aria-label={`Xem ảnh ${position + 1}`} aria-pressed={selected === position} onClick={() => { setZoomed(false); onIndexChange(position); }} className={`relative size-12 shrink-0 overflow-hidden rounded border-2 ${selected === position ? "border-[#229ed9]" : "border-transparent opacity-60 hover:opacity-100"}`}><Image src={item.url} alt="" fill unoptimized className="object-cover" /></button>)}</div>
        </>}
      </div>
      <aside aria-label="Bài viết và bình luận" className="min-h-0 flex-1 overflow-y-auto overscroll-contain text-[#1c1e21] lg:w-[380px] lg:flex-none">{children}</aside>
    </DialogContent>
  </Dialog>;
}
