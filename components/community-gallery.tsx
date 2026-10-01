"use client";
import { OwnerPostControls, useSiteEditor } from "@/components/site-editor";
import { ChangeEvent, FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { Image as ImageIcon, Images, LoaderCircle, Maximize2, Plus, Search, Send, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ClientNavigationLink } from "@/components/client-navigation-link";
import { facadePageHref, facadePageWindow } from "@/lib/facade-pagination";
import { ModelCardFooter } from "@/components/model-card-footer";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { ProjectGallery } from "@/components/project-gallery";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
type Attachment={key:string;name:string;type:string;size:number;url:string};
type Post={id:number;userId:string;authorName:string;title:string;content:string;category:string;comments:number;expertQuestions?:number;location?:string|null;feeling?:string|null;attachments?:Attachment[]};
type Picked={file:File;preview:string};
type Comment={id:number;authorName:string;content:string;imageKey?:string|null;imageUrl?:string|null};
const category="Bộ sưu tập ảnh";
type ModelCard = { key: string; search: string; card: ReactNode; contentPrefix?: string };
export function CommunityGallery({ page = 1, searchQuery = "", modelCards = [] }: { page?: number; searchQuery?: string; modelCards?: ModelCard[] }){
 const router = useRouter();
 const editor = useSiteEditor();
 const [totalPosts, setTotalPosts] = useState(0);
 const [loading, setLoading] = useState(true);
 const [refresh, setRefresh] = useState(0);
 useEffect(() => { const update = () => setRefresh(value => value + 1); window.addEventListener("tipook-content-changed", update); return () => window.removeEventListener("tipook-content-changed", update); }, []);
 const [posts,setPosts]=useState<Post[]>([]); const [title,setTitle]=useState(""); const [content,setContent]=useState(""); const [style,setStyle]=useState(""); const [specs,setSpecs]=useState(""); const [query,setQuery]=useState(searchQuery);
 const [images,setImages]=useState<Picked[]>([]); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState(""); const [open,setOpen]=useState(false); const inputRef=useRef<HTMLInputElement>(null);
 const [coverPreview, setCoverPreview] = useState<string>();
 const imagePreviews = useRef<Picked[]>([]);
 useEffect(() => { imagePreviews.current = images; }, [images]);
 useEffect(() => () => { imagePreviews.current.forEach(image => URL.revokeObjectURL(image.preview)); }, []);
 const [commentOpen,setCommentOpen]=useState<Record<number,boolean>>({}); const [threads,setThreads]=useState<Record<number,Comment[]>>({}); const [drafts,setDrafts]=useState<Record<number,string>>({}); const [commentBusy,setCommentBusy]=useState<Record<number,boolean>>({});
 const [commentImages,setCommentImages]=useState<Record<number,Attachment|undefined>>({}); const [commentUploading,setCommentUploading]=useState<Record<number,boolean>>({});
 useEffect(() => {
  const controller = new AbortController();
  const params = new URLSearchParams({ category, page: String(page), q: searchQuery });
  fetch("/api/posts?" + params, { signal: controller.signal })
   .then(response => response.ok ? response.json() as Promise<{ posts?: Post[]; total?: number }> : Promise.reject())
   .then(data => { setPosts(data.posts ?? []); setTotalPosts(data.total ?? 0); })
   .catch(() => { if (!controller.signal.aborted) setNotice("Chưa thể tải bộ sưu tập cộng đồng."); })
   .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
 }, [page, searchQuery, refresh]);
 const normalized = searchQuery.toLocaleLowerCase("vi");
 const filteredModels = modelCards.filter(model => !normalized || [model.search, ...Object.entries(editor.content).filter(([key]) => model.contentPrefix && key.startsWith(model.contentPrefix + ".")).map(([, item]) => item.value)].join(" ").toLocaleLowerCase("vi").includes(normalized));
 const pagination = facadePageWindow(page, totalPosts, filteredModels.length);
 const visibleModels = filteredModels.slice(pagination.modelStart, pagination.modelEnd);
 const visiblePosts = posts;
 const submitSearch = (event: FormEvent) => { event.preventDefault(); router.push(facadePageHref(1, query)); };
 const pageNumbers = [...new Set([1, page - 1, page, page + 1, pagination.totalPages])].filter(number => number >= 1 && number <= pagination.totalPages).sort((a, b) => a - b);
 const choose=(event:ChangeEvent<HTMLInputElement>)=>{const picked=Array.from(event.target.files??[]).filter(file=>file.type.startsWith("image/"));event.target.value="";if(images.length+picked.length>10){setNotice("Mỗi bộ sưu tập được đăng tối đa 10 ảnh.");return;}setImages(current=>[...current,...picked.map(file=>({file,preview:URL.createObjectURL(file)}))]);setNotice("");};
 const remove=(preview:string)=>{if(saving)return;URL.revokeObjectURL(preview);setImages(current=>current.filter(image=>image.preview!==preview));if(coverPreview===preview)setCoverPreview(undefined);};
 const publish=async(event:FormEvent)=>{
  event.preventDefault();if(saving)return;setSaving(true);setNotice("");
  try{const attachments:Attachment[]=[];
   for(const image of images){const form=new FormData();form.append("file",image.file);const response=await fetch("/api/files",{method:"POST",body:form});const data=await response.json() as {error?:string;attachment?:Attachment};if(!response.ok||!data.attachment)throw new Error(data.error||"Không thể tải ảnh.");attachments.push(data.attachment);}
   const coverIndex = Math.max(0, images.findIndex(image => image.preview === coverPreview));
   const response=await fetch("/api/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:title.trim(),content:content.trim(),category,audience:"Công khai",feeling:style.trim(),location:specs.trim(),coverImageKey:attachments[coverIndex]?.key,attachments:attachments.map(({key,name,type,size})=>({key,name,type,size}))})});
   const data=await response.json() as {error?:string;post?:Post};if(!response.ok||!data.post)throw new Error(data.error||"Chưa thể đăng bộ sưu tập.");
   if (page === 1 && !searchQuery) setRefresh(current => current + 1); else router.push(facadePageHref(1));images.forEach(image=>URL.revokeObjectURL(image.preview));setImages([]);setCoverPreview(undefined);setTitle("");setContent("");setStyle("");setSpecs("");setNotice("Bộ sưu tập đã được đăng.");setOpen(false);
  }catch(error){setNotice(error instanceof Error?error.message:"Chưa thể đăng bộ sưu tập.");}finally{setSaving(false);}
 };
 const toggleComments=async(post:Post)=>{
  const next=!commentOpen[post.id];setCommentOpen(current=>({...current,[post.id]:next}));
  if(!next||threads[post.id]!==undefined)return;
  try{const response=await fetch(`/api/comments?postId=${post.id}`);const data=await response.json() as {comments?:Comment[]};setThreads(current=>({...current,[post.id]:response.ok?data.comments??[]:[]}));}catch{setThreads(current=>({...current,[post.id]:[]}));}
 };
 const chooseCommentImage=async(postId:number,event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];event.target.value="";if(!file)return;if(!file.type.startsWith("image/")){setNotice("Bình luận chỉ hỗ trợ tệp ảnh.");return;}setCommentUploading(current=>({...current,[postId]:true}));
  try{const form=new FormData();form.append("file",file);const response=await fetch("/api/files",{method:"POST",body:form});const data=await response.json() as {error?:string;attachment?:Attachment};if(!response.ok||!data.attachment)throw new Error(data.error||"Không thể tải ảnh bình luận.");setCommentImages(current=>({...current,[postId]:data.attachment}));setCommentOpen(current=>({...current,[postId]:true}));}catch(error){setNotice(error instanceof Error?error.message:"Không thể tải ảnh bình luận.");}finally{setCommentUploading(current=>({...current,[postId]:false}));}
 }; const sendComment=async(post:Post)=>{
  const value=(drafts[post.id]??"").trim();const image=commentImages[post.id];if((!value&&!image)||commentBusy[post.id]||commentUploading[post.id])return;setCommentBusy(current=>({...current,[post.id]:true}));
  try{const response=await fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({postId:post.id,content:value,imageKey:image?.key})});const data=await response.json() as {error?:string;comment?:Comment};if(!response.ok||!data.comment)throw new Error(data.error||"Chưa thể gửi bình luận.");setThreads(current=>({...current,[post.id]:[...(current[post.id]??[]),data.comment!]}));setPosts(current=>current.map(item=>item.id===post.id?{...item,comments:(item.comments??0)+1}:item));setDrafts(current=>({...current,[post.id]:""}));setCommentImages(current=>({...current,[post.id]:undefined}));setCommentOpen(current=>({...current,[post.id]:true}));}catch(error){setNotice(error instanceof Error?error.message:"Chưa thể gửi bình luận.");}finally{setCommentBusy(current=>({...current,[post.id]:false}));}
 };
 return <>
  <section className="grid grid-cols-[62px_minmax(0,1fr)] gap-3">
   <button type="button" onClick={()=>setOpen(true)} className="grid size-[62px] place-items-center rounded-2xl border border-[#dfe5eb] bg-white text-[#168ac0] shadow-sm transition hover:border-[#b9dceb] hover:bg-[#f7fbfd]" aria-label="Chia sẻ bộ sưu tập của bạn" title="Chia sẻ bộ sưu tập của bạn">
    <Plus size={26} strokeWidth={2.25}/>
   </button>
   <form onSubmit={submitSearch} className="flex h-[62px] items-center gap-3 rounded-2xl border border-[#dfe5eb] bg-white px-5 shadow-sm focus-within:border-[#229ed9] focus-within:ring-2 focus-within:ring-[#229ed9]/10">
    <Search size={20} className="shrink-0 text-[#667085]"/>
    <input value={query} onChange={event=>setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#182230] outline-none placeholder:text-[#98a2b3]" placeholder="Tìm theo tên mẫu, phong cách hoặc người đăng..." aria-label="Tìm kiếm mặt tiền" maxLength={120}/>
    {query&&<button type="button" onClick={()=>{setQuery("");router.push(facadePageHref(1));}} className="grid size-8 shrink-0 place-items-center rounded-full text-[#667085] hover:bg-[#f2f4f7]" aria-label="Xóa tìm kiếm"><X size={17}/></button>}
    <button type="submit" className="shrink-0 text-sm font-bold text-[#168ac0]">Tìm</button>
   </form>
  </section>
  {notice&&<p role="status" className={`mt-3 text-center text-sm font-semibold ${notice.includes("đã được đăng") ? "text-emerald-600" : "text-rose-600"}`}>{notice}</p>}

  {loading && <p role="status" className="mt-5 text-center text-sm text-[#667085]">Đang tải mặt tiền...</p>}
  {!loading && <section className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-label="Danh sách mặt tiền">
   {visiblePosts.map(post=>{
    const photos=post.attachments?.filter(a=>a.type.startsWith("image/"))??[];
    const cover=photos[0];
    return <article key={post.id} className="group flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#e3eaf2] bg-white shadow-[0_5px_20px_rgba(24,49,39,.045)]">
     <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-[#eef2f6]">
      {cover ? <>
       <img src={cover.url} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/>
       <ProjectGallery model={{title:post.title,meta:post.location||"Chưa cập nhật",style:post.feeling||"Bộ sưu tập ảnh",image:cover.url,photos:photos.map(photo=>photo.url)}} trigger="overlay"/>
       {photos.length>1&&<span className="pointer-events-none absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-bold text-white"><Images size={15}/>{photos.length} ảnh</span>}
      </> : <span className="grid size-full place-items-center text-[#8aa0b5]"><Images size={42}/></span>}
      {post.feeling&&<span className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] truncate rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-bold text-[#0b2e59] backdrop-blur">{post.feeling}</span>}
     </div>
     <div className="flex flex-1 flex-col p-3">
      <OwnerPostControls postId={post.id}/><h3 className="catalog-card-title text-base font-extrabold tracking-[-.02em]">{post.title}</h3>
      <p className="mt-2 flex min-h-5 items-center gap-2 text-sm font-medium text-[#3f5064]"><Maximize2 size={15} className="shrink-0"/>{post.location||"Chưa cập nhật kích thước"}</p>
      <p className="catalog-card-author mt-2 text-sm text-[#66778a]">Đăng bởi <a href={`/nguoi-dung/${encodeURIComponent(post.userId)}`} className="font-semibold text-[#0b2e59] hover:text-[#229ed9] hover:underline">{post.authorName}</a></p>
      {post.content&&<p className="mt-2 line-clamp-2 text-sm text-[#667085]">{post.content}</p>}
      <div className="mt-auto"><ModelCardFooter title={post.title} meta={post.location||"Chưa cập nhật kích thước"} targetType="post" targetId={String(post.id)} recipientUserId={post.userId} comments={post.comments??0} expertQuestions={post.expertQuestions??0} commentOpen={Boolean(commentOpen[post.id])} onToggleComments={()=>void toggleComments(post)} onQuestionSent={()=>setRefresh(current=>current+1)}/></div>
     </div>{commentOpen[post.id]&&<div className="space-y-2 border-t bg-[#fbfcfd] p-3">{threads[post.id]?.map(comment=><div key={comment.id} className="rounded-2xl bg-[#eef1f4] px-3 py-2"><b className="block text-xs text-[#182230]">{comment.authorName}</b>{comment.content&&<p className="mt-0.5 whitespace-pre-wrap text-sm text-[#344054]">{comment.content}</p>}{comment.imageUrl&&<img src={comment.imageUrl} onError={(event) => { event.currentTarget.hidden = true; }} alt="Ảnh trong bình luận" className="mt-2 max-h-64 max-w-full rounded-xl object-contain"/>}</div>)}{threads[post.id]===undefined&&<p className="text-center text-xs text-[#667085]">Đang tải bình luận...</p>}{threads[post.id]?.length===0&&<p className="text-center text-xs text-[#667085]">Chưa có bình luận.</p>}<div className="flex items-start gap-2"><img src="/avatars/user-nguyen-van-a.png" alt="" className="size-8 rounded-full object-cover"/><div className="min-w-0 flex-1">{commentImages[post.id]&&<div className="relative mb-2 w-fit"><img src={commentImages[post.id]?.url} alt="Ảnh chuẩn bị gửi" className="max-h-28 rounded-xl object-contain"/><button type="button" onClick={()=>setCommentImages(current=>({...current,[post.id]:undefined}))} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#344054] text-white" aria-label="Bỏ ảnh"><X size={14}/></button></div>}<div className="flex items-center rounded-full bg-[#eef1f4] pl-3 pr-1"><input value={drafts[post.id]??""} onChange={event=>setDrafts(current=>({...current,[post.id]:event.target.value}))} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void sendComment(post);}}} maxLength={600} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Viết bình luận..."/><label className="grid size-8 shrink-0 cursor-pointer place-items-center text-[#229ed9]" aria-label="Thêm ảnh"><ImageIcon size={17}/><input type="file" accept="image/*" className="sr-only" disabled={commentUploading[post.id]} onChange={event=>void chooseCommentImage(post.id,event)}/></label><button type="button" onClick={()=>void sendComment(post)} disabled={commentBusy[post.id]||commentUploading[post.id]||(!(drafts[post.id]??"").trim()&&!commentImages[post.id])} className="grid size-8 shrink-0 place-items-center text-[#229ed9] disabled:text-[#bcc0c4]" aria-label="Gửi bình luận"><Send size={16}/></button></div></div></div></div>}</article>})}
   {visibleModels.map(model => <div key={model.key} className="min-w-0 [&>article]:h-full">{model.card}</div>)}
  </section>}
  {!loading && visiblePosts.length === 0 && visibleModels.length === 0 && <p className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-[#667085]">{searchQuery ? "Không tìm thấy mặt tiền phù hợp trên trang này." : "Trang này chưa có mẫu mặt tiền."}</p>}
  {!loading && <nav aria-label="Phân trang mặt tiền" className="mt-6 flex flex-wrap items-center justify-center gap-2">
   {page > 1 && <ClientNavigationLink href={facadePageHref(page - 1, searchQuery)} rel="prev" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Trước</ClientNavigationLink>}
   {pageNumbers.map((number, index) => <span key={number} className="flex items-center gap-2">{index > 0 && number - pageNumbers[index - 1] > 1 && <span aria-hidden="true">…</span>}<ClientNavigationLink href={facadePageHref(number, searchQuery)} aria-label={`Trang ${number}`} aria-current={number === page ? "page" : undefined} className={`grid size-10 place-items-center rounded-lg border text-sm font-bold ${number === page ? "border-[#229ed9] bg-[#229ed9] text-white" : "bg-white text-[#0b2e59] hover:border-[#229ed9]"}`}>{number}</ClientNavigationLink></span>)}
   {page < pagination.totalPages && <ClientNavigationLink href={facadePageHref(page + 1, searchQuery)} rel="next" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Sau</ClientNavigationLink>}
   <p className="w-full text-center text-xs text-[#667085]">Trang {page} / {pagination.totalPages} · {pagination.total} mẫu mặt tiền</p>
  </nav>}

  <Dialog open={open} onOpenChange={next=>{if(!saving)setOpen(next);}}>
   <DialogContent showCloseButton={false} className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[540px] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0">
    <header className="relative border-b px-14 py-4 text-center"><DialogTitle className="text-xl font-extrabold">Tạo bộ sưu tập ảnh</DialogTitle><DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose></header>
    <form onSubmit={publish} className="min-h-0 overflow-y-auto p-4">
     <fieldset disabled={saving} className="min-w-0">
     <div className="flex items-center gap-3"><img src="/avatars/user-nguyen-van-a.png" alt="" className="size-10 rounded-full object-cover"/><div><b className="block text-sm">Thành viên Tipook</b><small className="text-[#667085]">Công khai</small></div></div>
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
