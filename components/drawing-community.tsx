"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { FileText, LoaderCircle, Search, Upload, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RequestActionButton } from "@/components/interactive-actions";

type Attachment = { key: string; name: string; type: string; size: number; url: string };
type Post = { id: number; userId: string; authorName: string; title: string; content: string; category: string; location?: string | null; feeling?: string | null; pollQuestion?: string | null; attachments?: Attachment[] };
const category = "Bản vẽ cộng đồng";

export function DrawingCommunity() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [drawingType, setDrawingType] = useState("");
  const [format, setFormat] = useState("");
  const [price, setPrice] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/posts").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { posts?: Post[] }) => setPosts((data.posts ?? []).filter((post) => post.category === category))).catch(() => setNotice("Chưa thể tải bản vẽ cộng đồng."));
  }, []);

  useEffect(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    document.querySelectorAll<HTMLElement>("[data-drawing-search]").forEach((card) => {
      const value = (card.dataset.drawingSearch ?? "").toLocaleLowerCase("vi");
      card.style.display = !normalized || value.includes(normalized) ? "" : "none";
    });
    return () => document.querySelectorAll<HTMLElement>("[data-drawing-search]").forEach((card) => { card.style.display = ""; });
  }, [query]);

  const visiblePosts = posts.filter((post) => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return !normalized || (post.title + " " + post.content + " " + (post.feeling ?? "") + " " + (post.location ?? "") + " " + post.authorName).toLocaleLowerCase("vi").includes(normalized);
  });

  const chooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    if (files.length + selected.length > 10) { setNotice("Mỗi bài được đính kèm tối đa 10 tệp."); return; }
    setUploading(true); setNotice("");
    try {
      const uploaded: Attachment[] = [];
      for (const file of selected) {
        const form = new FormData(); form.append("file", file);
        const response = await fetch("/api/files", { method: "POST", body: form });
        const data = await response.json() as { error?: string; attachment?: Attachment };
        if (!response.ok || !data.attachment) throw new Error(data.error || "Không thể tải tệp.");
        uploaded.push(data.attachment);
      }
      setFiles((current) => [...current, ...uploaded]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể tải tệp."); }
    finally { setUploading(false); }
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !drawingType.trim() || !format.trim() || !files.length) { setNotice("Vui lòng nhập đủ thông tin và đính kèm ít nhất một tệp."); return; }
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), content: description.trim(), category, audience: "Công khai", feeling: drawingType.trim(), location: format.trim(), pollQuestion: price.trim(), attachments: files.map(({ key, name, type, size }) => ({ key, name, type, size })) }) });
      const data = await response.json() as { error?: string; post?: Post };
      if (!response.ok || !data.post) throw new Error(data.error || "Chưa thể đăng bản vẽ.");
      setPosts((current) => [{ ...data.post!, attachments: data.post!.attachments?.length ? data.post!.attachments : files }, ...current]);
      setTitle(""); setDescription(""); setDrawingType(""); setFormat(""); setPrice(""); setFiles([]); setOpen(false); setNotice("Bản vẽ đã được đăng.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Chưa thể đăng bản vẽ."); }
    finally { setSaving(false); }
  };

  return <>
    <section className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
      <button type="button" onClick={() => setOpen(true)} className="flex h-[62px] items-center gap-3 rounded-2xl border border-[#dfe5eb] bg-white px-3.5 text-left shadow-sm transition hover:border-[#b9dceb]">
        <img src="/avatars/user-nguyen-van-a.png" alt="Ảnh đại diện của bạn" className="size-9 shrink-0 rounded-full object-cover"/>
        <span className="flex h-10 min-w-0 flex-1 items-center truncate rounded-full bg-[#f0f2f5] px-4 text-sm text-[#667085]">Đăng bản vẽ của bạn</span>
      </button>
      <label className="flex h-[62px] items-center gap-3 rounded-2xl border border-[#dfe5eb] bg-white px-5 shadow-sm focus-within:border-[#229ed9] focus-within:ring-2 focus-within:ring-[#229ed9]/10">
        <Search size={20} className="shrink-0 text-[#667085]"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#182230] outline-none placeholder:text-[#98a2b3]" placeholder="Tìm tên bản vẽ, loại hồ sơ hoặc định dạng..." aria-label="Tìm kiếm bản vẽ"/>
        {query && <button type="button" onClick={() => setQuery("")} className="grid size-8 place-items-center rounded-full text-[#667085] hover:bg-[#f2f4f7]" aria-label="Xóa tìm kiếm"><X size={17}/></button>}
      </label>
    </section>

    {visiblePosts.length > 0 && <section className="mt-7 rounded-[24px] border border-[#dfe8f1] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#168ac0]">Từ cộng đồng</p><h2 className="mt-1 text-xl font-extrabold">Bản vẽ mới đăng</h2></div><span className="text-sm text-[#667085]">{visiblePosts.length} bản vẽ</span></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visiblePosts.map((post) => { const preview = post.attachments?.find((item) => item.type.startsWith("image/")); return <article key={post.id} className="overflow-hidden rounded-2xl border border-[#e3eaf2]">{preview ? <img src={preview.url} alt={post.title} className="aspect-[4/3] w-full object-cover"/> : <div className="grid aspect-[4/3] place-items-center bg-[#f3f6f9] text-[#168ac0]"><FileText size={42}/></div>}<div className="p-4"><span className="text-xs font-bold text-[#168ac0]">{post.feeling}</span><h3 className="mt-1 line-clamp-2 font-extrabold">{post.title}</h3><p className="mt-2 text-sm text-[#667085]">{post.location}{post.pollQuestion ? " · " + post.pollQuestion : ""}</p><p className="mt-2 line-clamp-2 text-sm text-[#667085]">{post.content}</p><div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs font-bold text-[#168ac0]">{post.authorName}</p><RequestActionButton requestType="drawing-purchase" targetType="post" targetId={String(post.id)} recipientUserId={post.userId} label="Yêu cầu file" title={"Yêu cầu file: " + post.title} description="Tin nhắn sẽ được gửi trực tiếp đến người đăng bản vẽ." className="text-xs font-bold text-[#229ed9]"/></div></div></article>; })}</div></section>}
    {notice.includes("đã được đăng") && <p className="mt-3 text-center text-sm font-semibold text-emerald-600">{notice}</p>}

    <Dialog open={open} onOpenChange={setOpen}><DialogContent showCloseButton={false} className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[560px] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0"><header className="relative border-b px-14 py-4 text-center"><DialogTitle className="text-xl font-extrabold">Đăng bản vẽ</DialogTitle><DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose></header><form onSubmit={publish} className="min-h-0 overflow-y-auto p-4"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Tên bản vẽ"/><div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={drawingType} onChange={(event) => setDrawingType(event.target.value)} maxLength={60} className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Loại hồ sơ"/><input value={format} onChange={(event) => setFormat(event.target.value)} maxLength={100} className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Định dạng: CAD, PDF..."/></div><input value={price} onChange={(event) => setPrice(event.target.value)} maxLength={40} className="mt-3 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Giá bán (không bắt buộc)"/><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={4} className="mt-3 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Mô tả phạm vi hồ sơ, phiên bản phần mềm và quyền sử dụng..."/><input ref={inputRef} type="file" multiple className="hidden" onChange={chooseFiles}/><button type="button" onClick={() => inputRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#8fcfe8] bg-[#f7fbfd] px-4 py-3 text-sm font-bold text-[#147aa8]"><Upload size={18}/>{uploading ? "Đang tải tệp..." : `Chọn tệp (${files.length}/10)`}</button>{files.length > 0 && <div className="mt-3 space-y-2">{files.map((file) => <div key={file.key} className="flex items-center gap-2 rounded-lg bg-[#f3f6f9] px-3 py-2 text-sm"><FileText size={16}/><span className="min-w-0 flex-1 truncate">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((item) => item.key !== file.key))} aria-label="Bỏ tệp"><X size={16}/></button></div>)}</div>}{notice && !notice.includes("đã được đăng") && <p className="mt-3 text-sm font-semibold text-rose-600">{notice}</p>}<button disabled={saving || uploading} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] text-sm font-extrabold text-white disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={18}/> : <Upload size={18}/>}Đăng bản vẽ</button></form></DialogContent></Dialog>
  </>;
}