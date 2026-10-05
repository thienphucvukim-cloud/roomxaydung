"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useSiteEditor } from "@/components/site-editor";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { demoPostState } from "@/lib/demo-posts";
import type { ContentValue } from "@/lib/site-content";

export function DemoPostControls({ prefix, title, style, image, meta }: { prefix: string; title: string; style: string; image: string; meta?: string }) {
  const editor = useSiteEditor();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!editor.isOwner) return null;
  const state = demoPostState(editor.content, prefix);
  if (state === "deleted") return null;
  const currentTitle = editor.content[`${prefix}.title`]?.value ?? title;

  async function save(changes: Record<string, ContentValue>, message: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await editor.saveContent(changes);
      setOpen(false); setNotice(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể cập nhật bài demo.");
    } finally { setBusy(false); }
  }

  function visibility(next: "public" | "hidden" | "deleted") {
    if (busy) return;
    if (next === "deleted" && !window.confirm(`Xóa bài demo “${currentTitle}”? Bài sẽ bị xóa vĩnh viễn và không thể khôi phục.`)) return;
    void save({ [`${prefix}.visibility`]: { kind: "text", value: next } }, next === "deleted" ? "Đã xóa bài demo khỏi website." : next === "hidden" ? "Đã ẩn bài demo với khách truy cập." : "Đã hiển thị lại bài demo.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const changes: Record<string, ContentValue> = {};
    for (const field of ["title", "style", "image", ...(meta === undefined ? [] : ["meta"])]) {
      changes[`${prefix}.${field}`] = { kind: field === "image" ? "image" : "text", value: String(form.get(field) ?? "").trim() };
    }
    void save(changes, "Đã lưu chỉnh sửa bài demo.");
  }

  return <>
    <span className="admin-post-controls" role="group" aria-label="Quản trị bài demo">
      {state !== "public" && <span className="basis-full text-[#667085]">Đã ẩn · Chỉ quản trị viên thấy</span>}
      <>
        <button type="button" disabled={busy} onClick={() => { setError(""); setNotice(""); setOpen(true); }}><Pencil size={14}/>Chỉnh sửa</button>
        <button type="button" disabled={busy} onClick={() => visibility(state === "public" ? "hidden" : "public")}>{state === "public" ? <EyeOff size={14}/> : <Eye size={14}/>} {state === "public" ? "Ẩn" : "Hiện lại"}</button>
        <button type="button" className="danger" disabled={busy} onClick={() => visibility("deleted")}><Trash2 size={14}/>Xóa</button>
      </>
      {busy && <LoaderCircle size={14} className="animate-spin" aria-label="Đang lưu"/>}
      {error && !open && <span role="alert" className="admin-post-error">{error}</span>}
      {notice && <span role="status" className="basis-full text-xs font-normal">{notice}</span>}
    </span>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-white">
      <DialogTitle>Chỉnh sửa bài demo</DialogTitle><DialogDescription>Lưu thay đổi để cập nhật bài demo trên website.</DialogDescription>
      <form onSubmit={submit} className="owner-edit-form">
        <label>Tiêu đề<input name="title" defaultValue={currentTitle} required maxLength={120} disabled={busy}/></label>
        <label>Loại / phong cách<input name="style" defaultValue={editor.content[`${prefix}.style`]?.value ?? style} maxLength={200} disabled={busy}/></label>
        {meta !== undefined && <label>Thông tin mẫu<input name="meta" defaultValue={editor.content[`${prefix}.meta`]?.value ?? meta} maxLength={500} disabled={busy}/></label>}
        <label>Đường dẫn ảnh<input name="image" defaultValue={editor.content[`${prefix}.image`]?.value ?? image} required maxLength={1024} disabled={busy}/></label>
        {error && <p role="alert" className="owner-edit-error">{error}</p>}
        <div className="owner-edit-actions"><button type="button" className="owner-secondary" disabled={busy} onClick={() => setOpen(false)}>Hủy</button><button type="submit" className="owner-primary" disabled={busy}>{busy && <LoaderCircle size={15} className="animate-spin"/>}Lưu thay đổi</button></div>
      </form>
    </DialogContent></Dialog>
  </>;
}
