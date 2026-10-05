"use client";
import { postCategoryLabel } from "@/lib/site-sections";
import { SITE_EVENTS } from "@/lib/site-events";
/* eslint-disable @next/next/no-img-element */


import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, LoaderCircle, FileText, Globe, LockKeyhole } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AUTHOR_POST_STATES, OWN_POST_HIDDEN } from "@/lib/post-ownership";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { optimizePostImageForUpload } from "@/lib/image-upload";

type PostImage = { key: string; name: string; type: string; size: number; url: string };
type Post = { id: number; title: string; content: string; specifications: string | null; listingType: string | null; audience: string; category: string; images: PostImage[] };
type PostResponse = { post: Post; posts: Post[]; totalPages: number; isAdmin?: boolean; error?: string };
const buttonClass = "rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";

export const postManagementIconClass = "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[#168ac0] transition hover:bg-[#e8f6fc] focus-visible:outline-2 focus-visible:outline-[#229ed9]";

export function MyPostControls({ postId, iconOnly = false }: { postId: number; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [post, setPost] = useState<Post>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const locked = busy || uploading;
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch(`/api/my-posts?id=${postId}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json() as PostResponse;
      if (!response.ok || !data.posts?.[0]) throw new Error(data.error || "Không tìm thấy bài viết.");
      if (!controller.signal.aborted) { setPost(data.posts[0]); setIsAdmin(Boolean(data.isAdmin)); }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa thể tải bài viết."); });
    return () => controller.abort();
  }, [open, postId]);
  async function chooseImages(event: ChangeEvent<HTMLInputElement>, replaceKey?: string) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !post || locked) return;
    if (post.images.length + files.length - (replaceKey ? 1 : 0) > 10) { setError("Mỗi bài tối đa 10 ảnh. Hãy bỏ bớt ảnh trước khi thêm."); return; }
    if (files.some(file => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) { setError("Chọn ảnh JPG, PNG, WebP hoặc GIF."); return; }
    setUploading(true); setError(""); setNotice("");
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", await optimizePostImageForUpload(file, post.category)); form.append("purpose", "drawing-preview");
        const response = await fetch("/api/files", { method: "POST", body: form });
        const data = await response.json() as { attachment?: PostImage; error?: string };
        if (!response.ok || !data.attachment) throw new Error(data.error || "Chưa thể tải ảnh lên.");
        const image = data.attachment;
        setPost(current => current ? { ...current, images: replaceKey ? current.images.map(existing => existing.key === replaceKey ? image : existing) : [...current.images, image] } : current);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể tải ảnh lên."); }
    finally { setUploading(false); }
  }
  async function update(values: Record<string, unknown>, deleting = false) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/my-posts", { method: deleting ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: postId, ...values }) });
      const data = await response.json() as PostResponse;
      if (!response.ok) throw new Error(data.error || "Chưa thể cập nhật bài viết.");
      setPost(data.post); setConfirmDelete(false);
      window.dispatchEvent(new Event(SITE_EVENTS.contentChanged));
      if (deleting) setOpen(false);
      else setNotice(values.action === "hide" ? "Đã ẩn bài viết. Chỉ bạn xem được nội dung trong mục Bài viết của tôi." : values.action === "publish" ? "Đã công khai bài viết." : "Đã lưu thay đổi.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể cập nhật bài viết."); }
    finally { setBusy(false); }
  }
  return <><button type="button" className={iconOnly ? postManagementIconClass : "owner-post-control"} aria-label="Quản lý bài viết" title="Quản lý bài viết" onClick={() => { setPost(undefined); setError(""); setNotice(""); setConfirmDelete(false); setOpen(true); }}><Pencil size={14} aria-hidden="true"/>{!iconOnly && "Quản lý bài viết"}</button>
    <Dialog open={open} onOpenChange={value => { if (!locked) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogTitle>Quản lý bài viết của bạn</DialogTitle><DialogDescription>Bạn có thể sửa nội dung và ảnh, ẩn hoặc xóa bài viết. File hồ sơ tải xuống do quản trị viên quản lý.</DialogDescription>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      {!post && !error && <p role="status"><LoaderCircle className="inline animate-spin" size={18}/> Đang tải bài viết...</p>}
      {post && <form onSubmit={event => { event.preventDefault(); if (locked) return; void update({ title: post.title, content: post.content, specifications: post.specifications || "", listingType: post.listingType || "", imageKeys: post.images.map(image => image.key) }); }} className="space-y-4">
        <p className="text-sm text-[#667085]">Trạng thái: {post.audience}</p>
        <section aria-label="Ảnh bài viết">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Ảnh bài viết ({post.images.length}/10)</h3><label className={`cursor-pointer ${buttonClass} ${locked || post.images.length >= 10 ? "pointer-events-none opacity-50" : ""}`}>{uploading ? "Đang tải ảnh..." : "Thêm ảnh"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={locked || post.images.length >= 10} onChange={event => void chooseImages(event)} className="sr-only"/></label></div>
          <CoverImagePicker images={post.images.map(image => ({ id: image.key, url: image.url, name: image.name }))} selectedId={post.images[0]?.key} disabled={locked}
            onSelect={key => { if (locked) return; setNotice(""); setPost({ ...post, images: [...post.images.filter(image => image.key === key), ...post.images.filter(image => image.key !== key)] }); }}
            onRemove={key => { if (locked) return; setNotice(""); setPost({ ...post, images: post.images.filter(image => image.key !== key) }); }}
            onReplace={(key, event) => void chooseImages(event, key)}/>
          {!post.images.length && <p className="mt-2 text-xs text-[#667085]">Chưa có ảnh. Bạn có thể thêm ảnh cho bài viết.</p>}
          <p className="mt-2 text-xs text-[#667085]">Ảnh chỉ được cập nhật trên bài viết khi bấm Lưu thay đổi.</p>
          {uploading && <p role="status" className="mt-2 text-xs text-[#168ac0]"><LoaderCircle size={14} className="mr-1 inline animate-spin"/>Đang xử lý và tải ảnh...</p>}
        </section>
        <label className="block text-sm font-semibold">Tiêu đề<input required maxLength={120} disabled={locked} value={post.title} onChange={event => setPost({ ...post, title: event.target.value })} className="mt-1 w-full rounded-lg border p-2"/></label>
        <label className="block text-sm font-semibold">Nội dung<textarea rows={5} maxLength={1200} disabled={locked} value={post.content} onChange={event => setPost({ ...post, content: event.target.value })} className="mt-1 w-full rounded-lg border p-2"/></label>
        <label className="block text-sm font-semibold">Thông tin kích thước / định dạng<input maxLength={240} disabled={locked} value={post.specifications || ""} onChange={event => setPost({ ...post, specifications: event.target.value })} className="mt-1 w-full rounded-lg border p-2"/></label>
        <label className="block text-sm font-semibold">Phong cách / loại hồ sơ<input maxLength={80} disabled={locked} value={post.listingType || ""} onChange={event => setPost({ ...post, listingType: event.target.value })} className="mt-1 w-full rounded-lg border p-2"/></label>
        <div className="flex flex-wrap gap-2"><button disabled={locked} className={`${buttonClass} bg-[#229ed9] text-white`}>{busy ? "Đang xử lý..." : "Lưu thay đổi"}</button>
          {AUTHOR_POST_STATES.includes(post.audience) && <button type="button" disabled={locked} className={buttonClass} onClick={() => void update({ action: post.audience === OWN_POST_HIDDEN ? "publish" : "hide" })}>{post.audience === OWN_POST_HIDDEN ? "Hiện bài viết" : "Ẩn bài viết"}</button>}
          <button type="button" disabled={locked} className={`${buttonClass} text-rose-700`} onClick={() => setConfirmDelete(true)}>Xóa bài viết</button></div>
        {post.audience === "Ẩn bởi quản trị" && <p className="text-sm text-amber-800">Bài đang bị quản trị viên ẩn. Bạn có thể sửa nội dung nhưng cần quản trị viên duyệt để hiển thị lại.</p>}
        {confirmDelete && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3"><p className="text-sm">{isAdmin ? "Xóa vĩnh viễn bài viết này? Bài đã xóa không thể khôi phục." : "Xóa bài viết khỏi website? Bài đã xóa chỉ được lưu trong quản trị."}</p><div className="mt-2 flex gap-2"><button type="button" disabled={locked} className={buttonClass} onClick={() => setConfirmDelete(false)}>Hủy</button><button type="button" disabled={locked} className={`${buttonClass} text-rose-700`} onClick={() => void update({}, true)}>Xác nhận xóa</button></div></div>}
      </form>}
    </DialogContent></Dialog>
  </>;
}

export function MyPosts({ author }: { author?: { name: string; avatarUrl?: string | null } } = {}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const update = () => { setRevision(value => value + 1); router.refresh(); };
    window.addEventListener(SITE_EVENTS.contentChanged, update);
    return () => window.removeEventListener(SITE_EVENTS.contentChanged, update);
  }, [router]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/my-posts?page=${page}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as PostResponse;
        if (!response.ok) throw new Error(data.error || "Chưa thể tải bài viết.");
        if (controller.signal.aborted) return;
        if (page > data.totalPages) { setPage(data.totalPages); return; }
        setPosts(data.posts); setPages(data.totalPages);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa thể tải bài viết."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    });
    return () => controller.abort();
  }, [page, revision]);
  return <section id="bai-viet-cua-toi" className="mt-5 scroll-mt-24 rounded-2xl border border-[#e3eaf2] bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><FileText size={20}/>Bài viết của tôi</h2></div>
    <p className="mt-2 text-sm text-[#667085]">Quản lý nội dung và ảnh của bài công khai hoặc bài đã ẩn. Bài ẩn có thể hiện lại sau.</p>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}<button type="button" className="ml-2 underline" onClick={() => setRevision(value => value + 1)}>Thử lại</button></p>}
    {loading ? <p role="status" className="py-6 text-sm text-[#667085]"><LoaderCircle size={17} className="mr-2 inline animate-spin"/>Đang tải bài viết...</p> : <div className="mt-4 space-y-4">{posts.map(post => <article key={post.id} id={`my-post-${post.id}`} className="my-profile-post scroll-mt-24 overflow-hidden rounded-xl border border-[#e3eaf2]">
      <div className="p-4"><div className="flex items-center gap-3"><MemberAvatar name={author?.name || "Bạn"} src={author?.avatarUrl} className="size-10"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{author?.name || "Bài viết của bạn"}</p><p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#738094]">{postCategoryLabel(post.category)}<span>·</span>{post.audience === "Công khai" ? <Globe size={12}/> : <LockKeyhole size={12}/>}<span>{post.audience}</span></p></div><MyPostControls postId={post.id} iconOnly/></div><h3 className="mt-4 text-base font-bold">{post.title}</h3>{post.content && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#667085]">{post.content}</p>}</div>
      {post.images?.length > 0 && <div className={`my-profile-post-images grid gap-1 ${post.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>{post.images.slice(0, 2).map((image, index) => <div key={image.key} className="relative overflow-hidden bg-[#f3f6f9]"><img src={image.url} alt={`${post.title} — ảnh ${index + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover"/>{index === 1 && post.images.length > 2 && <span className="absolute inset-0 grid place-items-center bg-black/35 text-3xl font-bold text-white">+{post.images.length - 2}</span>}</div>)}</div>}
      <div className="flex items-center justify-between gap-2 border-t border-[#edf1f5] bg-[#fcfdfe] px-4 py-3"><span className="text-xs text-[#738094]">{post.images?.length ? `${post.images.length} ảnh` : "Bài viết"}</span><MyPostControls postId={post.id}/></div>
    </article>)}{!posts.length && !error && <div className="py-12 text-center"><span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-[#f0f6fa] text-[#89a6bb]"><FileText size={25}/></span><h3 className="text-sm font-bold">Chưa có bài viết</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#738094]">Chia sẻ ý tưởng và kinh nghiệm xây nhà với cộng đồng NhàĐẹpChất.</p><Link href="/" className="mt-4 inline-flex text-sm font-bold text-[#168ac0]">Đi đến bảng tin</Link></div>}</div>}
    {pages > 1 && <nav aria-label="Phân trang bài viết của tôi" className="mt-4 flex items-center justify-center gap-3"><button type="button" disabled={loading || page <= 1} className={buttonClass} onClick={() => setPage(page - 1)}>Trước</button><span className="text-sm">{page} / {pages}</span><button type="button" disabled={loading || page >= pages} className={buttonClass} onClick={() => setPage(page + 1)}>Sau</button></nav>}
  </section>;
}
