"use client";
import { OwnerPostControls, useSiteEditor } from "@/components/site-editor";

import { ChangeEvent, FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { FileText, HardHat, LoaderCircle, LockKeyhole, Plus, Ruler, Search, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { CatalogPagination } from "@/components/catalog-pagination";
import { catalogPageHref, catalogPageWindow } from "@/lib/catalog-pagination";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RequestActionButton } from "@/components/interactive-actions";
import { PurchaseActionButton } from "@/components/purchase-action-button";

type ProfessionalRole = "engineer" | "architect";
type Attachment = { key: string; name: string; type: string; size: number; url?: string; accessType?: "public" | "private" };
type Post = { id: number; userId: string; authorName: string; title: string; content: string; category: string; location?: string | null; feeling?: string | null; pollQuestion?: string | null; attachments?: Attachment[] };
type CatalogCard = { key: string; search: string; card: ReactNode; contentPrefix?: string };
export function DrawingCommunity({ variant = "drawing", page = 1, searchQuery = "", catalogCards = [] }: {
  variant?: "drawing" | "interior"; page?: number; searchQuery?: string; catalogCards?: CatalogCard[];
}) {
  const router = useRouter();
  const editor = useSiteEditor();
  const basePath = variant === "interior" ? "/noi-that" : "/file-ban-ve-nha-dep-tipook";
  const [totalPosts, setTotalPosts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const category = variant === "interior" ? "Nội thất cộng đồng" : "Bản vẽ cộng đồng";
  const itemLabel = variant === "interior" ? "hồ sơ nội thất" : "bản vẽ";
  const itemTitle = variant === "interior" ? "Hồ sơ nội thất" : "Bản vẽ";
  const marketLabel = variant === "interior" ? "Nội thất" : "Kho bản vẽ";
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState(searchQuery);
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [professionalRole, setProfessionalRole] = useState<ProfessionalRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<ProfessionalRole | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [drawingType, setDrawingType] = useState("");
  const [format, setFormat] = useState("");
  const [price, setPrice] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [drawingFiles, setDrawingFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const drawingFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const update = () => setRefresh(value => value + 1); window.addEventListener("tipook-content-changed", update); return () => window.removeEventListener("tipook-content-changed", update); }, []);
  useEffect(() => {
    fetch("/api/professional-profile").then((response) => response.ok ? response.json() as Promise<{ profile?: { accountType?: string } }> : Promise.reject()).then((data) => {
      const accountType = data.profile?.accountType;
      setProfessionalRole(accountType === "engineer" || accountType === "architect" ? accountType : null);
    }).catch(() => {}).finally(() => setProfileLoaded(true));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ category, page: String(page), q: searchQuery });
    fetch("/api/posts?" + params, { signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ posts?: Post[]; total?: number }> : Promise.reject())
      .then(data => { setPosts(data.posts ?? []); setTotalPosts(data.total ?? 0); })
      .catch(() => { if (!controller.signal.aborted) setNotice(`Chưa thể tải ${itemLabel} cộng đồng.`); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, page, searchQuery, refresh, itemLabel]);

  const normalized = searchQuery.toLocaleLowerCase("vi");
  const filteredCards = catalogCards.filter(card => !normalized || [card.search, ...Object.entries(editor.content).filter(([key]) => card.contentPrefix && key.startsWith(card.contentPrefix + ".")).map(([, item]) => item.value)].join(" ").toLocaleLowerCase("vi").includes(normalized));
  const pagination = catalogPageWindow(page, totalPosts, filteredCards.length);
  const visibleCards = filteredCards.slice(pagination.modelStart, pagination.modelEnd);
  const visiblePosts = posts;
  const submitSearch = (event: FormEvent) => { event.preventDefault(); router.push(catalogPageHref(basePath, 1, query)); };

  const chooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    if (files.length + selected.length > 10) { setNotice(`Mỗi ${itemLabel} được chọn tối đa 10 ảnh đại diện.`); return; }
    setUploading(true); setNotice("");
    try {
      const uploaded: Attachment[] = [];
      for (const file of selected) {
        const form = new FormData(); form.append("file", file); form.append("purpose", "drawing-preview");
        const response = await fetch("/api/files", { method: "POST", body: form });
        const data = await response.json() as { error?: string; attachment?: Attachment };
        if (!response.ok || !data.attachment) throw new Error(data.error || "Không thể tải tệp.");
        uploaded.push(data.attachment);
      }
      setFiles((current) => [...current, ...uploaded]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể tải tệp."); }
    finally { setUploading(false); }
  };

  const chooseDrawingFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    if (drawingFiles.length + selected.length > 5) { setNotice(`Mỗi ${itemLabel} được đính kèm tối đa 5 file bán.`); return; }
    setUploading(true); setNotice("");
    try {
      const uploaded: Attachment[] = [];
      for (const file of selected) {
        const form = new FormData(); form.append("file", file); form.append("purpose", "drawing-file");
        const response = await fetch("/api/files", { method: "POST", body: form });
        const data = await response.json() as { error?: string; attachment?: Attachment };
        if (!response.ok || !data.attachment) throw new Error(data.error || `Không thể tải file ${itemLabel}.`);
        uploaded.push(data.attachment);
      }
      setDrawingFiles((current) => [...current, ...uploaded]);
    } catch (error) { setNotice(error instanceof Error ? error.message : `Không thể tải file ${itemLabel}.`); }
    finally { setUploading(false); }
  };
  const upgradeAccount = async () => {
    if (!selectedRole || upgrading) return;
    setUpgrading(true); setUpgradeNotice("");
    try {
      const response = await fetch("/api/professional-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountType: selectedRole }) });
      const data = await response.json() as { error?: string; profile?: { accountType?: string } };
      const accountType = data.profile?.accountType;
      if (!response.ok || (accountType !== "engineer" && accountType !== "architect")) throw new Error(data.error || "Chưa thể chuyển loại tài khoản.");
      setProfessionalRole(accountType);
      setUpgradeOpen(false);
      setOpen(true);
    } catch (error) { setUpgradeNotice(error instanceof Error ? error.message : "Chưa thể chuyển loại tài khoản."); }
    finally { setUpgrading(false); }
  };
  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!drawingFiles.length) { setNotice(`Vui lòng chọn ít nhất một file ${itemLabel}.`); return; }
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), content: description.trim(), category, audience: "Công khai", feeling: drawingType.trim(), location: format.trim(), pollQuestion: price.trim(), attachments: files.map(({ key, name, type, size }) => ({ key, name, type, size })), paidFiles: drawingFiles.map(({ key, name, type, size }) => ({ key, name, type, size })) }) });
      const data = await response.json() as { error?: string; post?: Post };
      if (!response.ok || !data.post) throw new Error(data.error || `Chưa thể đăng ${itemLabel}.`);
      if (page === 1 && !searchQuery) setRefresh(current => current + 1); else router.push(catalogPageHref(basePath, 1));
      setTitle(""); setDescription(""); setDrawingType(""); setFormat(""); setPrice(""); setFiles([]); setDrawingFiles([]); setOpen(false); setNotice(`${itemTitle} đã được đăng.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : `Chưa thể đăng ${itemLabel}.`); }
    finally { setSaving(false); }
  };

  return <>
    <section className="grid grid-cols-[62px_minmax(0,1fr)] gap-3">
      <button id="catalog-publish" type="button" disabled={!profileLoaded} onClick={() => professionalRole ? setOpen(true) : setUpgradeOpen(true)} className="grid size-[62px] place-items-center rounded-2xl border border-[#dfe5eb] bg-white text-[#168ac0] shadow-sm transition hover:border-[#b9dceb] hover:bg-[#f7fbfd] disabled:cursor-wait disabled:opacity-70" aria-label={`Đăng ${itemLabel} của bạn`} title={`Đăng ${itemLabel} của bạn`}>
        <Plus size={26} strokeWidth={2.25}/>
      </button>
      <form onSubmit={submitSearch} className="flex h-[62px] items-center gap-3 rounded-2xl border border-[#dfe5eb] bg-white px-5 shadow-sm focus-within:border-[#229ed9] focus-within:ring-2 focus-within:ring-[#229ed9]/10">
        <Search size={20} className="shrink-0 text-[#667085]"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#182230] outline-none placeholder:text-[#98a2b3]" placeholder={`Tìm tên ${itemLabel}, loại hồ sơ hoặc định dạng...`} aria-label={`Tìm kiếm ${itemLabel}`} maxLength={120}/>
        {query && <button type="button" onClick={() => { setQuery(""); router.push(catalogPageHref(basePath, 1)); }} className="grid size-8 place-items-center rounded-full text-[#667085] hover:bg-[#f2f4f7]" aria-label="Xóa tìm kiếm"><X size={17}/></button>}
        <button type="submit" className="shrink-0 text-sm font-bold text-[#168ac0]">Tìm</button>
      </form>
    </section>

    {loading && <p role="status" className="mt-5 text-center text-sm text-[#667085]">Đang tải {itemLabel}...</p>}
    {!loading && <section className="mt-5 grid gap-x-5 gap-y-9 rounded-2xl border border-[#dfe5eb] bg-white p-4 sm:grid-cols-2 sm:p-5 md:grid-cols-3 lg:grid-cols-4" aria-label={`Danh sách ${marketLabel}`}>
      {visiblePosts.map((post) => { const preview = post.attachments?.find((item) => item.type.startsWith("image/")); return <article key={post.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e3eaf2]">{preview ? <img src={preview.url} alt={post.title} className="aspect-[4/3] w-full shrink-0 object-cover"/> : <div className="grid aspect-[4/3] shrink-0 place-items-center bg-[#f3f6f9] text-[#168ac0]"><FileText size={42}/></div>}<p className="truncate border-b border-[#eef1f4] px-4 py-3 text-xs text-[#667085]">Đăng bởi <a href={`/nguoi-dung/${encodeURIComponent(post.userId)}`} className="font-bold text-[#168ac0] hover:underline">{post.authorName}</a></p><div className="flex flex-1 flex-col p-4"><span className="min-h-4 text-xs font-bold text-[#168ac0]">{post.feeling}</span><OwnerPostControls postId={post.id}/><h3 className="catalog-card-title mt-1 line-clamp-2 font-extrabold">{post.title}</h3><p className="catalog-card-detail mt-2 text-sm text-[#667085]">{post.location}{post.pollQuestion ? " · " + post.pollQuestion : ""}</p><p className="catalog-card-detail mt-2 line-clamp-2 text-sm text-[#667085]">{post.content}</p><div className="mt-auto flex items-center justify-end gap-3 pt-3"><span className="flex shrink-0 items-center gap-1.5"><RequestActionButton requestType="drawing-file-request" targetType="post" targetId={String(post.id)} recipientUserId={post.userId} label="Yêu cầu file" title={"Yêu cầu file: " + post.title} description={`Tin nhắn sẽ được gửi trực tiếp đến người đăng ${itemLabel}.`} iconOnly="file" className="grid size-9 place-items-center rounded-full border border-[#cfeaf5] bg-[#f1faff] text-[#168ac0] transition hover:border-[#229ed9] hover:bg-[#e2f5fc]"/><PurchaseActionButton targetType="post" targetId={String(post.id)} title={post.title} price={post.pollQuestion || "Miễn phí"} label={!post.pollQuestion ? "Tải miễn phí" : undefined} className="grid size-9 place-items-center rounded-full bg-[#229ed9] text-white transition hover:bg-[#168ac0]"/></span></div></div></article>; })}
      {visibleCards.map(card => <div key={card.key} className="min-w-0 [&>article]:h-full">{card.card}</div>)}
      {visiblePosts.length === 0 && visibleCards.length === 0 && <div className="col-span-full p-6 text-center text-sm text-[#667085]">{searchQuery ? `Không tìm thấy ${itemLabel} phù hợp trên trang này.` : `Trang này chưa có ${itemLabel}. Nhấn dấu + để đăng hồ sơ.`}</div>}
    </section>}
    {notice && <p role="status" className={`mt-3 text-center text-sm font-semibold ${notice.includes("đã được đăng") ? "text-emerald-600" : "text-rose-600"}`}>{notice}</p>}
    {!loading && <CatalogPagination basePath={basePath} page={page} totalPages={pagination.totalPages} total={pagination.total} query={searchQuery} label={itemLabel} />}

    <Dialog open={upgradeOpen} onOpenChange={(next) => { setUpgradeOpen(next); if (!next) { setSelectedRole(null); setUpgradeNotice(""); } }}><DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] max-w-[520px] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0"><header className="relative border-b px-14 py-4 text-center"><DialogTitle className="text-xl font-extrabold text-[#0b2e59]">Chuyển sang tài khoản chuyên môn</DialogTitle><DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose></header><div className="p-5"><p className="text-sm leading-6 text-[#667085]">Để đăng và bán {itemLabel}, bạn cần xác nhận vai trò chuyên môn. Thao tác này chỉ thực hiện một lần; các lần sau form đăng sẽ mở trực tiếp.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setSelectedRole("engineer")} className={`rounded-2xl border p-4 text-left transition ${selectedRole === "engineer" ? "border-[#229ed9] bg-[#eef9fd] ring-2 ring-[#229ed9]/15" : "border-[#dfe5eb] hover:border-[#8fcfe8]"}`}><HardHat size={26} className="text-[#168ac0]"/><strong className="mt-3 block text-[#0b2e59]">Kỹ sư</strong><span className="mt-1 block text-xs leading-5 text-[#667085]">Đăng hồ sơ kết cấu, kỹ thuật và {itemLabel} thi công.</span></button><button type="button" onClick={() => setSelectedRole("architect")} className={`rounded-2xl border p-4 text-left transition ${selectedRole === "architect" ? "border-[#229ed9] bg-[#eef9fd] ring-2 ring-[#229ed9]/15" : "border-[#dfe5eb] hover:border-[#8fcfe8]"}`}><Ruler size={26} className="text-[#168ac0]"/><strong className="mt-3 block text-[#0b2e59]">Kiến trúc sư</strong><span className="mt-1 block text-xs leading-5 text-[#667085]">Đăng thiết kế kiến trúc, mặt bằng và phối cảnh.</span></button></div>{upgradeNotice && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{upgradeNotice}</p>}<button type="button" onClick={() => void upgradeAccount()} disabled={!selectedRole || upgrading} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">{upgrading && <LoaderCircle size={18} className="animate-spin"/>}Xác nhận và tiếp tục đăng</button></div></DialogContent></Dialog>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent showCloseButton={false} className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[560px] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0"><header className="relative border-b px-14 py-4 text-center"><DialogTitle className="text-xl font-extrabold">Đăng {itemLabel}</DialogTitle><DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose></header><form onSubmit={publish} className="min-h-0 overflow-y-auto p-4"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder={`Tên ${itemLabel} (không bắt buộc)`}/><div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={drawingType} onChange={(event) => setDrawingType(event.target.value)} maxLength={60} className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Loại hồ sơ (không bắt buộc)"/><input value={format} onChange={(event) => setFormat(event.target.value)} maxLength={100} className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Định dạng (không bắt buộc)"/></div><input value={price} onChange={(event) => setPrice(event.target.value)} maxLength={40} className="mt-3 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Giá bán (không bắt buộc)"/><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={4} className="mt-3 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-[#229ed9]" placeholder={`Mô tả ${itemLabel} (không bắt buộc)...`}/><section className="mt-4"><div className="flex items-end justify-between gap-3"><div><h3 className="text-sm font-extrabold text-[#182230]">Ảnh đại diện công khai <span className="font-medium text-[#667085]">(không bắt buộc)</span></h3><p className="mt-0.5 text-xs text-[#667085]">Tối đa 10 ảnh, hiển thị trực tiếp trên {marketLabel}.</p></div><span className="text-xs font-bold text-[#168ac0]">{files.length}/10</span></div><input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={chooseFiles}/><button type="button" onClick={() => inputRef.current?.click()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#8fcfe8] bg-[#f7fbfd] px-4 py-3 text-sm font-bold text-[#147aa8]"><Upload size={18}/>{uploading ? "Đang tải lên Cloudflare..." : "Chọn ảnh đại diện"}</button>{files.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{files.map((file) => <div key={file.key} className="relative aspect-square overflow-hidden rounded-xl bg-[#eef2f6]">{file.url ? <img src={file.url} alt={file.name} className="size-full object-cover"/> : <FileText className="m-auto" size={20}/>}<button type="button" onClick={() => setFiles((current) => current.filter((item) => item.key !== file.key))} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/65 text-white" aria-label="Bỏ ảnh"><X size={14}/></button></div>)}</div>}</section><section className="mt-4 rounded-xl border border-[#dfe8f1] bg-[#fafcfe] p-3"><div className="flex items-start gap-2"><LockKeyhole size={19} className="mt-0.5 shrink-0 text-[#168ac0]"/><div><h3 className="text-sm font-extrabold text-[#182230]">File {itemLabel} <span className="text-rose-600">*</span></h3><p className="mt-0.5 text-xs leading-5 text-[#667085]"><b className="text-rose-600">Bắt buộc.</b> File được lưu riêng tư trên Cloudflare; link tải có hiệu lực 24 giờ sau thanh toán.</p></div></div><input ref={drawingFileInputRef} type="file" multiple className="hidden" onChange={chooseDrawingFiles}/><button type="button" onClick={() => drawingFileInputRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#8fcfe8] bg-white px-4 py-3 text-sm font-bold text-[#147aa8]"><Upload size={18}/>{uploading ? "Đang tải lên Cloudflare..." : `Chọn file ${itemLabel} (${drawingFiles.length}/5)`}</button>{drawingFiles.length > 0 && <div className="mt-3 space-y-2">{drawingFiles.map((file) => <div key={file.key} className="flex items-center gap-2 rounded-lg bg-[#eef3f7] px-3 py-2 text-sm"><LockKeyhole size={16} className="shrink-0 text-[#168ac0]"/><span className="min-w-0 flex-1 truncate">{file.name}</span><button type="button" onClick={() => setDrawingFiles((current) => current.filter((item) => item.key !== file.key))} aria-label="Bỏ file"><X size={16}/></button></div>)}</div>}</section>{notice && !notice.includes("đã được đăng") && <p className="mt-3 text-sm font-semibold text-rose-600">{notice}</p>}<button disabled={saving || uploading} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] text-sm font-extrabold text-white disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={18}/> : <Upload size={18}/>}Đăng {itemLabel}</button></form></DialogContent></Dialog>
  </>;
}
