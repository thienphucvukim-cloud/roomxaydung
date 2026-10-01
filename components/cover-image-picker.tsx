"use client";

import { Check, X } from "lucide-react";

type ImageChoice = { id: string; url: string; name: string };

export function CoverImagePicker({ images, selectedId, onSelect, onRemove, disabled = false }: {
  images: ImageChoice[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  if (!images.length) return null;
  const coverId = images.some(image => image.id === selectedId) ? selectedId : images[0].id;

  return <fieldset className="mt-3" disabled={disabled}>
    <legend className="text-sm font-bold text-[#182230]">Chọn ảnh đại diện</legend>
    <p className="mt-1 text-xs leading-5 text-[#667085]">Ảnh đã chọn sẽ hiển thị trên thẻ bài đăng. Bấm vào một ảnh để chọn.</p>
    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map((image, index) => {
        const selected = image.id === coverId;
        return <div key={image.id} className="relative min-w-0">
          <label className={`block cursor-pointer overflow-hidden rounded-xl border-2 bg-white transition ${selected ? "border-[#229ed9] ring-2 ring-[#229ed9]/15" : "border-[#e3eaf2] hover:border-[#8fcfe8]"} ${disabled ? "pointer-events-none opacity-60" : ""}`}>
            <input type="radio" name="cover-image" value={image.id} checked={selected} onChange={() => onSelect(image.id)} className="peer sr-only" aria-label={`Dùng ảnh ${index + 1} làm ảnh đại diện`}/>
            <img src={image.url} alt={image.name} className="aspect-[4/3] w-full object-cover peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-[#229ed9]"/>
            <span className={`flex min-h-8 items-center justify-center gap-1 px-1 text-[11px] font-bold ${selected ? "bg-[#eef9fd] text-[#147aa8]" : "text-[#667085]"}`}>
              {selected && <Check size={13}/>}{selected ? "Ảnh đại diện" : "Chọn làm đại diện"}
            </span>
          </label>
          <button type="button" onClick={() => onRemove(image.id)} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/65 text-white hover:bg-black/80 disabled:cursor-wait" aria-label={`Xóa ảnh ${index + 1}`}><X size={15}/></button>
        </div>;
      })}
    </div>
  </fieldset>;
}
