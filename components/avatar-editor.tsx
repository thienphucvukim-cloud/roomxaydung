"use client";

import { SITE_EVENTS } from "@/lib/site-events";
import { useRef, useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { optimizeImageForUpload } from "@/lib/image-upload";

type AvatarResult = { avatarUrl: string | null; hasCustomAvatar: boolean };

export function AvatarEditor({ name, avatarUrl, hasCustomAvatar, authenticated, onChange }: AvatarResult & { name: string; authenticated: boolean; onChange: (value: AvatarResult) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const save = async (file?: File, remove = false) => {
    if (busy || (!file && !remove)) return;
    setBusy(true);
    setNotice("");
    try {
      let body: FormData | undefined;
      if (file) {
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) throw new Error("Chọn ảnh JPG, PNG, WebP hoặc GIF.");
        body = new FormData();
        body.append("file", await optimizeImageForUpload(file, "avatar"));
      }
      const response = await fetch("/api/avatar", { method: remove ? "DELETE" : "POST", body });
      const result = await response.json() as AvatarResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "Chưa thể lưu ảnh đại diện.");
      onChange(result);
      window.dispatchEvent(new Event(SITE_EVENTS.avatarChanged));
      setNotice(remove ? "Đã dùng ảnh mặc định." : "Đã cập nhật ảnh đại diện.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Chưa thể lưu ảnh đại diện."); }
    finally { setBusy(false); }
  };
  return <div className="flex shrink-0 flex-col items-start gap-2 sm:max-w-48">
    <button type="button" disabled={!authenticated || busy} onClick={() => input.current?.click()} aria-label="Đổi ảnh đại diện" className="group relative rounded-full disabled:cursor-default">
      <MemberAvatar name={name} src={avatarUrl} className="size-24 border-4 border-white/30 text-4xl"/>
      {authenticated && <span className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full border-2 border-[#073b74] bg-white text-[#073b74]">{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Camera size={16}/>}</span>}
    </button>
    {authenticated && <><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void save(file); }}/><button type="button" disabled={busy} onClick={() => input.current?.click()} className="text-xs font-semibold underline underline-offset-4 disabled:opacity-50">Đổi ảnh đại diện</button>{hasCustomAvatar && <button type="button" disabled={busy} onClick={() => void save(undefined, true)} className="text-xs underline underline-offset-4 disabled:opacity-50">Dùng ảnh mặc định</button>}</>}
    {notice && <p role="status" className="max-w-56 text-xs leading-5">{notice}</p>}
  </div>;
}
