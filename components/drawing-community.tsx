"use client";
import { OwnerPostControls, useSiteEditor } from "@/components/site-editor";
import { demoPostVisible } from "@/lib/demo-posts";
import { usePostAnchor } from "@/components/use-post-anchor";

import { ChangeEvent, FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownToLine, FileText, HardHat, LoaderCircle, LockKeyhole, Ruler, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { CatalogPromotionFields, type PromotionSelection } from "@/components/catalog-promotion-fields";
import { FILE_CATALOG_PAGE_SIZE, placePromotedItems } from "@/lib/catalog-promotions";
import { CatalogPagination } from "@/components/catalog-pagination";
import { CatalogToolbar } from "@/components/catalog-toolbar";
import { CatalogEngagementStats } from "@/components/catalog-engagement";
import { catalogPageHref, catalogPageWindow } from "@/lib/catalog-pagination";
import { optimizeImageForUpload } from "@/lib/image-upload";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RequestActionButton, ShareActionButton, ToggleActionButton } from "@/components/interactive-actions";
import { PurchaseActionButton } from "@/components/purchase-action-button";
import { ProjectGallery } from "@/components/project-gallery";
import { FILE_CATALOG_SORT_OPTIONS, parseFileCatalogSort, type FileCatalogSort } from "@/lib/file-catalog-sort";
import { parseVndPrice } from "@/lib/drawing-catalog";

type ProfessionalRole = "engineer" | "architect";
type Attachment = { key: string; name: string; type: string; size: number; url?: string; accessType?: "public" | "private" };
type Post = { promotionPosition?: number | null; downloads?: number; id: number; userId: string; authorName: string; title: string; content: string; category: string; location?: string | null; feeling?: string | null; pollQuestion?: string | null; attachments?: Attachment[] };
type CatalogCard = { key: string; search: string; card: ReactNode; contentPrefix?: string };
export function DrawingCommunity({ variant = "drawing", page = 1, searchQuery = "", targetPostId, catalogCards = [], sort = "latest" }: {
  variant?: "drawing" | "interior"; page?: number; searchQuery?: string; targetPostId?: string; catalogCards?: CatalogCard[]; sort?: FileCatalogSort;
}) {
  const router = useRouter();
  const editor = useSiteEditor();
  const basePath = variant === "interior" ? "/noi-that" : "/file-ban-ve-nha-dep-chat";
  const [totalPosts, setTotalPosts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const category = variant === "interior" ? "Nội thất cộng đồng" : "Bản vẽ cộng đồng";
  const itemLabel = variant === "interior" ? "hồ sơ nội thất" : "bản vẽ";
  const itemTitle = variant === "interior" ? "Hồ sơ nội thất" : "Bản vẽ";
  const marketLabel = variant === "interior" ? "Nội thất" : "Kho bản vẽ";
  const filterGroups = variant === "interior"
    ? [
      { label: "Không gian", options: ["Phòng khách", "Phòng ngủ", "Bếp", "Phòng tắm", "Văn phòng"] },
      { label: "Phong cách", options: ["Hiện đại", "Tối giản", "Tân cổ điển", "Scandinavian", "Japandi"] },
      { label: "Định dạng", options: ["CAD", "DWG", "SketchUp", "3D", "PDF"] },
    ]
    : [
      { label: "Loại công trình", options: ["Nhà phố", "Nhà cấp 4", "Biệt thự", "Nhà vườn", "Văn phòng"] },
      { label: "Số tầng", options: ["1 tầng", "2 tầng", "3 tầng", "4 tầng"] },
      { label: "Định dạng", options: ["CAD", "DWG", "SketchUp", "Revit", "PDF"] },
    ];
  const [posts, setPosts] = useState<Post[]>([]);
  const [catalogOrder, setCatalogOrder] = useState<string[] | null>(null);
  usePostAnchor(posts);
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
  const [promotion, setPromotion] = useState<PromotionSelection | null>(null);
  const [pendingPostId, setPendingPostId] = useState<number | null>(null);
  const [promotionAvailabilityVersion, setPromotionAvailabilityVersion] = useState(0);
  const promotionRequestId = useRef<string | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [coverImageKey, setCoverImageKey] = useState<string>();
  const [drawingFiles, setDrawingFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const drawingFileInputRef = useRef<HTMLInputElement>(null);
  const normalized = searchQuery.toLocaleLowerCase("vi");
  const filteredCards = targetPostId ? [] : catalogCards.filter(card => demoPostVisible(editor.content, card.contentPrefix, editor.isOwner) && (!normalized || [card.search, ...Object.entries(editor.content).filter(([key]) => card.contentPrefix && key.startsWith(card.contentPrefix + ".")).map(([, item]) => item.value)].join(" ").toLocaleLowerCase("vi").includes(normalized)));
  const modelKeys = JSON.stringify(filteredCards.map(card => card.key));

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
    if (sort !== "latest") { params.set("sort", sort); params.set("modelKeys", modelKeys); }
    if (targetPostId) params.set("postId", targetPostId);
    fetch("/api/posts?" + params, { signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ posts?: Post[]; total?: number; catalogOrder?: string[] }> : Promise.reject())
      .then(data => { if (!controller.signal.aborted) { setPosts(data.posts ?? []); setTotalPosts(data.total ?? 0); setCatalogOrder(data.catalogOrder ?? null); } })
      .catch(() => { if (!controller.signal.aborted) setNotice(`Chưa thể tải ${itemLabel} cộng đồng.`); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, page, searchQuery, targetPostId, refresh, itemLabel, sort, modelKeys]);

  const pagination = catalogPageWindow(page, totalPosts, filteredCards.length, FILE_CATALOG_PAGE_SIZE);
  const visibleCards = catalogOrder ? filteredCards.filter(card => catalogOrder.includes("drawing:" + card.key)) : filteredCards.slice(pagination.modelStart, pagination.modelEnd);
  const visiblePosts = posts;
  const entries: ({ post: Post; card?: never } | { card: CatalogCard; post?: never })[] = [...visiblePosts.map(post => ({ post })), ...visibleCards.map(card => ({ card }))];
  const entryByKey = new Map(entries.map(entry => [entry.post ? "post:" + entry.post.id : "drawing:" + entry.card.key, entry]));
  const visibleEntries = catalogOrder ? catalogOrder.flatMap(key => { const entry = entryByKey.get(key); return entry ? [entry] : []; }) : page === 1 && !searchQuery ? placePromotedItems(entries, entry => entry.post?.promotionPosition) : entries;
  const submitSearch = (event: FormEvent) => { event.preventDefault(); router.push(catalogPageHref(basePath, 1, query, sort)); };

  const chooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length || uploading || saving || pendingPostId !== null) return;
    if (files.length + selected.length > 10) { setNotice(`Mỗi ${itemLabel} được chọn tối đa 10 ảnh đại diện.`); return; }
    setUploading(true); setNotice("");
    try {
      for (const file of selected) {
        const form = new FormData(); form.append("file", await optimizeImageForUpload(file)); form.append("purpose", "drawing-preview");
        const response = await fetch("/api/files", { method: "POST", body: form });
        const data = await response.json() as { error?: string; attachment?: Attachment };
        if (!response.ok || !data.attachment) throw new Error(data.error || "Không thể tải tệp.");
        const attachment = data.attachment;
        setFiles((current) => [...current, attachment]);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể tải tệp."); }
    finally { setUploading(false); }
  };

  const removeImage = (key: string) => {
    if (saving || uploading || pendingPostId !== null) return;
    setFiles((current) => current.filter((file) => file.key !== key));
    if (coverImageKey === key) setCoverImageKey(undefined);
  };

  const chooseDrawingFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length || uploading || saving || pendingPostId !== null) return;
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
    if (saving || uploading) return;
    if (promotion && (!Number.isInteger(promotion.position) || promotion.position < 1 || promotion.position > 16 || !Number.isInteger(promotion.months) || promotion.months < 1 || promotion.months > 12)) { setNotice("Vui lòng chọn vị trí và số tháng quảng cáo hợp lệ."); return; }
    if (!pendingPostId && !drawingFiles.length) { setNotice(`Vui lòng chọn ít nhất một file ${itemLabel}.`); return; }
    setSaving(true); setNotice("");
    try {
      let publishedPostId = pendingPostId;
      if (!publishedPostId) {
        const response = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), content: description.trim(), category, audience: "Công khai", feeling: drawingType, location: format, pollQuestion: price.trim(), coverImageKey: files.find(file => file.key === coverImageKey)?.key ?? files[0]?.key, attachments: files.map(({ key, name, type, size }) => ({ key, name, type, size })), paidFiles: drawingFiles.map(({ key, name, type, size }) => ({ key, name, type, size })) }) });
        const data = await response.json() as { error?: string; post?: Post };
        if (!response.ok || !data.post) throw new Error(data.error || `Chưa thể đăng ${itemLabel}.`);
        publishedPostId = data.post.id;
        setPendingPostId(publishedPostId);
      }
      if (promotion) {
        promotionRequestId.current ||= crypto.randomUUID();
        const response = await fetch("/api/catalog-promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: publishedPostId, ...promotion, purchaseId: promotionRequestId.current }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) {
          promotionRequestId.current = null;
          if (response.status === 409) {
            setPromotion({ ...promotion, position: 0 });
            setPromotionAvailabilityVersion(value => value + 1);
          }
          throw new Error("Hồ sơ đã đăng. " + (result.error || "Chưa thể bật quảng cáo.") + " Bạn có thể thử thanh toán lại hoặc tắt quảng cáo để hoàn tất.");
        }
        window.dispatchEvent(new Event("tipook-wallet-changed"));
      }
      setPendingPostId(null); setPromotion(null); promotionRequestId.current = null;
      if (page === 1 && !searchQuery) setRefresh(current => current + 1); else router.push(catalogPageHref(basePath, 1));
      setTitle(""); setDescription(""); setDrawingType(""); setFormat(""); setPrice(""); setFiles([]); setCoverImageKey(undefined); setDrawingFiles([]); setOpen(false); setNotice(`${itemTitle} đã được đăng${promotion ? " và bật quảng cáo nổi bật" : ""}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : `Chưa thể đăng ${itemLabel}.`); }
    finally { setSaving(false); }
  };

  return <>
    <CatalogToolbar query={query} onQueryChange={setQuery} onSearch={submitSearch} onClear={() => { setQuery(""); router.push(catalogPageHref(basePath, 1)); }} publishId="catalog-publish" publishDisabled={!profileLoaded} onPublish={() => professionalRole ? setOpen(true) : setUpgradeOpen(true)} publishLabel={variant === "interior" ? "Đăng nội thất" : "Đăng bản vẽ"} publishTitle={`Đăng ${itemLabel} của bạn`} searchLabel={`Tìm kiếm ${itemLabel}`} placeholder={`Tìm ${itemLabel}, loại hồ sơ, định dạng...`} sortValue={sort} sortOptions={FILE_CATALOG_SORT_OPTIONS} onSort={value => router.push(catalogPageHref(basePath, 1, query, parseFileCatalogSort(value)))} filterGroups={filterGroups} filterTitle={`Lọc nhanh ${itemLabel}`} filterLabel={`Bộ lọc ${itemLabel}`} onFilter={value => { setQuery(value); router.push(catalogPageHref(basePath, 1, value, sort)); }}/>

    {loading && <p role="status" className="mt-5 text-center text-sm text-[#667085]">Đang tải {itemLabel}...</p>}
    {!loading && <section className={`mt-5 grid gap-x-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${variant === "drawing" ? "drawing-catalog-list gap-y-6" : "gap-y-9 rounded-2xl border border-[#dfe5eb] bg-white p-4 sm:p-5"}`} aria-label={`Danh sách ${marketLabel}`}>
      {visibleEntries.map((entry, index) => {
        if (!entry) return <div key={`empty-${index}`} className="grid min-h-40 place-items-center rounded-xl border border-dashed border-[#e3eaf2] text-xs text-[#98a2b3]">Vị trí {index + 1}</div>;
        if (entry.card) return <div key={entry.card.key} className="min-w-0 [&>article]:h-full">{entry.card.card}</div>;
        const post = entry.post;
        if (variant === "drawing") {
          const preview = post.attachments?.find(item => item.type.startsWith("image/") && item.url);
          const amount = parseVndPrice(post.pollQuestion);
          const displayPrice = amount ? amount.toLocaleString("vi-VN") + "đ" : "Miễn phí";
          return <article key={post.id} id={`post-${post.id}`} className="group flex h-full min-w-0 scroll-mt-24 flex-col">
            <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-lg bg-[#f7f9fc]">
              {preview?.url ? <>
                <img src={preview.url} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/>
                <ProjectGallery model={{ title: post.title, meta: [post.location, post.content].filter(Boolean).join(" · "), style: post.feeling || itemTitle, image: preview.url, photos: post.attachments?.filter(item => item.type.startsWith("image/")).map(item => item.url!).filter(Boolean) }} trigger="overlay" engagementTarget={{ targetType: "post", targetId: String(post.id) }}/>
              </> : <div className="grid h-full place-items-center text-[#168ac0]"><FileText size={42}/></div>}
              <ToggleActionButton actionType="save" targetType="post" targetId={String(post.id)} label="Lưu bản vẽ" activeLabel="Đã lưu" icon="heart" className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full bg-white/90 text-[#3f5064] opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100 [&>span]:sr-only"/>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#3f5064]">
              <span className="truncate uppercase text-[#147aa8]">{post.feeling || itemTitle}</span>
              <span className="flex shrink-0 items-center gap-2">
                <CatalogEngagementStats targetType="post" targetId={String(post.id)} mode="views" layout="compact"/>
                <span className="flex items-center gap-1" aria-label={`Lượt tải (${post.downloads ?? 0})`}><ArrowDownToLine size={14}/>{(post.downloads ?? 0).toLocaleString("vi-VN")}</span>
              </span>
            </div>
            {post.promotionPosition && <span className="mt-2 w-fit rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">Nổi bật · Quảng cáo</span>}
            <h2 className="catalog-card-title mt-2 line-clamp-2 min-h-12 text-base font-bold leading-6 text-[#1d3429]" title={post.title}>{post.title}</h2>
            <p className="catalog-card-author mt-1 flex min-w-0 flex-wrap items-center gap-1 text-xs text-[#66778a]">Đăng bởi <a href={`/nguoi-dung/${encodeURIComponent(post.userId)}`} className="min-w-0 truncate font-semibold text-[#0b2e59] hover:text-[#229ed9] hover:underline">{post.authorName}</a><OwnerPostControls postId={post.id} authorId={post.userId}/></p>
            <CatalogEngagementStats targetType="post" targetId={String(post.id)} mode="rating"/>
            <div className="mt-auto flex items-center justify-between pt-3">
              <strong className="text-base text-[#229ed9]">{displayPrice}</strong>
              <span className="flex shrink-0 items-center gap-1.5">
                <ShareActionButton title={post.title} url={`${basePath}?postId=${post.id}#post-${post.id}`} targetType="post" targetId={String(post.id)} iconOnly className="grid size-9 place-items-center rounded-full border border-[#cfeaf5] bg-[#f1faff] text-[#168ac0] transition hover:border-[#229ed9] hover:bg-[#e2f5fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168ac0] disabled:opacity-50"/>
                <RequestActionButton requestType="drawing-file-request" targetType="post" targetId={String(post.id)} recipientUserId={post.userId} label="Yêu cầu file" title={"Yêu cầu file: " + post.title} description={`Tin nhắn sẽ được gửi trực tiếp đến người đăng ${itemLabel}.`} iconOnly="file" className="grid size-9 place-items-center rounded-full border border-[#cfeaf5] bg-[#f1faff] text-[#168ac0] transition hover:border-[#229ed9] hover:bg-[#e2f5fc]"/>
                <PurchaseActionButton targetType="post" targetId={String(post.id)} title={post.title} price={post.pollQuestion || "Miễn phí"} label={!amount ? "Tải miễn phí" : undefined} className="grid size-9 place-items-center rounded-full bg-[#229ed9] text-white transition hover:bg-[#168ac0]"/>
              </span>
            </div>
          </article>;
        }
        const preview = post.attachments?.find((item) => item.type.startsWith("image/")); return <article key={post.id} id={`post-${post.id}`} className="flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-[#e3eaf2]">{preview?.url ? <div className="relative aspect-[4/3] shrink-0 overflow-hidden"><img src={preview.url} alt={post.title} className="h-full w-full object-cover"/><ProjectGallery model={{ title: post.title, meta: post.location || "", style: post.feeling || itemTitle, image: preview.url, photos: post.attachments?.filter(item => item.type.startsWith("image/")).map(item => item.url!).filter(Boolean) }} trigger="overlay" engagementTarget={{ targetType: "post", targetId: String(post.id) }}/></div> : <div className="grid aspect-[4/3] shrink-0 place-items-center bg-[#f3f6f9] text-[#168ac0]"><FileText size={42}/></div>}<p className="catalog-card-author flex min-w-0 flex-wrap items-center gap-1 border-b border-[#eef1f4] px-4 py-3 text-xs text-[#667085]"><span className="shrink-0">Đăng bởi</span> <a href={`/nguoi-dung/${encodeURIComponent(post.userId)}`} className="min-w-0 truncate font-bold text-[#168ac0] hover:underline">{post.authorName}</a><OwnerPostControls postId={post.id} authorId={post.userId}/></p><div className="flex flex-1 flex-col p-4"><span className="min-h-4 text-xs font-bold text-[#168ac0]">{post.feeling}</span>{post.promotionPosition && <span className="mt-2 w-fit rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">Nổi bật · Quảng cáo</span>}<h3 className="catalog-card-title mt-1 line-clamp-2 font-extrabold">{post.title}</h3><p className="catalog-card-detail mt-2 text-sm text-[#667085]">{post.location}{post.pollQuestion ? " · " + post.pollQuestion : ""}</p><p className="catalog-card-detail mt-2 line-clamp-2 text-sm text-[#667085]">{post.content}</p><CatalogEngagementStats targetType="post" targetId={String(post.id)} mode="rating"/><div className="mt-auto flex items-center justify-end gap-3 pt-3"><span className="flex shrink-0 items-center gap-1.5"><ShareActionButton title={post.title} url={`${basePath}?postId=${post.id}#post-${post.id}`} targetType="post" targetId={String(post.id)} iconOnly className="grid size-9 place-items-center rounded-full border border-[#cfeaf5] bg-[#f1faff] text-[#168ac0] transition hover:border-[#229ed9] hover:bg-[#e2f5fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168ac0] disabled:opacity-50"/><RequestActionButton requestType="drawing-file-request" targetType="post" targetId={String(post.id)} recipientUserId={post.userId} label="Yêu cầu file" title={"Yêu cầu file: " + post.title} description={`Tin nhắn sẽ được gửi trực tiếp đến người đăng ${itemLabel}.`} iconOnly="file" className="grid size-9 place-items-center rounded-full border border-[#cfeaf5] bg-[#f1faff] text-[#168ac0] transition hover:border-[#229ed9] hover:bg-[#e2f5fc]"/><PurchaseActionButton targetType="post" targetId={String(post.id)} title={post.title} price={post.pollQuestion || "Miễn phí"} label={!post.pollQuestion ? "Tải miễn phí" : undefined} className="grid size-9 place-items-center rounded-full bg-[#229ed9] text-white transition hover:bg-[#168ac0]"/></span></div></div></article>; })}

      {visiblePosts.length === 0 && visibleCards.length === 0 && <div className="col-span-full p-6 text-center text-sm text-[#667085]">{searchQuery ? `Không tìm thấy ${itemLabel} phù hợp trên trang này.` : `Trang này chưa có ${itemLabel}. Nhấn dấu + để đăng hồ sơ.`}</div>}
    </section>}
    {notice && <p role="status" className={`mt-3 text-center text-sm font-semibold ${notice.includes("đã được đăng") ? "text-emerald-600" : "text-rose-600"}`}>{notice}</p>}
    {!loading && <CatalogPagination basePath={basePath} page={page} totalPages={pagination.totalPages} total={pagination.total} query={searchQuery} sort={sort} label={itemLabel} />}

    <Dialog open={upgradeOpen} onOpenChange={(next) => { setUpgradeOpen(next); if (!next) { setSelectedRole(null); setUpgradeNotice(""); } }}><DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] max-w-[520px] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0"><header className="relative border-b px-14 py-4 text-center"><DialogTitle className="text-xl font-extrabold text-[#0b2e59]">Chuyển sang tài khoản chuyên môn</DialogTitle><DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose></header><div className="p-5"><p className="text-sm leading-6 text-[#667085]">Để đăng và bán {itemLabel}, bạn cần xác nhận vai trò chuyên môn. Thao tác này chỉ thực hiện một lần; các lần sau form đăng sẽ mở trực tiếp.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setSelectedRole("engineer")} className={`rounded-2xl border p-4 text-left transition ${selectedRole === "engineer" ? "border-[#229ed9] bg-[#eef9fd] ring-2 ring-[#229ed9]/15" : "border-[#dfe5eb] hover:border-[#8fcfe8]"}`}><HardHat size={26} className="text-[#168ac0]"/><strong className="mt-3 block text-[#0b2e59]">Kỹ sư</strong><span className="mt-1 block text-xs leading-5 text-[#667085]">Đăng hồ sơ kết cấu, kỹ thuật và {itemLabel} thi công.</span></button><button type="button" onClick={() => setSelectedRole("architect")} className={`rounded-2xl border p-4 text-left transition ${selectedRole === "architect" ? "border-[#229ed9] bg-[#eef9fd] ring-2 ring-[#229ed9]/15" : "border-[#dfe5eb] hover:border-[#8fcfe8]"}`}><Ruler size={26} className="text-[#168ac0]"/><strong className="mt-3 block text-[#0b2e59]">Kiến trúc sư</strong><span className="mt-1 block text-xs leading-5 text-[#667085]">Đăng thiết kế kiến trúc, mặt bằng và phối cảnh.</span></button></div>{upgradeNotice && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{upgradeNotice}</p>}<button type="button" onClick={() => void upgradeAccount()} disabled={!selectedRole || upgrading} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">{upgrading && <LoaderCircle size={18} className="animate-spin"/>}Xác nhận và tiếp tục đăng</button></div></DialogContent></Dialog>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent showCloseButton={false} className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[560px] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0"><header className="relative border-b px-14 py-4 text-center"><DialogTitle className="text-xl font-extrabold">Đăng {itemLabel}</DialogTitle><DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose></header><form onSubmit={publish} className="min-h-0 overflow-y-auto p-4"><fieldset disabled={saving || pendingPostId !== null}><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder={`Tên ${itemLabel} (không bắt buộc)`}/><div className="mt-3 grid gap-3 sm:grid-cols-2">{[{ label: "Loại hồ sơ", options: filterGroups[0].options }, filterGroups[2]].map((group, index) => <label key={group.label} className="block text-xs font-semibold text-[#475467]">{group.label}<select value={[drawingType, format][index]} onChange={event => [setDrawingType, setFormat][index](event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal text-[#182230] outline-none focus:border-[#229ed9]"><option value="">Chọn {group.label.toLocaleLowerCase("vi")} (không bắt buộc)</option>{group.options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>)}</div><input value={price} onChange={(event) => setPrice(event.target.value)} maxLength={40} className="mt-3 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Giá bán (không bắt buộc)"/>{variant === "drawing" && <p className="mt-1.5 text-xs leading-5 text-[#667085]">Chia sẻ doanh thu: người bán nhận 80%, website giữ 20% giá bán.</p>}<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={4} className="mt-3 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-[#229ed9]" placeholder={`Mô tả ${itemLabel} (không bắt buộc)...`}/><section className="mt-4"><div className="flex items-end justify-between gap-3"><div><h3 className="text-sm font-extrabold text-[#182230]">Ảnh xem trước công khai <span className="font-medium text-[#667085]">(không bắt buộc)</span></h3><p className="mt-0.5 text-xs text-[#667085]">Tối đa 10 ảnh, hiển thị trực tiếp trên {marketLabel}.</p></div><span className="text-xs font-bold text-[#168ac0]">{files.length}/10</span></div><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={uploading || files.length >= 10} className="hidden" onChange={chooseFiles}/><button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || files.length >= 10} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#8fcfe8] bg-[#f7fbfd] px-4 py-3 text-sm font-bold text-[#147aa8]"><Upload size={18}/>{uploading ? "Đang tải lên Cloudflare..." : "Thêm ảnh"}</button><CoverImagePicker images={files.map(file => ({ id: file.key, url: file.url || "/api/files?key=" + encodeURIComponent(file.key), name: file.name }))} selectedId={coverImageKey} onSelect={setCoverImageKey} onRemove={removeImage} disabled={saving || uploading || pendingPostId !== null}/></section><section className="mt-4 rounded-xl border border-[#dfe8f1] bg-[#fafcfe] p-3"><div className="flex items-start gap-2"><LockKeyhole size={19} className="mt-0.5 shrink-0 text-[#168ac0]"/><div><h3 className="text-sm font-extrabold text-[#182230]">File {itemLabel} <span className="text-rose-600">*</span></h3><p className="mt-0.5 text-xs leading-5 text-[#667085]"><b className="text-rose-600">Bắt buộc.</b> File được lưu riêng tư trên Cloudflare; link tải có hiệu lực 24 giờ sau thanh toán.</p></div></div><input ref={drawingFileInputRef} type="file" multiple disabled={uploading || drawingFiles.length >= 5} className="hidden" onChange={chooseDrawingFiles}/><button type="button" onClick={() => drawingFileInputRef.current?.click()} disabled={uploading || drawingFiles.length >= 5} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#8fcfe8] bg-white px-4 py-3 text-sm font-bold text-[#147aa8]"><Upload size={18}/>{uploading ? "Đang tải lên Cloudflare..." : `Chọn file ${itemLabel} (${drawingFiles.length}/5)`}</button>{drawingFiles.length > 0 && <div className="mt-3 space-y-2">{drawingFiles.map((file) => <div key={file.key} className="flex items-center gap-2 rounded-lg bg-[#eef3f7] px-3 py-2 text-sm"><LockKeyhole size={16} className="shrink-0 text-[#168ac0]"/><span className="min-w-0 flex-1 truncate">{file.name}</span><button type="button" onClick={() => setDrawingFiles((current) => current.filter((item) => item.key !== file.key))} aria-label="Bỏ file"><X size={16}/></button></div>)}</div>}</section></fieldset>{open && <CatalogPromotionFields key={promotionAvailabilityVersion} category={category} value={promotion} disabled={saving} onChange={value => { setPromotion(value); promotionRequestId.current = null; }}/>} {notice && !notice.includes("đã được đăng") && <p className="mt-3 text-sm font-semibold text-rose-600">{notice}</p>}<button disabled={saving || uploading} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] text-sm font-extrabold text-white disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={18}/> : <Upload size={18}/>}{pendingPostId ? promotion ? "Thanh toán và bật quảng cáo" : "Hoàn tất đăng hồ sơ" : promotion ? `Đăng ${itemLabel} và thanh toán quảng cáo` : `Đăng ${itemLabel}`}</button></form></DialogContent></Dialog>
  </>;
}
