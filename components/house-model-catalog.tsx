"use client";
import { SITE_EVENTS } from "@/lib/site-events";
import { POST_CATEGORIES } from "@/lib/legacy-contracts";
import { OwnerPostControls, useSiteEditor } from "@/components/site-editor";
import { demoPostVisible } from "@/lib/demo-posts";
import { usePostAnchor } from "@/components/use-post-anchor";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FileSearch, Image as ImageIcon, Images, LoaderCircle, Maximize2, Send, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { houseModelHref } from "@/lib/house-model-links";
import { drawingPostHref } from "@/lib/catalog-pagination";
import { parseVndPrice } from "@/lib/drawing-catalog";
import { HOUSE_MODEL_RANDOM_MODULUS, parseHouseModelSort, shuffleHouseModels, type HouseModelSort } from "@/lib/house-model-feed";
import { optimizeImageForUpload } from "@/lib/image-upload";
import { PostCommentPanel } from "@/components/post-comment-panel";
import { ModelCardFooter } from "@/components/model-card-footer";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { CurrentMemberAvatar } from "@/components/member-avatar";
import { CatalogToolbar } from "@/components/catalog-toolbar";
import { ProjectGallery } from "@/components/project-gallery";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCatalogLocation } from "@/components/use-catalog-location";
type Attachment={key:string;name:string;type:string;size:number;url:string};
type Post={id:number;userId:string;authorName:string;title:string;content:string;category:string;comments:number;sortScore?:number;expertQuestions?:number;specifications?:string|null;listingType?:string|null;priceLabel?:string|null;attachments?:Attachment[]};
type Picked={file:File;preview:string};
type Comment={id:number;authorName:string;content:string;imageKey?:string|null;imageUrl?:string|null};
const category=POST_CATEGORIES.houseModels;
type ModelCard = { key: string; search: string; card: ReactNode; contentPrefix?: string };
export type HouseModelInitialData = { posts: Post[]; seed: number; nextCursor?: string | null; modelScores?: Record<string, number> };
export function HouseModelCatalog({ searchQuery: initialQuery = "", modelCards = [], sort: initialSort = "random", targetPostId: initialPostId, initialData }: { searchQuery?: string; modelCards?: ModelCard[]; sort?: HouseModelSort; targetPostId?: string; initialData?: HouseModelInitialData }){
 const location = useCatalogLocation({ searchQuery: initialQuery, sort: initialSort, targetPostId: initialPostId, initialReady: Boolean(initialData) });
 const { searchQuery, targetPostId } = location;
 const sort = parseHouseModelSort(location.sort);
 const router = useRouter();
 const editor = useSiteEditor();
 const seedRef = useRef(initialData?.seed ?? 0);
 const modelKeys = useRef(modelCards.map(model => `model:${model.key}`));
 const [cardOrder, setCardOrder] = useState<string[]>(initialData ? shuffleHouseModels([...initialData.posts.map(post => `post:${post.id}`), ...(initialPostId ? [] : modelKeys.current)], initialData.seed) : []);
 const [modelScores, setModelScores] = useState<Record<string, number>>(initialData?.modelScores ?? {});
 const catalogScope = JSON.stringify([searchQuery, sort, targetPostId]);
 const [cursor, setCursor] = useState({ scope: "", value: "" });
 const requestCursor = cursor.scope === catalogScope ? cursor.value : "";
 const setRequestCursor = useCallback((value: string) => setCursor({ scope: catalogScope, value }), [catalogScope]);
 const [nextCursor, setNextCursor] = useState<string | null>(initialData?.nextCursor ?? null);
 const [loadError, setLoadError] = useState(false);
 const loadMoreRef = useRef<HTMLDivElement>(null);
 const [loading, setLoading] = useState(!initialData);
 const [refresh, setRefresh] = useState(0);
 useEffect(() => { const update = () => { setRequestCursor(""); setRefresh(value => value + 1); }; window.addEventListener(SITE_EVENTS.contentChanged, update); return () => window.removeEventListener(SITE_EVENTS.contentChanged, update); }, [setRequestCursor]);
 const [posts,setPosts]=useState<Post[]>(initialData?.posts ?? []); const [title,setTitle]=useState(""); const [content,setContent]=useState(""); const [style,setStyle]=useState(""); const [specs,setSpecs]=useState("");
 const [queryDraft, setQueryDraft] = useState({ source: searchQuery, value: searchQuery });
 const query = queryDraft.source === searchQuery ? queryDraft.value : searchQuery;
 const setQuery = (value: string) => setQueryDraft({ source: searchQuery, value });
 usePostAnchor(posts);
 const [images,setImages]=useState<Picked[]>([]); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState(""); const [open,setOpen]=useState(false); const inputRef=useRef<HTMLInputElement>(null);
 const [coverPreview, setCoverPreview] = useState<string>();
 const imagePreviews = useRef<Picked[]>([]);
 useEffect(() => { imagePreviews.current = images; }, [images]);
 useEffect(() => () => { imagePreviews.current.forEach(image => URL.revokeObjectURL(image.preview)); }, []);
 const [commentOpen,setCommentOpen]=useState<Record<number,boolean>>({}); const [threads,setThreads]=useState<Record<number,Comment[]>>({}); const [drafts,setDrafts]=useState<Record<number,string>>({}); const [commentBusy,setCommentBusy]=useState<Record<number,boolean>>({});
 const [commentImages,setCommentImages]=useState<Record<number,Attachment|undefined>>({}); const [commentUploading,setCommentUploading]=useState<Record<number,boolean>>({});
 const [commentErrors,setCommentErrors]=useState<Record<number,string>>({});
 useEffect(() => {
  if (!location.ready) return;
  const controller = new AbortController();
  if (!seedRef.current) seedRef.current = crypto.getRandomValues(new Uint32Array(1))[0] % (HOUSE_MODEL_RANDOM_MODULUS - 1) + 1;
  setLoading(true);
  setLoadError(false);
  const params = new URLSearchParams({ category, seed: String(seedRef.current), q: searchQuery, sort });
  if (targetPostId) params.set("postId", targetPostId);
  if (requestCursor) params.set("cursor", requestCursor);
  fetch("/api/posts?" + params, { signal: controller.signal })
   .then(response => response.ok ? response.json() as Promise<{ posts?: Post[]; nextCursor?: string | null; modelScores?: Record<string, number> }> : Promise.reject())
   .then(data => {
    if (controller.signal.aborted) return;
    const batch = data.posts ?? [];
    setPosts(current => requestCursor ? [...current, ...batch.filter(post => !current.some(item => item.id === post.id))] : batch);
    const keys = batch.map(post => `post:${post.id}`);
    setCardOrder(current => requestCursor ? [...new Set([...current, ...keys])] : shuffleHouseModels([...keys, ...(targetPostId ? [] : modelKeys.current)], seedRef.current));
    setModelScores(data.modelScores ?? {});
    setNextCursor(data.nextCursor ?? null);
   })
   .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
   .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [requestCursor, searchQuery, refresh, sort, targetPostId, location.ready]);
 useEffect(() => {
  if (loading || loadError || !nextCursor || !loadMoreRef.current || !window.IntersectionObserver) return;
  const anchor = window.location.hash.match(/^#post-(\d+)$/);
  if (anchor && !document.getElementById(`post-${anchor[1]}`)) {
   setRequestCursor(nextCursor);
   return;
  }
  const observer = new IntersectionObserver(entries => {
   if (entries.some(entry => entry.isIntersecting)) setRequestCursor(nextCursor);
  }, { rootMargin: "600px" });
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
 }, [loading, loadError, nextCursor, setRequestCursor]);
 const refreshGallery = () => { setRequestCursor(""); setRefresh(current => current + 1); };
 const normalized = searchQuery.toLocaleLowerCase("vi");
 const filteredModels = targetPostId ? [] : modelCards.filter(model => demoPostVisible(editor.content, model.contentPrefix, editor.isOwner) && (!normalized || [model.search, ...Object.entries(editor.content).filter(([key]) => model.contentPrefix && key.startsWith(model.contentPrefix + ".")).map(([, item]) => item.value)].join(" ").toLocaleLowerCase("vi").includes(normalized)));
 const modelsByKey = new Map(filteredModels.map(model => [`model:${model.key}`, model]));
 const postsByKey = new Map(posts.map(post => [`post:${post.id}`, post]));
 const submitSearch = (event: FormEvent) => { event.preventDefault(); router.push(houseModelHref(query, sort)); };
 const displayedOrder = sort === "random" ? cardOrder : [...cardOrder].sort((a, b) => {
  const score = (key: string) => key.startsWith("model:") ? modelScores[key.slice(6)] ?? 0 : postsByKey.get(key)?.sortScore ?? 0;
  const difference = score(b) - score(a);
  if (difference) return difference;
  if (a.startsWith("post:") && b.startsWith("post:")) return Number(a.slice(5)) - Number(b.slice(5));
  return a.localeCompare(b, "vi");
 });
 const choose=(event:ChangeEvent<HTMLInputElement>)=>{const picked=Array.from(event.target.files??[]).filter(file=>file.type.startsWith("image/"));event.target.value="";if(images.length+picked.length>10){setNotice("Mỗi bộ sưu tập được đăng tối đa 10 ảnh.");return;}setImages(current=>[...current,...picked.map(file=>({file,preview:URL.createObjectURL(file)}))]);setNotice("");};
 const remove=(preview:string)=>{if(saving)return;URL.revokeObjectURL(preview);setImages(current=>current.filter(image=>image.preview!==preview));if(coverPreview===preview)setCoverPreview(undefined);};
 const publish=async(event:FormEvent)=>{
  event.preventDefault();if(saving)return;setSaving(true);setNotice("");
  try{const attachments:Attachment[]=[];
   for(const image of images){const form=new FormData();form.append("file",await optimizeImageForUpload(image.file));const response=await fetch("/api/files",{method:"POST",body:form});const data=await response.json() as {error?:string;attachment?:Attachment};if(!response.ok||!data.attachment)throw new Error(data.error||"Không thể tải ảnh.");attachments.push(data.attachment);}
   const coverIndex = Math.max(0, images.findIndex(image => image.preview === coverPreview));
   const response=await fetch("/api/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:title.trim(),content:content.trim(),category,audience:"Công khai",listingType:style.trim(),specifications:specs.trim(),coverImageKey:attachments[coverIndex]?.key,attachments:attachments.map(({key,name,type,size})=>({key,name,type,size}))})});
   const data=await response.json() as {error?:string;post?:Post};if(!response.ok||!data.post)throw new Error(data.error||"Chưa thể đăng bộ sưu tập.");
   if (!searchQuery) refreshGallery(); else router.push(houseModelHref());images.forEach(image=>URL.revokeObjectURL(image.preview));setImages([]);setCoverPreview(undefined);setTitle("");setContent("");setStyle("");setSpecs("");setNotice("Mẫu nhà đã được đăng.");setOpen(false);
  }catch(error){setNotice(error instanceof Error?error.message:"Chưa thể đăng bộ sưu tập.");}finally{setSaving(false);}
 };
 const toggleComments=async(post:Post)=>{
  const next=!commentOpen[post.id];setCommentOpen(current=>({...current,[post.id]:next}));
  if(!next||threads[post.id]!==undefined)return;
  try{const response=await fetch(`/api/comments?postId=${post.id}`);const data=await response.json() as {comments?:Comment[]};setThreads(current=>({...current,[post.id]:response.ok?data.comments??[]:[]}));}catch{setThreads(current=>({...current,[post.id]:[]}));}
 };
 const chooseCommentImage=async(postId:number,event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value="";if(!file||commentBusy[postId]||commentUploading[postId])return;if(!file.type.startsWith("image/")){setCommentErrors(current=>({...current,[postId]:"Bình luận chỉ hỗ trợ tệp ảnh."}));return;}setCommentUploading(current=>({...current,[postId]:true}));setCommentErrors(current=>({...current,[postId]:""}));
  try{const form=new FormData();form.append("file",await optimizeImageForUpload(file,"comment"));form.append("purpose","comment-image");const response=await fetch("/api/files",{method:"POST",body:form});const data=await response.json() as {error?:string;attachment?:Attachment};if(!response.ok||!data.attachment)throw new Error(data.error||"Không thể tải ảnh bình luận.");setCommentImages(current=>({...current,[postId]:data.attachment}));setCommentOpen(current=>({...current,[postId]:true}));}catch(error){setCommentErrors(current=>({...current,[postId]:error instanceof Error?error.message:"Không thể tải ảnh bình luận."}));}finally{setCommentUploading(current=>({...current,[postId]:false}));}
 }; const sendComment=async(post:Post)=>{
  const value=(drafts[post.id]??"").trim();const image=commentImages[post.id];if((!value&&!image)||commentBusy[post.id]||commentUploading[post.id])return;setCommentBusy(current=>({...current,[post.id]:true}));setCommentErrors(current=>({...current,[post.id]:""}));
  try{const response=await fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({postId:post.id,content:value,imageKey:image?.key})});const data=await response.json() as {error?:string;comment?:Comment};if(!response.ok||!data.comment)throw new Error(data.error||"Chưa thể gửi bình luận.");setThreads(current=>({...current,[post.id]:[...(current[post.id]??[]),data.comment!]}));setPosts(current=>current.map(item=>item.id===post.id?{...item,comments:(item.comments??0)+1}:item));setDrafts(current=>({...current,[post.id]:""}));setCommentImages(current=>({...current,[post.id]:undefined}));setCommentOpen(current=>({...current,[post.id]:true}));}catch(error){setCommentErrors(current=>({...current,[post.id]:error instanceof Error?error.message:"Chưa thể gửi bình luận."}));}finally{setCommentBusy(current=>({...current,[post.id]:false}));}
 };
 return <>
  <CatalogToolbar query={query} onQueryChange={setQuery} onSearch={submitSearch} onClear={()=>{setQuery("");router.push(houseModelHref());}} onPublish={()=>setOpen(true)} publishLabel="Đăng mẫu nhà" publishTitle="Chia sẻ mẫu nhà của bạn" searchLabel="Tìm kiếm mẫu nhà" placeholder="Tìm theo phong cách, diện tích, số tầng..." filterGroups={[{label:"Phong cách",options:["Hiện đại","Tối giản","Nhiệt đới","Không gian mở"]},{label:"Số tầng",options:["1 tầng","2 tầng","3 tầng","4 tầng"]}]} onFilter={value=>{setQuery(value);router.push(houseModelHref(value,sort));}} sortValue={sort} sortOptions={[{value:"random",label:"Khám phá"},{value:"views",label:"Xem nhiều",description:"Ưu tiên mẫu có nhiều lượt xem"},{value:"featured",label:"Nổi bật",description:"Ưu tiên mẫu có nhiều lượt yêu thích"}]} onSort={value=>router.push(houseModelHref(query,parseHouseModelSort(value)))}/>
  {sort !== "random" && <p className="mt-3 text-xs text-[#667085]" role="status">{sort === "views" ? "Xem nhiều · Lượt xem từ cao đến thấp" : "Nổi bật · Lượt yêu thích từ cao đến thấp"}</p>}
  {notice&&<p role="status" className={`mt-3 text-center text-sm font-semibold ${notice.includes("đã được đăng") ? "text-emerald-600" : "text-rose-600"}`}>{notice}</p>}

  <section className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-label="Danh sách mẫu nhà đẹp">
   {displayedOrder.map(key=>{
    const model = modelsByKey.get(key);
    if (model) return <div key={key} className="min-w-0 [&>article]:h-full">{model.card}</div>;
    const post = postsByKey.get(key);
    if (!post) return null;
    const photos=post.attachments?.filter(a=>a.type.startsWith("image/"))??[];
    const cover=photos[0];
    const drawingPrice = parseVndPrice(post.priceLabel);
    return <article key={post.id} data-auth-post-id={post.id} id={`post-${post.id}`} className="group motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-[3px] flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-[22px] border border-[#e3eaf2] bg-white shadow-[0_5px_20px_rgba(24,49,39,.045)]">
     <div className="relative aspect-[5/4] shrink-0 overflow-hidden bg-[#eef2f6]">
      {cover ? <>
       <img src={cover.url} alt={post.title} loading="lazy" className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.02]"/>
       <ProjectGallery model={{title:post.title,meta:post.specifications||"Chưa cập nhật",style:post.listingType||POST_CATEGORIES.houseModels,image:cover.url,photos:photos.map(photo=>photo.url)}} trigger="overlay" engagementTarget={{targetType:"post",targetId:String(post.id)}}/>
       {photos.length>1&&<span className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-bold text-white"><Images size={15}/>{photos.length} ảnh</span>}
      </> : <span className="grid size-full place-items-center text-[#8aa0b5]"><Images size={42}/></span>}
      {post.listingType&&<span className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] truncate rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-bold text-[#0b2e59] backdrop-blur">{post.listingType}</span>}
     </div>
     <div className="flex flex-1 flex-col px-3 py-2.5">
      <div className="flex items-start gap-2"><h3 className="catalog-card-title min-w-0 flex-1 text-base font-extrabold tracking-[-.02em]">{post.title}</h3>{post.category === POST_CATEGORIES.drawings && <a href={drawingPostHref(post.id)} aria-label={`Xem file: ${post.title}`} title="Xem file trong kho bản vẽ" className="grid size-9 shrink-0 place-items-center rounded-full border border-[#cfeaf5] bg-[#f1faff] text-[#168ac0] transition hover:border-[#229ed9] hover:bg-[#e2f5fc]"><FileSearch size={18}/></a>}</div>
      <p className="mt-1 flex min-h-5 items-center gap-2 text-sm font-medium text-[#3f5064]"><Maximize2 size={15} className="shrink-0"/>{post.specifications||"Chưa cập nhật kích thước"}</p>
      <p className="catalog-card-author mt-1 flex min-w-0 flex-wrap items-center gap-1 text-xs text-[#66778a]"><span className="shrink-0">Đăng bởi</span> <a href={`/nguoi-dung/${encodeURIComponent(post.userId)}`} className="min-w-0 truncate font-semibold text-[#0b2e59] hover:text-[#229ed9] hover:underline">{post.authorName}</a><OwnerPostControls postId={post.id} authorId={post.userId}/></p>
      {post.content&&<p className="mt-1 line-clamp-1 text-sm text-[#667085]">{post.content}</p>}
      {post.category === POST_CATEGORIES.drawings && <a href={drawingPostHref(post.id)} className="mt-1 w-fit text-xs font-semibold text-[#3f5064] hover:text-[#229ed9] hover:underline">File bản vẽ : {drawingPrice ? `${drawingPrice.toLocaleString("vi-VN")}đ` : "Miễn phí"}</a>}
      <div className="mt-auto"><ModelCardFooter title={post.title} meta={post.specifications||"Chưa cập nhật kích thước"} targetType="post" targetId={String(post.id)} recipientUserId={post.userId} comments={post.comments??0} expertQuestions={post.expertQuestions??0} commentOpen={Boolean(commentOpen[post.id])} onToggleComments={()=>void toggleComments(post)} onQuestionSent={refreshGallery}/></div>
     </div><PostCommentPanel postId={post.id} open={Boolean(commentOpen[post.id])} onOpenChange={next=>setCommentOpen(current=>({...current,[post.id]:next}))} title={post.title} image={cover?.url} meta={`Đăng bởi ${post.authorName} · ${post.specifications||"Chưa cập nhật kích thước"}`} content={post.content}>{commentErrors[post.id]&&<p role="alert" className="text-xs font-semibold text-rose-600">{commentErrors[post.id]}</p>}{threads[post.id]?.map(comment=><div key={comment.id} className="rounded-2xl bg-[#eef1f4] px-3 py-2"><b className="block text-xs text-[#182230]">{comment.authorName}</b>{comment.content&&<p className="mt-0.5 whitespace-pre-wrap text-sm text-[#344054]">{comment.content}</p>}{comment.imageUrl&&<img src={comment.imageUrl} onError={(event) => { event.currentTarget.hidden = true; }} alt="Ảnh trong bình luận" className="mt-2 max-h-64 max-w-full rounded-xl object-contain"/>}</div>)}{threads[post.id]===undefined&&<p className="text-center text-xs text-[#667085]">Đang tải bình luận...</p>}{threads[post.id]?.length===0&&<p className="text-center text-xs text-[#667085]">Chưa có bình luận.</p>}<div data-requires-account className="flex items-start gap-2"><CurrentMemberAvatar className="size-8"/><div className="min-w-0 flex-1">{commentImages[post.id]&&<div className="relative mb-2 w-fit"><img src={commentImages[post.id]?.url} alt="Ảnh chuẩn bị gửi" className="max-h-28 rounded-xl object-contain"/><button type="button" onClick={()=>setCommentImages(current=>({...current,[post.id]:undefined}))} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#344054] text-white" aria-label="Bỏ ảnh"><X size={14}/></button></div>}<div className="flex items-center rounded-full bg-[#eef1f4] pl-3 pr-1"><input value={drafts[post.id]??""} onChange={event=>setDrafts(current=>({...current,[post.id]:event.target.value}))} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void sendComment(post);}}} maxLength={600} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Viết bình luận..."/><label className="grid size-8 shrink-0 cursor-pointer place-items-center text-[#229ed9]" aria-label="Thêm ảnh" title="Thêm ảnh">{commentUploading[post.id]?<LoaderCircle size={17} className="animate-spin"/>:<ImageIcon size={17}/>}<input type="file" accept="image/*" className="sr-only" disabled={commentBusy[post.id]||commentUploading[post.id]} onChange={event=>void chooseCommentImage(post.id,event)}/></label><button type="button" onClick={()=>void sendComment(post)} disabled={commentBusy[post.id]||commentUploading[post.id]||(!(drafts[post.id]??"").trim()&&!commentImages[post.id])} className="grid size-8 shrink-0 place-items-center text-[#229ed9] disabled:text-[#bcc0c4]" aria-label="Gửi bình luận"><Send size={16}/></button></div></div></div></PostCommentPanel></article>})}
  </section>
  {!loading && !loadError && posts.length === 0 && filteredModels.length === 0 && <p className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-[#667085]">{targetPostId ? "Bài viết không còn hiển thị." : searchQuery ? "Không tìm thấy mẫu nhà phù hợp." : "Chưa có mẫu nhà."}</p>}
  <div ref={loadMoreRef} className="mt-6 flex min-h-12 items-center justify-center">
   {loading ? <p role="status" className="flex items-center gap-2 text-sm text-[#667085]"><LoaderCircle size={18} className="animate-spin"/>Đang tải mẫu nhà...</p> : loadError ? <div role="alert" className="text-center text-sm text-rose-600"><p>Chưa thể tải mẫu nhà đẹp.</p><button type="button" onClick={()=>setRefresh(current=>current+1)} className="mt-2 rounded-lg border bg-white px-4 py-2 font-semibold">Thử lại</button></div> : nextCursor && <button type="button" onClick={()=>setRequestCursor(nextCursor)} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-[#0b2e59]">Xem thêm mẫu</button>}
  </div>

  <Dialog open={open} onOpenChange={next=>{if(!saving)setOpen(next);}}>
   <DialogContent showCloseButton={false} className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[540px] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0">
    <header className="relative border-b px-14 py-4 text-center"><DialogTitle className="text-xl font-extrabold">Đăng mẫu nhà</DialogTitle><DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose></header>
    <form data-requires-account onSubmit={publish} className="min-h-0 overflow-y-auto p-4">
     <fieldset disabled={saving} className="min-w-0">
     <div className="flex items-center gap-3"><CurrentMemberAvatar className="size-10"/><div><b className="block text-sm">Thành viên NhàĐẹpChất</b><small className="text-[#667085]">Công khai</small></div></div>
     <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} className="mt-4 h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Tên bộ sưu tập (không bắt buộc)"/>
     <div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={style} onChange={e=>setStyle(e.target.value)} maxLength={60} className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Phong cách (không bắt buộc)"/><input value={specs} onChange={e=>setSpecs(e.target.value)} maxLength={100} className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Kích thước, công năng (không bắt buộc)"/></div>
     <textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={1200} rows={4} className="mt-3 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Mô tả ý tưởng (không bắt buộc)..."/>
     <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={choose}/>
     <button type="button" onClick={()=>inputRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#8fcfe8] bg-[#f7fbfd] px-4 py-3 text-sm font-bold text-[#147aa8]"><Images size={18}/>Chọn ảnh - không bắt buộc ({images.length}/10)</button>
     <CoverImagePicker images={images.map(image=>({id:image.preview,url:image.preview,name:image.file.name}))} selectedId={coverPreview} onSelect={setCoverPreview} onRemove={remove} disabled={saving}/>
     {notice&&!notice.includes("đã được đăng")&&<p className="mt-3 text-sm font-semibold text-rose-600">{notice}</p>}
     <button disabled={saving} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] text-sm font-extrabold text-white disabled:opacity-60">{saving?<LoaderCircle className="animate-spin" size={18}/>:<Upload size={18}/>}Đăng bộ sưu tập</button>
     </fieldset>
    </form>
   </DialogContent>
  </Dialog>
 </>;
}
