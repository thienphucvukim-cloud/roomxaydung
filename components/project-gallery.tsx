"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Images, MapPin, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Model = { title: string; meta: string; style: string; image: string };

export function ProjectGallery({ model, trigger = "text" }: { model: Model; trigger?: "text" | "overlay" }) {
  const photos = [model.image, "/community-house.png", "/mau-nha-pho-xanh.png", "/mat-bang-5x20.png", model.image];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const choose = (index: number) => setSelected(index);
  const previous = () => setSelected((current) => (current + photos.length - 1) % photos.length);
  const next = () => setSelected((current) => (current + 1) % photos.length);

  return <>
    {trigger === "overlay" ? <button onClick={() => { setSelected(0); setOpen(true); }} className="absolute inset-0 z-10 cursor-zoom-in" aria-label={`Xem ảnh ${model.title}`}><span className="sr-only">Xem ảnh</span></button> : <button onClick={() => { setSelected(0); setOpen(true); }} className="flex items-center gap-1.5 text-sm font-bold text-[#229ed9] hover:text-[#168ac0]"><Images size={16}/>Xem ảnh</button>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-1.5rem)] max-w-[calc(100%-1rem)] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 sm:max-w-5xl" aria-describedby={undefined}><DialogClose className="absolute right-4 top-4 z-30 grid size-12 place-items-center rounded-full border border-[#e3eaf2] bg-white text-[#0b2e59] shadow-lg transition hover:bg-[#f7f9fc]" aria-label="Đóng xem ảnh"><X size={26}/><span className="sr-only">Đóng</span></DialogClose>
        <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:p-8">
          <p className="pr-10 text-xs font-extrabold uppercase tracking-[.13em] text-[#229ed9]">{model.style}</p>
          <DialogTitle className="mt-2 pr-10 text-2xl font-extrabold tracking-[-.03em] text-[#0b2e59] sm:text-4xl">{model.title}</DialogTitle>
          <div className="mt-6 overflow-hidden rounded-xl bg-[#f7f9fc]">
            <div className="relative aspect-[16/10] bg-[#e5e4df]">
              <img src={photos[selected]} alt={`${model.title} - ảnh ${selected + 1}`} className="h-full w-full object-contain"/>
              <button onClick={previous} aria-label="Ảnh trước" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#0b2e59] shadow-md hover:bg-white"><ChevronLeft size={21}/></button>
              <button onClick={next} aria-label="Ảnh tiếp theo" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#0b2e59] shadow-md hover:bg-white"><ChevronRight size={21}/></button>
            </div>
            <div className="flex gap-2 overflow-x-auto bg-[#0b2e59] p-3 scrollbar-none">
              {photos.map((photo, index) => <button key={`${photo}-${index}`} onClick={() => choose(index)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 ${selected === index ? "border-[#229ed9]" : "border-transparent opacity-75 hover:opacity-100"}`} aria-label={`Chọn ảnh ${index + 1}`}><img src={photo} alt="" className="h-full w-full object-cover"/></button>)}
            </div>
          </div>
          <section className="mt-6 overflow-hidden rounded-xl border border-[#e3eaf2]">
            <h2 className="bg-[#0b2e59] px-5 py-4 text-center text-sm font-extrabold uppercase tracking-[.1em] text-[#bde7f8]">Thông tin công trình</h2>
            <div className="grid divide-y divide-[#e3eaf2] sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="p-4"><p className="text-xs font-bold text-[#3f5064]">Loại công trình</p><p className="mt-1 font-extrabold">{model.style}</p></div><div className="p-4"><p className="text-xs font-bold text-[#3f5064]">Quy mô</p><p className="mt-1 font-extrabold">{model.meta}</p></div><div className="p-4"><p className="flex items-center gap-1 text-xs font-bold text-[#3f5064]"><MapPin size={13}/>Khu vực tham khảo</p><p className="mt-1 font-extrabold">Việt Nam</p></div></div>
          </section>
        </div>
        <div className="flex items-center justify-between border-t border-[#e5ebe6] bg-white px-5 py-4 text-sm font-bold text-[#3f5064] sm:px-8"><button onClick={previous} className="flex items-center gap-1 hover:text-[#229ed9]"><ChevronLeft size={16}/>Ảnh trước</button><span className="hidden text-[#147aa8] sm:inline">Bộ ảnh công trình</span><button onClick={next} className="flex items-center gap-1 hover:text-[#229ed9]">Ảnh tiếp theo<ChevronRight size={16}/></button></div>
      </DialogContent>
    </Dialog>
  </>;
}