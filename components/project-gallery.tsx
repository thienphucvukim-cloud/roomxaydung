"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, MapPin, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EditableImage, EditableText, useSiteEditor } from "@/components/site-editor";
import { recordCatalogView } from "@/components/catalog-engagement";
import type { CatalogTarget } from "@/lib/catalog-engagement";
import { DemoPostBadge } from "@/components/demo-post-badge";

type Model = { title: string; meta: string; style: string; image: string; photos?: string[]; editableKey?: string; isDemo?: boolean };

export function ProjectGallery({ model, trigger = "text", engagementTarget }: { model: Model; trigger?: "text" | "overlay"; engagementTarget?: CatalogTarget }) {
  const editor = useSiteEditor();
  const originals = model.photos?.length ? model.photos : [model.image, "/community-house.png", "/mau-nha-pho-xanh.png", "/mat-bang-5x20.png", model.image];
  const photos = originals.map((photo, index) => model.editableKey ? editor.content[`${model.editableKey}.${index === 0 ? "image" : `photo.${index}`}`]?.value ?? photo : photo);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; atStart: boolean; atEnd: boolean } | null>(null);
  const choose = (index: number) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const slide = carousel.children[index] as HTMLElement | undefined;
    if (!slide) return;
    carousel.scrollTo({
      left: slide.offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };
  const previous = () => choose((selectedRef.current - 1 + photos.length) % photos.length);
  const next = () => choose((selectedRef.current + 1) % photos.length);
  const openGallery = () => { selectedRef.current = 0; setSelected(0); setOpen(true); if (engagementTarget) void recordCatalogView(engagementTarget); };

  useEffect(() => {
    if (!open) return;
    const thumbnails = thumbnailsRef.current;
    const thumbnail = thumbnails?.children[selected] as HTMLElement | undefined;
    if (!thumbnails || !thumbnail) return;
    thumbnails.scrollTo({
      left: thumbnail.offsetLeft - (thumbnails.clientWidth - thumbnail.offsetWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [open, selected]);

  const attachCarousel = useCallback((carousel: HTMLDivElement | null) => {
    carouselRef.current = carousel;
    if (!carousel) return;
    const resizeObserver = new ResizeObserver(() => {
      const slide = carousel.children[selectedRef.current] as HTMLElement | undefined;
      if (slide) carousel.scrollTo({ left: slide.offsetLeft, behavior: "instant" });
    });
    resizeObserver.observe(carousel);
    return () => { resizeObserver.disconnect(); carouselRef.current = null; };
  }, []);

  return <>
    {trigger === "overlay" ? <button onClick={openGallery} className="absolute inset-0 z-10 cursor-zoom-in" aria-label={`Xem ảnh ${model.title}`}><span className="sr-only">Xem ảnh</span></button> : <button onClick={openGallery} className="flex items-center gap-1.5 text-sm font-bold text-[#229ed9] hover:text-[#168ac0]"><Images size={16}/>Xem ảnh</button>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-1.5rem)] max-w-[calc(100%-1rem)] grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 sm:max-w-5xl" aria-describedby={undefined}><DialogClose className="absolute right-3 top-3 z-30 grid size-10 place-items-center rounded-full border border-[#e3eaf2] bg-white text-[#0b2e59] shadow-lg transition hover:bg-[#f7f9fc] sm:right-4 sm:top-4 sm:size-12" aria-label="Đóng xem ảnh"><X size={26}/><span className="sr-only">Đóng</span></DialogClose>
        <div className="min-h-0 overflow-y-auto p-3 sm:p-8">
          {model.isDemo && <div className="mb-2"><DemoPostBadge isDemo/></div>}
          <p className="pr-12 text-xs font-extrabold uppercase tracking-[.13em] text-[#229ed9] sm:pr-10">{model.editableKey ? <EditableText contentKey={`${model.editableKey}.style`}>{model.style}</EditableText> : model.style}</p>
          <DialogTitle className="mt-1 pr-12 text-lg font-extrabold leading-snug tracking-[-.03em] text-[#0b2e59] sm:mt-2 sm:pr-10 sm:text-4xl">{model.editableKey ? <EditableText contentKey={`${model.editableKey}.title`}>{model.title}</EditableText> : model.title}</DialogTitle>
          <div className="mt-3 overflow-hidden rounded-xl bg-[#f7f9fc] sm:mt-6">
            <div className="relative h-[clamp(12rem,calc(100dvh-21rem),36rem)] bg-[#e5e4df] sm:aspect-[16/10] sm:h-auto">
              <div ref={attachCarousel} role="region" aria-roledescription="carousel" aria-label={`Bộ ảnh ${model.title}`} tabIndex={0}
                className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth scrollbar-none motion-reduce:scroll-auto"
                onTouchStart={event => {
                  touchStartRef.current = null;
                  if (event.touches.length !== 1 || photos.length < 2) return;
                  const carousel = event.currentTarget;
                  const touch = event.touches[0];
                  touchStartRef.current = {
                    x: touch.clientX,
                    y: touch.clientY,
                    atStart: carousel.scrollLeft <= 1,
                    atEnd: carousel.scrollWidth - carousel.clientWidth - carousel.scrollLeft <= 1,
                  };
                }}
                onTouchEnd={event => {
                  const start = touchStartRef.current;
                  touchStartRef.current = null;
                  const touch = event.changedTouches[0];
                  if (!start || !touch || event.touches.length) return;
                  const distance = touch.clientX - start.x;
                  if (Math.abs(distance) < 50 || Math.abs(distance) <= Math.abs(touch.clientY - start.y)) return;
                  if (start.atEnd && distance < 0) choose(0);
                  if (start.atStart && distance > 0) choose(photos.length - 1);
                }}
                onTouchCancel={() => { touchStartRef.current = null; }}
                onScroll={event => {
                  const carousel = event.currentTarget;
                  if (!carousel.clientWidth) return;
                  const index = Math.max(0, Math.min(photos.length - 1, Math.round(carousel.scrollLeft / carousel.getBoundingClientRect().width)));
                  selectedRef.current = index;
                  setSelected(index);
                }}
                onKeyDown={event => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
                  if (event.key === "ArrowRight") { event.preventDefault(); next(); }
                  if (event.key === "Home") { event.preventDefault(); choose(0); }
                  if (event.key === "End") { event.preventDefault(); choose(photos.length - 1); }
                }}>
                {photos.map((photo, index) => <div key={index} role="group" aria-roledescription="slide" aria-label={`Ảnh ${index + 1} / ${photos.length}`} className="h-full w-full shrink-0 snap-center snap-always">
                  {model.editableKey ? <EditableImage contentKey={`${model.editableKey}.${index === 0 ? "image" : `photo.${index}`}`} src={originals[index]} alt={`${model.title} - ảnh ${index + 1}`} draggable={false} loading={Math.abs(index - selected) <= 1 ? "eager" : "lazy"} decoding="async" className="h-full w-full select-none object-contain"/> : <img src={photo} alt={`${model.title} - ảnh ${index + 1}`} draggable={false} loading={Math.abs(index - selected) <= 1 ? "eager" : "lazy"} decoding="async" className="h-full w-full select-none object-contain"/>}
                </div>)}
              </div>
              <span aria-live="polite" aria-atomic="true" className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">{selected + 1} / {photos.length}</span>
              <button onClick={previous} disabled={photos.length < 2} aria-label="Ảnh trước" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#0b2e59] shadow-md hover:bg-white disabled:pointer-events-none disabled:opacity-30"><ChevronLeft size={21}/></button>
              <button onClick={next} disabled={photos.length < 2} aria-label="Ảnh tiếp theo" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#0b2e59] shadow-md hover:bg-white disabled:pointer-events-none disabled:opacity-30"><ChevronRight size={21}/></button>
            </div>
            <div ref={thumbnailsRef} className="relative flex gap-2 overflow-x-auto bg-[#0b2e59] p-2 scrollbar-none sm:p-3">
              {photos.map((photo, index) => <button key={index} onClick={() => choose(index)} className={`h-11 w-16 shrink-0 overflow-hidden rounded-md border-2 sm:h-14 sm:w-20 ${selected === index ? "border-[#229ed9]" : "border-transparent opacity-75 hover:opacity-100"}`} aria-label={`Chọn ảnh ${index + 1}`} aria-current={selected === index ? "true" : undefined}><img src={photo} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover"/></button>)}
            </div>
          </div>
          <section className="mt-3 overflow-hidden rounded-xl border border-[#e3eaf2] sm:mt-6">
            <h2 className="bg-[#0b2e59] px-3 py-2 text-center text-xs font-extrabold uppercase tracking-[.1em] text-[#bde7f8] sm:px-5 sm:py-4 sm:text-sm">Thông tin công trình</h2>
            <div className="grid grid-cols-3 divide-x divide-[#e3eaf2] text-xs sm:text-base">
              <div className="min-w-0 p-2 break-words sm:p-4"><p className="text-[10px] font-bold text-[#3f5064] sm:text-xs">Loại công trình</p><p className="mt-1 font-extrabold">{model.style}</p></div>
              <div className="min-w-0 p-2 break-words sm:p-4"><p className="text-[10px] font-bold text-[#3f5064] sm:text-xs">Quy mô</p><p className="mt-1 font-extrabold">{model.meta}</p></div>
              <div className="min-w-0 p-2 break-words sm:p-4"><p className="flex items-center gap-1 text-[10px] font-bold text-[#3f5064] sm:text-xs"><MapPin size={13} className="shrink-0"/>Khu vực tham khảo</p><p className="mt-1 font-extrabold">Việt Nam</p></div>
            </div>
          </section>
        </div>
        <div className="flex items-center justify-between border-t border-[#e5ebe6] bg-white px-3 py-3 text-sm font-bold text-[#3f5064] sm:px-8 sm:py-4"><button onClick={previous} disabled={photos.length < 2} className="flex items-center gap-1 hover:text-[#229ed9] disabled:opacity-30"><ChevronLeft size={16}/>Ảnh trước</button><span className="hidden text-[#147aa8] sm:inline">Bộ ảnh công trình</span><button onClick={next} disabled={photos.length < 2} className="flex items-center gap-1 hover:text-[#229ed9] disabled:opacity-30">Ảnh tiếp theo<ChevronRight size={16}/></button></div>
      </DialogContent>
    </Dialog>
  </>;
}
