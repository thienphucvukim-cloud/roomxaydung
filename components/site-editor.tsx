"use client";
import { SITE_EVENTS } from "@/lib/site-events";
import { createContext, useContext, useEffect, useState, type ChangeEvent, type FormEvent, type ImgHTMLAttributes, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Eye, LoaderCircle, LogOut, Pencil, RotateCcw, Save, Settings2, ShieldCheck, SlidersHorizontal, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { OwnerManagement } from "@/components/owner-management";
import type { ContentValue, SiteContent } from "@/lib/site-content";
import { optimizeImageForUpload } from "@/lib/image-upload";
import { MyPostControls } from "@/components/my-posts";
import { AdminPostControls } from "@/components/admin-post-controls";

type Selection = { key: string; kind: ContentValue["kind"]; fallback: string; label: string };
type EditorContext = { content: SiteContent; editing: boolean; isOwner: boolean; accountSwitchBlocked: boolean; memberId?: string; select: (selection: Selection) => void; manage: (tab: string, id?: number) => void; saveContent: (changes: Record<string, ContentValue>) => Promise<void> };
const Editor = createContext<EditorContext>({ content: {}, editing: false, isOwner: false, accountSwitchBlocked: false, select: () => {}, manage: () => {}, saveContent: async () => { throw new Error("Chưa thể lưu nội dung."); } });
export function useSiteEditor() { return useContext(Editor); }
export function OwnerPostControls({ postId, authorId }: { postId: number; authorId?: string }) {
  const editor = useSiteEditor();
  if (editor.isOwner) return <AdminPostControls postId={postId} onEdit={() => editor.manage("noi-dung", postId)}/>;
  if (authorId && editor.memberId === authorId) return <MyPostControls postId={postId} iconOnly/>;
  return null;
}
export function EditableText({ contentKey, children, label = "Chỉnh sửa nội dung" }: { contentKey: string; children: string; label?: string }) {
  const { content, editing, select } = useSiteEditor();
  const value = content[contentKey]?.kind === "text" ? content[contentKey].value : children;
  return <span data-site-key={contentKey} className={editing ? "site-editable-text" : undefined} role={editing ? "button" : undefined} tabIndex={editing ? 0 : undefined} title={editing ? label : undefined} onClick={editing ? event => { event.preventDefault(); event.stopPropagation(); select({ key: contentKey, kind: "text", fallback: children, label }); } : undefined} onKeyDown={editing ? event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); select({ key: contentKey, kind: "text", fallback: children, label }); } } : undefined}>{value}</span>;
}
export function EditableImage({ contentKey, src = "", alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement> & { contentKey: string; src: string }) {
  const { content, editing, select } = useSiteEditor();
  return <img loading={contentKey === "global.logo" ? "eager" : "lazy"} decoding="async" {...props} src={content[contentKey]?.kind === "image" ? content[contentKey].value : src} alt={alt} data-site-image={contentKey} className={`${props.className || ""} ${editing ? "site-editable-image" : ""}`} title={editing ? "Nhấn để thay ảnh" : props.title} role={editing ? "button" : undefined} tabIndex={editing ? 0 : undefined} onClick={editing ? event => { event.preventDefault(); event.stopPropagation(); select({ key: contentKey, kind: "image", fallback: src, label: "Thay ảnh trên website" }); } : props.onClick} onKeyDown={editing ? event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); select({ key: contentKey, kind: "image", fallback: src, label: "Thay ảnh trên website" }); } } : props.onKeyDown}/>;
}
export function OwnerWorkspace({ initialContent, children }: { initialContent: SiteContent; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [saved, setSaved] = useState(initialContent);
  const [drafts, setDrafts] = useState<Record<string, ContentValue | null>>({});
  const [editing, setEditing] = useState(false);
  const [owner, setOwner] = useState<{ name: string; isAdmin?: boolean } | null>(null);
  const [memberId, setMemberId] = useState<string>();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [input, setInput] = useState("");
  const [tab, setTab] = useState("");
  const [selectedPost, setSelectedPost] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [modalError, setModalError] = useState("");
  const [statusError, setStatusError] = useState(false);
  const content = { ...saved };
  for (const [key, value] of Object.entries(drafts)) { if (value === null) delete content[key]; else content[key] = value; }
  const count = Object.keys(drafts).length;
  const authPage = ["/admin", "/dang-nhap", "/dang-ky", "/quen-mat-khau"].includes(pathname);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site-content", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ content: SiteContent }> : Promise.reject())
      .then(data => { if (!controller.signal.aborted) setSaved(data.content); })
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener(SITE_EVENTS.contentChanged, refresh);
    return () => window.removeEventListener(SITE_EVENTS.contentChanged, refresh);
  }, [router]);
  useEffect(() => {
    if (authPage) return;
    const controller = new AbortController();
    fetch("/api/me", { cache: "no-store", signal: controller.signal }).then(response => response.json() as Promise<{ user?: { id: string; name: string; isAdmin?: boolean } }>).then(data => {
      if (!controller.signal.aborted) setMemberId(data.user?.id);
      setOwner(data.user || null);
      if (data.user?.isAdmin) {
        const requested = new URLSearchParams(window.location.search).get("quan-ly");
        if (["noi-dung", "yeu-cau", "thanh-vien", "giao-dich", "cai-dat"].includes(requested || "")) setTab(requested!);
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [pathname, authPage]);
  useEffect(() => {
    if (!count) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [count]);
  function select(next: Selection) { setSelection(next); setInput(content[next.key]?.value ?? next.fallback); setModalError(""); }
  function stage(event: FormEvent) { event.preventDefault(); if (!selection) return; setDrafts(current => ({ ...current, [selection.key]: { kind: selection.kind, value: input } })); setSelection(null); setNotice("Đã cập nhật bản xem trước. Nhấn Lưu website để áp dụng."); setStatusError(false); }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 25 * 1024 * 1024) { setModalError("Chọn ảnh JPG, PNG, WebP hoặc GIF, tối đa 25 MB."); return; }
    setUploading(true); setModalError("");
    try {
      const body = new FormData(); body.append("file", await optimizeImageForUpload(file)); body.append("purpose", "drawing-preview");
      const response = await fetch("/api/files", { method: "POST", body });
      const result = await response.json() as { error?: string; attachment?: { url?: string } };
      if (!response.ok || !result.attachment?.url) throw new Error(result.error || "Chưa thể tải ảnh.");
      setInput(result.attachment.url);
    } catch (cause) { setModalError(cause instanceof Error ? cause.message : "Chưa thể tải ảnh."); } finally { setUploading(false); }
  }
  async function save() {
    if (!count || saving) return;
    setSaving(true); setNotice(""); setStatusError(false);
    try {
      const response = await fetch("/api/site-content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes: Object.entries(drafts).map(([key, value]) => ({ key, content: value })) }) });
      const result = await response.json() as { error?: string; content?: SiteContent }; if (!response.ok || !result.content) throw new Error(result.error || "Chưa thể lưu website.");
      setSaved(result.content); setDrafts({}); setNotice("Đã lưu website. Nội dung mới đã được cập nhật cho mọi người.");
    } catch (cause) { setStatusError(true); setNotice(cause instanceof Error ? cause.message : "Chưa thể lưu."); } finally { setSaving(false); }
  }
  const manage = (next: string, id?: number) => { setTab(next); setSelectedPost(id); };
  async function saveContent(changes: Record<string, ContentValue>) {
    const response = await fetch("/api/site-content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes: Object.entries(changes).map(([key, value]) => ({ key, content: value })) }) });
    const result = await response.json() as { error?: string; content?: SiteContent };
    if (!response.ok || !result.content) throw new Error(result.error || "Chưa thể lưu bài demo.");
    setSaved(result.content);
    setDrafts(current => Object.fromEntries(Object.entries(current).filter(([key]) => !Object.hasOwn(changes, key))));
    window.dispatchEvent(new Event(SITE_EVENTS.contentChanged));
  }
  const isOwner = Boolean(owner?.isAdmin);
  return <Editor.Provider value={{ content, editing: editing && isOwner && !authPage, isOwner, accountSwitchBlocked: saving || count > 0, memberId: authPage ? undefined : memberId, select, manage, saveContent }}><div className={`owner-site ${isOwner && !authPage ? "has-owner-toolbar" : ""}`} style={{ "--site-accent": content["global.accent"]?.value || "#229ed9" } as React.CSSProperties}>
    {isOwner && !authPage && <div className="owner-toolbar" role="region" aria-label="Công cụ chủ website"><div className="owner-toolbar-inner"><span className="owner-identity"><ShieldCheck size={17}/><strong>Website của bạn</strong></span><span className="owner-toolbar-divider"/>
      <button type="button" className={editing ? "owner-tool active" : "owner-tool"} onClick={() => setEditing(!editing)} disabled={saving}>{editing ? <Eye size={16}/> : <Pencil size={16}/>}<span>{editing ? "Xem trước" : "Chỉnh sửa"}</span></button>
      <button type="button" className="owner-tool" onClick={() => manage("noi-dung")} disabled={saving}><SlidersHorizontal size={16}/><span>Quản lý</span></button>
      <button type="button" className="owner-tool" onClick={() => manage("cai-dat")} disabled={saving}><Settings2 size={16}/><span>Cài đặt</span></button>
      <span className="owner-save-status">{count ? `${count} thay đổi chưa lưu` : "Mọi thay đổi đã lưu"}</span>
      {count > 0 && <button type="button" className="owner-tool" disabled={saving} onClick={() => { setDrafts({}); setNotice("Đã bỏ các thay đổi chưa lưu."); setStatusError(false); }} title="Bỏ thay đổi chưa lưu" aria-label="Bỏ thay đổi chưa lưu"><RotateCcw size={15}/></button>}
      <button type="button" className="owner-save" disabled={!count || saving} onClick={() => void save()}>{saving ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/>}<span>{saving ? "Đang lưu" : "Lưu website"}</span></button>
      <form action="/api/auth/logout" method="post"><button className="owner-tool" disabled={saving || count > 0} title={count ? "Lưu hoặc bỏ thay đổi trước khi đăng xuất" : "Đăng xuất"} aria-label="Đăng xuất"><LogOut size={15}/></button></form>
    </div></div>}
    {editing && isOwner && !authPage && <div className="owner-edit-hint"><Pencil size={14}/><span>Nhấn vào chữ hoặc ảnh có viền để chỉnh sửa. Bạn có thể chuyển trang rồi lưu tất cả thay đổi.</span><button type="button" onClick={() => setEditing(false)} aria-label="Đóng hướng dẫn"><X size={15}/></button></div>}
    {children}
    {notice && isOwner && <div className={`owner-notice ${statusError ? "error" : ""}`} role={statusError ? "alert" : "status"}>{statusError ? <X size={16}/> : <Check size={16}/>}<span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Đóng thông báo"><X size={15}/></button></div>}
    <Dialog open={Boolean(selection)} onOpenChange={open => { if (!open && !uploading) setSelection(null); }}><DialogContent className="rounded-2xl bg-white"><DialogTitle>{selection?.label}</DialogTitle><DialogDescription>Thay đổi sẽ xuất hiện trong bản xem trước. Nhấn “Lưu website” để cập nhật công khai.</DialogDescription><form onSubmit={stage} className="owner-edit-form">
      {selection?.kind === "image" ? <><div className="owner-image-preview"><img src={input || selection.fallback} alt="Ảnh xem trước"/></div><label className="owner-upload"><Upload size={17}/>{uploading ? "Đang tải ảnh..." : "Chọn ảnh từ máy"}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => void upload(event)} disabled={uploading}/></label><label>Hoặc dán đường dẫn ảnh<input value={input} onChange={event => setInput(event.target.value)} placeholder="https://... hoặc /anh.png" required maxLength={1024} disabled={uploading}/></label></> : selection?.kind === "color" ? <label>Màu chủ đạo<input type="color" value={input} onChange={event => setInput(event.target.value)}/></label> : <label>Nội dung<textarea value={input} onChange={event => setInput(event.target.value)} rows={5} maxLength={5000} autoFocus/></label>}
      {modalError && <p className="owner-edit-error" role="alert">{modalError}</p>}<div className="owner-edit-actions"><button type="button" className="owner-secondary" disabled={uploading} onClick={() => { if (selection) setDrafts(current => ({ ...current, [selection.key]: null })); setSelection(null); }}>Khôi phục mặc định</button><button className="owner-primary" type="submit" disabled={uploading}><Check size={16}/>Áp dụng</button></div>
    </form></DialogContent></Dialog>
    <Dialog open={Boolean(tab)} onOpenChange={open => { if (!open) setTab(""); }}><DialogContent className="owner-management-dialog"><DialogTitle>Quản lý website của bạn</DialogTitle><DialogDescription>Nội dung, thành viên và giao dịch ngay tại website.</DialogDescription><OwnerManagement tab={tab} onTabChange={next => manage(next)} selectedPost={selectedPost} onEditSiteSetting={(key, kind, fallback, label) => { setTab(""); setEditing(true); select({ key, kind, fallback, label }); }}/></DialogContent></Dialog>
  </div></Editor.Provider>;
}
