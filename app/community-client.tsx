"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight, BarChart3, BookOpen, Bookmark, CalendarDays, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock3, Compass, FileText, HardHat, Heart, Home, Image as ImageIcon,
  Layers3, MapPin, MessageCircle, Plus, Search, Send, Share2, Smile, Sparkles, TrendingUp,
  Users, WalletCards, X
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RequestActionButton, ShareActionButton, ToggleActionButton } from "@/components/interactive-actions";

type PostAttachment = { id?: number; key: string; name: string; type: string; size: number; url: string };
type Post = { id: number; authorName: string; avatar?: string; category: string; title: string; content: string; location: string | null; comments: number; likes: number; createdAt: string; attachments?: PostAttachment[]; feeling?: string | null; audience?: string; background?: string | null; mentions?: string | null; pollQuestion?: string | null; pollOptions?: string | null };
type Comment = { id: number | string; authorName: string; content: string; createdAt: string };

const demoPosts: Post[] = [];

const stages = ["Chuẩn bị xây", "Thiết kế", "Chi phí thực tế", "Đang thi công", "Hoàn thiện"];
const feedCategories = ["Tất cả", "Nhật ký xây nhà", "Hỏi đáp", "Kinh nghiệm", "Chi phí", "Thiết kế", "Nhà thầu"];
const quickTopics = [
  { icon: WalletCards, title: "Dự toán chi phí", note: "Ước tính chi phí, lập kế hoạch tài chính", color: "bg-sky-50 text-[#229ed9]" },
  { icon: Layers3, title: "Mặt bằng công năng", note: "Tham khảo mẫu và chia sẻ mặt bằng đẹp", color: "bg-sky-50 text-sky-600" },
  { icon: HardHat, title: "Chọn nhà thầu", note: "Đánh giá, kinh nghiệm thực tế từ cộng đồng", color: "bg-sky-50 text-[#229ed9]" },
  { icon: Home, title: "Vật liệu hoàn thiện", note: "So sánh, đánh giá vật liệu xây dựng", color: "bg-emerald-50 text-emerald-600" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function AttachmentList({ attachments, removable = false, onRemove }: { attachments?: PostAttachment[]; removable?: boolean; onRemove?: (key: string) => void }) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-3 grid gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.key} className="relative overflow-hidden rounded-xl border border-[#dfe5eb] bg-[#f7f9fb]">
          {attachment.type.startsWith("image/") ? (
            <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
              <img src={attachment.url} alt={attachment.name} className="max-h-64 w-full object-cover" />
            </a>
          ) : (
            <a href={attachment.url + "&download=1"} className="flex min-w-0 items-center gap-3 p-3 text-left">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#e6f5fb] text-[#168ac0]"><FileText size={21} /></span>
              <span className="min-w-0">
                <b className="block truncate text-sm text-[#182230]">{attachment.name}</b>
                <small className="text-xs text-[#667085]">{attachment.type || "Tệp đính kèm"} · {formatFileSize(attachment.size)}</small>
              </span>
            </a>
          )}
          {removable && <button type="button" onClick={() => onRemove?.(attachment.key)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/95 text-black shadow" aria-label={"Xóa " + attachment.name}><X size={17}/></button>}
        </div>
      ))}
    </div>
  );
}
function PostExtras({ post }: { post: Post }) {
  const options = post.pollOptions?.split("|").filter(Boolean) ?? [];
  const tagged = post.mentions?.split(",").filter(Boolean) ?? [];
  return <>
    {tagged.length > 0 && <p className="mt-3 text-sm text-[#536273]">Cùng với <b>{tagged.join(", ")}</b></p>}
    {post.background && <div className={"mt-3 rounded-2xl p-6 text-center text-lg font-extrabold text-white " + (post.background === "sky" ? "bg-gradient-to-r from-sky-500 to-blue-600" : "bg-gradient-to-r from-emerald-500 to-teal-600")}>{post.content}</div>}
    {post.pollQuestion && options.length > 0 && <div className="mt-3 rounded-xl border border-[#dce5ef] bg-[#f8fafc] p-3"><b className="text-sm text-[#182230]">{post.pollQuestion}</b><div className="mt-2 grid gap-2">{options.map((option) => <ToggleActionButton key={option} actionType="poll-vote" targetType="post-poll" targetId={String(post.id) + ":" + option} label={option} activeLabel={"Đã chọn: " + option} icon="check" className="flex w-full items-center gap-2 rounded-lg border border-[#dce5ef] bg-white px-3 py-2 text-left text-sm font-semibold text-[#344054] hover:border-[#229ed9]"/>)}</div></div>}
  </>;
}
export default function CommunityClient() {
  const [posts, setPosts] = useState<Post[]>(demoPosts);
  const [active, setActive] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Chuẩn bị xây");
  const [location, setLocation] = useState("");
  const [audience, setAudience] = useState("Công khai");
  const [feeling, setFeeling] = useState("");
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Post | null>(null);
  const [thread, setThread] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [inlineThreads, setInlineThreads] = useState<Record<number, Comment[]>>({});
  const [inlineOpen, setInlineOpen] = useState<Record<number, boolean>>({});
  const [inlineDrafts, setInlineDrafts] = useState<Record<number, string>>({});
  const [inlineBusy, setInlineBusy] = useState<Record<number, boolean>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [sortNewest, setSortNewest] = useState(true);
  const [background, setBackground] = useState("");
  const [mentions, setMentions] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  useEffect(() => {
    fetch("/api/posts").then((r) => r.ok ? r.json() as Promise<{ posts?: Post[] }> : Promise.reject()).then(async (data) => {
      const loaded = data.posts ?? [];
      setPosts(loaded);
      if (loaded.length) {
        const response = await fetch("/api/likes?ids=" + loaded.map((post) => post.id).join(","));
        const likeData = await response.json() as { likedPostIds?: number[] };
        setLiked(Object.fromEntries((likeData.likedPostIds ?? []).map((id) => [String(id), true])));
      }
    }).catch(() => {});
  }, []);

  const selectPostFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (attachments.length + files.length > 10) {
      setNotice("Mỗi bài viết được đính kèm tối đa 10 tệp.");
      return;
    }
    setUploading(true);
    setNotice("");
    try {
      const uploaded: PostAttachment[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/files", { method: "POST", body: formData });
        const data = await response.json() as { error?: string; attachment?: PostAttachment };
        if (!response.ok) throw new Error(data.error || "Không thể tải lên " + file.name + ".");
        if (data.attachment) uploaded.push(data.attachment);
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tải tệp lên.");
    } finally {
      setUploading(false);
    }
  };
  const createPost = useCallback(async (values?: { title: string; content: string; category?: string; location?: string }) => {
    const payload = values
      ? { ...values, attachments: [] }
      : {
          title: title.trim() || content.trim().slice(0, 80),
          content,
          category,
          location,
          audience,
          feeling,
          background,
          mentions: mentions.split(",").map((item) => item.trim()).filter(Boolean),
          pollQuestion,
          pollOptions: pollOptions.map((item) => item.trim()).filter(Boolean),
          attachments: attachments.map(({ key, name, type, size }) => ({ key, name, type, size })),
        };
    if (!payload.title.trim() || !payload.content.trim()) throw new Error("Vui lòng nhập tiêu đề và nội dung.");
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string; post: Post };
      if (!response.ok) throw new Error(data.error || "Chưa thể đăng bài.");
      setPosts((current) => [{ ...data.post, attachments: data.post.attachments ?? attachments }, ...current]);
      setTitle(""); setContent(""); setLocation(""); setFeeling(""); setBackground(""); setMentions(""); setPollQuestion(""); setPollOptions(["", ""]); setAttachments([]); setOpen(false); setNotice("Bài viết đã được đăng.");
      return { id: data.post.id, title: data.post.title };
    } finally { setSaving(false); }
  }, [title, content, category, location, attachments, feeling, audience, background, mentions, pollQuestion, pollOptions]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "create_community_post", title: "Đăng bài cộng đồng",
      description: "Đăng một câu hỏi hoặc kinh nghiệm xây nhà lên bảng tin cộng đồng.",
      inputSchema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, category: { type: "string", enum: stages }, location: { type: "string" } }, required: ["title", "content"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input: unknown) => createPost(input as { title: string; content: string; category?: string; location?: string })
    }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, [createPost]);

  const visible = useMemo(() => posts.filter((post) =>
    (active === "Tất cả" || (active === "Chi phí" && post.category.includes("Chi phí")) || post.category === active) &&
    (post.title + " " + post.content + " " + (post.location ?? "")).toLowerCase().includes(query.toLowerCase())
  ).sort((a, b) => sortNewest ? b.createdAt.localeCompare(a.createdAt) : b.likes - a.likes), [posts, active, query, sortNewest]);

  const openPost = async (post: Post) => {
    setSelected(post);
    setCommentText("");
    try {
        const response = await fetch(`/api/comments?postId=${post.id}`);
        const data = await response.json() as { comments?: Comment[] };
        setThread(response.ok ? data.comments ?? [] : []);
    } catch { setThread([]); }
  };

  const likePost = async (post: Post) => {
    const key = String(post.id);
    const next = !liked[key];
    const delta = next ? 1 : -1;
    setLiked((current) => ({ ...current, [key]: next }));
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, likes: Math.max(item.likes + delta, 0) } : item));
    setSelected((current) => current?.id === post.id ? { ...current, likes: Math.max(current.likes + delta, 0) } : current);
    try {
      const response = await fetch("/api/likes", { method: next ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id }) });
      if (!response.ok) throw new Error();
    } catch {
      setLiked((current) => ({ ...current, [key]: !next }));
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, likes: Math.max(item.likes - delta, 0) } : item));
    }
  };

  const toggleInlineComments = async (post: Post) => {
    const next = !inlineOpen[post.id];
    setInlineOpen((current) => ({ ...current, [post.id]: next }));
    if (!next || inlineThreads[post.id]) return;
    try {
      const response = await fetch("/api/comments?postId=" + post.id);
      const data = await response.json() as { comments?: Comment[] };
      setInlineThreads((current) => ({ ...current, [post.id]: response.ok ? data.comments ?? [] : [] }));
    } catch {
      setInlineThreads((current) => ({ ...current, [post.id]: [] }));
    }
  };

  const sendInlineComment = async (post: Post) => {
    const value = (inlineDrafts[post.id] ?? "").trim();
    if (!value || inlineBusy[post.id]) return;
    setInlineBusy((current) => ({ ...current, [post.id]: true }));
    try {
      const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id, content: value }) });
      const data = await response.json() as { error?: string; comment?: Comment };
      if (!response.ok || !data.comment) throw new Error(data.error || "Chưa thể gửi bình luận.");
      setInlineThreads((current) => ({ ...current, [post.id]: [...(current[post.id] ?? []), data.comment as Comment] }));
      setInlineOpen((current) => ({ ...current, [post.id]: true }));
      setInlineDrafts((current) => ({ ...current, [post.id]: "" }));
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, comments: item.comments + 1 } : item));
      setSelected((current) => current?.id === post.id ? { ...current, comments: current.comments + 1 } : current);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Chưa thể gửi bình luận.");
    } finally {
      setInlineBusy((current) => ({ ...current, [post.id]: false }));
    }
  };
  const sendComment = async () => {
    const contentValue = commentText.trim();
    if (!selected || !contentValue) return;
    setCommentSaving(true);
    try {
      let comment: Comment;
      if (typeof selected.id === "number") {
        const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: selected.id, content: contentValue }) });
        const data = await response.json() as { error?: string; comment?: Comment };
        if (!response.ok) throw new Error(data.error);
        if (!data.comment) throw new Error("Phản hồi bình luận không hợp lệ.");
        comment = data.comment;
      } else {
        comment = { id: `local-${Date.now()}`, authorName: "Phúc Thiện", content: contentValue, createdAt: "Vừa xong" };
      }
      setThread((current) => [...current, comment]);
      setPosts((current) => current.map((item) => item.id === selected.id ? { ...item, comments: item.comments + 1 } : item));
      setSelected((current) => current ? { ...current, comments: current.comments + 1 } : current);
      setCommentText("");
    } finally { setCommentSaving(false); }
  };

  const openComposer = (mode?: "file" | "cost" | "poll") => {
    if (mode === "cost") setCategory("Chi phí thực tế");
    if (mode === "poll" && !pollQuestion) setPollQuestion("Bạn muốn hỏi ý kiến cộng đồng về điều gì?");
    setOpen(true);
    if (mode === "file") window.setTimeout(() => fileInputRef.current?.click(), 150);
  };

  return (
    <div className="min-h-screen bg-[#f5f8fc] pb-20 text-[#0b2e59] lg:pb-0">

      <main className="mx-auto grid max-w-[1568px] gap-x-4 gap-y-3 px-4 py-4 lg:px-0 lg:py-4 xl:grid-cols-[210px_minmax(0,890px)_436px]">
        <section className="mb-1 grid gap-4 xl:col-span-2 xl:col-start-2 xl:row-start-1 xl:grid-cols-[890px_436px]">
          <div className="relative h-[320px] overflow-hidden rounded-[18px] bg-[#083469] text-white shadow-[0_18px_45px_rgba(21,68,49,.15)]">
            <img src="/community-house.png" alt="Gia chủ trao đổi bản vẽ cùng kiến trúc sư tại công trình" className="absolute inset-0 h-full w-full scale-[1.01] object-cover object-center contrast-[1.12] saturate-[1.08]"/>
            <div className="absolute inset-0" style={{background: "linear-gradient(90deg, rgba(4,31,69,.92) 0%, rgba(6,43,90,.62) 32%, rgba(6,43,90,.20) 58%, rgba(6,43,90,0) 78%)"}}/>
            <div className="relative flex h-full max-w-[610px] flex-col justify-center p-7 sm:p-10">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur"><Sparkles size={15}/> Cộng đồng chia sẻ kinh nghiệm thật</div>
              <h1 className="text-[2rem] font-extrabold leading-[1.12] tracking-[-.045em] sm:text-[2.65rem]">Chuyện xây nhà,<br/><span className="text-[#bde7f8]">hỏi người đã trải qua.</span></h1>
              <p className="mt-3 max-w-[520px] text-base leading-7 text-white/85">Từ bản vẽ đầu tiên đến ngày về nhà mới — chia sẻ thật, kinh nghiệm thật, giúp bạn xây nhà dễ dàng hơn.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => setOpen(true)} className="rounded-full bg-[#229ed9] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-950/20 transition hover:bg-[#168ac0]">Đặt câu hỏi →</button><button onClick={() => document.getElementById("nhat-ky")?.scrollIntoView({behavior:"smooth"})} className="rounded-full border border-white/80 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15">Xem kinh nghiệm xây nhà</button></div>
            </div>
          </div>
          <div id="cam-nang" className="grid h-[320px] grid-cols-2 gap-3 scroll-mt-24">
            {quickTopics.map(({icon: Icon, title: topic, note, color}) => <button key={topic} onClick={() => { setQuery(topic.split(" ")[0]); window.scrollTo({top: 540, behavior: "smooth"}); }} className="group relative min-h-0 overflow-hidden rounded-[16px] border border-[#e6edf5] bg-white p-4 text-left shadow-[0_5px_18px_rgba(26,55,42,.04)] transition hover:-translate-y-0.5 hover:border-[#7bc8ea] hover:shadow-[0_10px_24px_rgba(26,55,42,.08)]">
              <span className={`grid size-12 place-items-center rounded-full ${color}`}><Icon size={22}/></span>
              <b className="mt-3 block text-[16px] leading-5">{topic}</b><small className="mt-1 block pr-6 text-xs leading-[18px] text-[#465a70]">{note}</small><ChevronRight className="absolute bottom-4 right-4 size-4 text-[#465a70] transition group-hover:translate-x-1 group-hover:text-[#229ed9]"/>
            </button>)}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:contents">
          <aside className="hidden lg:block xl:col-start-1 xl:w-[193px] xl:row-start-1 xl:row-span-2">
            <div className="sticky top-24 space-y-6">
              <nav className="space-y-1">
                {[{icon: Compass,label:"Khám phá"},{icon: TrendingUp,label:"Đang nổi"},{icon: MessageCircle,label:"Hỏi đáp"},{icon: BookOpen,label:"Cẩm nang"},{icon: Users,label:"Nhóm của tôi"}].map(({icon:Icon,label}, i) => <button key={label} onClick={() => { if (i === 0) { setActive("Tất cả"); setQuery(""); setSortNewest(true); } else if (i === 1) { setSortNewest(false); window.scrollTo({ top: 620, behavior: "smooth" }); } else if (i === 2) { setActive("Hỏi đáp"); window.scrollTo({ top: 620, behavior: "smooth" }); } else if (i === 3) window.location.href = "/cam-nang"; else window.location.href = "/tai-khoan"; }} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[15px] font-semibold ${i===0 ? "bg-[#e8f6fc] text-[#168ac0]" : "text-[#3f5064] hover:bg-white"}`}><Icon size={19}/>{label}</button>)}
              </nav>
              <div>
                <p className="mb-2 px-3 text-xs font-extrabold uppercase tracking-[.12em] text-[#3f5064]">Giai đoạn xây nhà</p>
                {stages.map((item, index) => <button key={item} onClick={() => setActive(item)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#3f5064] hover:bg-white"><span className={`size-2 rounded-full ${["bg-sky-400","bg-violet-400","bg-indigo-500","bg-cyan-600","bg-emerald-500"][index]}`}/>{item}</button>)}
              </div>
              <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#edf5ff] to-white p-4 ring-1 ring-[#dce8f4]"><svg aria-hidden="true" viewBox="0 0 76 68" className="mb-3 h-[68px] w-[76px] drop-shadow-[0_6px_12px_rgba(25,126,204,.16)]"><defs><linearGradient id="houseTile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e4f5ff"/><stop offset="1" stopColor="#b9e0ff"/></linearGradient></defs><rect x="5" y="13" width="52" height="50" rx="15" fill="url(#houseTile)"/><path d="M15 35.5 31 22l16 13.5v17.2a3.3 3.3 0 0 1-3.3 3.3H18.3a3.3 3.3 0 0 1-3.3-3.3Z" fill="#063a75"/><path d="m12.5 36 18.5-16 18.5 16" fill="none" stroke="#149ee9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><rect x="27" y="43" width="8.5" height="13" rx="2.2" fill="#fff"/><path d="M62 8v12M56 14h12" stroke="#128fd8" strokeWidth="3" strokeLinecap="round"/><path d="m68 24 1.5 3.2 3.5 1.5-3.5 1.5L68 34l-1.5-3.8-3.5-1.5 3.5-1.5Z" fill="#31b5f4"/><circle cx="65" cy="8" r="2.4" fill="#31b5f4"/></svg><p className="max-w-[150px] text-[15px] font-extrabold leading-[22px] text-[#0b3264]">Cùng nhau xây những ngôi nhà tốt hơn</p><p className="mt-3 text-xs italic leading-5 text-[#556a80]">Tri thức hôm nay,<br/>ngôi nhà bền vững mai sau</p><a href="/cam-nang" className="mt-3 flex w-full items-center justify-between text-sm font-medium text-[#0b3264]">Khám phá <span className="grid size-6 place-items-center rounded-full bg-[#dceafa]"><ArrowUpRight size={14}/></span></a></div>
            </div>
          </aside>

          <section className="min-w-0 xl:col-start-2 xl:row-start-2">
            <div className="mb-4 rounded-2xl border border-[#e4ebf3] bg-white p-4 shadow-[0_5px_18px_rgba(25,55,90,.05)]">
              <div className="flex items-center gap-3"><img src="/avatars/user-nguyen-van-a.png" alt="Nguyễn Văn A" className="size-12 shrink-0 rounded-full object-cover"/><button onClick={() => setOpen(true)} className="h-12 flex-1 rounded-xl bg-[#f4f7fb] px-4 text-left text-[15px] text-[#53677d] transition hover:bg-[#edf2f8]">Bạn đang băn khoăn điều gì khi xây nhà?</button></div>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[#edf1f6] pt-3"><button onClick={() => openComposer("file")} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#405874] hover:bg-[#f4f7fb]"><ImageIcon size={18} className="text-[#55779d]"/> Thêm hình ảnh</button><button onClick={() => openComposer("cost")} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#405874] hover:bg-[#f4f7fb]"><CircleDollarSign size={18} className="text-[#229ed9]"/> Chia sẻ chi phí</button><button onClick={() => openComposer("poll")} className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#405874] hover:bg-[#f4f7fb] sm:flex"><BarChart3 size={18} className="text-[#426b8d]"/> Tạo thăm dò</button><button onClick={() => setOpen(true)} className="ml-auto rounded-xl bg-[#229ed9] px-7 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#168ac0]">Đăng bài</button></div>
            </div>


            <div className="mb-4 flex min-h-9 items-center justify-between gap-3">
              <Tabs value={active} onValueChange={setActive} className="min-w-0 flex-1 gap-0"><TabsList className="h-9 w-full flex-nowrap justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 shadow-none scrollbar-none">{feedCategories.map((item) => <TabsTrigger key={item} value={item} className="h-8 flex-none rounded-full border-0 bg-transparent px-4 py-0 text-sm text-[#4b5f73] shadow-none after:hidden data-[state=active]:bg-[#229ed9] data-[state=active]:text-white data-[state=active]:shadow-none">{item}</TabsTrigger>)}</TabsList></Tabs><button onClick={() => setSortNewest((value) => !value)} className="hidden h-9 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-[#405874] sm:flex">{sortNewest ? "Mới nhất" : "Hữu ích nhất"} <ChevronRight className="size-4 rotate-90"/></button>
            </div>
            <a id="nhat-ky" href="/nhat-ky-xay-nha" className="mb-4 flex scroll-mt-24 items-center justify-between rounded-[18px] border border-[#dce8f4] bg-white px-5 py-4 text-[#0b2e59] shadow-sm transition hover:border-[#7bc8ea]"><span><b className="block">Nhật ký xây nhà</b><small className="mt-1 block text-[#536273]">Xem và chia sẻ hành trình thi công bằng dữ liệu thật.</small></span><ArrowUpRight size={20} className="text-[#229ed9]"/></a>
            {notice && <div className="mb-4 flex items-center justify-between rounded-xl bg-[#dff1e5] px-4 py-3 text-sm font-semibold text-[#168ac0]">{notice}<button onClick={() => setNotice("")}><X size={17}/></button></div>}

            <div className="mb-4 md:hidden"><label className="relative block"><Search className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#3f5064]"/><Input value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 rounded-xl bg-white pl-11" placeholder="Tìm trong cộng đồng..."/></label></div>

            <div className="space-y-4">
              {visible.map((post, index) => <article key={post.id} className="group rounded-[22px] border border-[#e4ebf3] bg-white p-5 shadow-[0_4px_18px_rgba(24,49,39,.035)] transition hover:border-[#bde7f8] sm:p-6">
                <div className="flex items-start gap-3"><img src={post.avatar ?? "/avatars/user-nguyen-van-a.png"} alt={post.authorName} className="size-11 shrink-0 rounded-full object-cover"/><div className="min-w-0"><p className="flex items-center gap-1.5 font-bold">{post.authorName}{index===1 && <CheckCircle2 size={15} className="fill-[#229ed9] text-white"/>}</p><p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-[#3f5064]"><Clock3 size={13}/>{post.createdAt}{post.location && <><span>·</span><MapPin size={13}/>{post.location}</>}</p></div><span className="ml-auto rounded-full bg-[#eef9fd] px-3 py-1 text-xs font-bold text-[#147aa8]">{post.category}</span></div>
                <button onClick={() => openPost(post)} className="block w-full text-left"><h2 className="mt-4 text-[1.2rem] font-extrabold leading-snug tracking-[-.02em] transition group-hover:text-[#229ed9]">{post.title}</h2>{post.feeling && <p className="mt-2 text-sm font-semibold text-[#168ac0]">cảm thấy {post.feeling}</p>}<p className="mt-2 line-clamp-3 text-[15px] leading-7 text-[#3f5064]">{post.content}</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#229ed9]">Đọc thảo luận <ChevronRight size={15}/></span></button><PostExtras post={post}/><AttachmentList attachments={post.attachments} />
                <div className="mt-5 flex flex-wrap items-center justify-start gap-1 border-t border-[#edf1f6] pt-3">
                  <button onClick={() => likePost(post)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2.5 text-sm font-semibold hover:bg-[#eef9fd] hover:text-[#168ac0] ${liked[String(post.id)] ? "bg-[#eef9fd] text-[#168ac0]" : "text-[#3f5064]"}`}><Heart size={18} className={liked[String(post.id)] ? "fill-current" : ""}/><span>{post.likes} <span className="hidden sm:inline">hữu ích</span></span></button>
                  <button onClick={() => toggleInlineComments(post)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2.5 text-sm font-semibold hover:bg-[#eef9fd] hover:text-[#229ed9] ${inlineOpen[post.id] ? "bg-[#eef9fd] text-[#229ed9]" : "text-[#3f5064]"}`}><MessageCircle size={18}/><span>{post.comments} <span className="hidden sm:inline">bình luận</span></span></button>
                  <ShareActionButton title={post.title} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-[#3f5064] hover:bg-[#eef9fd] hover:text-[#229ed9]"/>
                  <ToggleActionButton actionType="save" targetType="post" targetId={String(post.id)} label="Lưu bài" activeLabel="Đã lưu" icon="bookmark" className="flex items-center gap-1.5 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-[#3f5064] hover:bg-[#f7f9fc]"/>
                </div>
                {inlineOpen[post.id] && <div className="mt-3 space-y-3 border-t border-[#edf1f6] pt-3">
                  {(inlineThreads[post.id] ?? []).map((comment) => <div key={comment.id} className="flex items-start gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d9f1fb] text-sm font-extrabold text-[#168ac0]">{comment.authorName.charAt(0)}</span><div className="min-w-0"><div className="rounded-2xl bg-[#f0f2f5] px-3.5 py-2"><b className="block text-sm text-[#182230]">{comment.authorName}</b><p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-[#344054]">{comment.content}</p></div><button type="button" onClick={() => setInlineDrafts((current) => ({ ...current, [post.id]: "@" + comment.authorName + " " }))} className="ml-3 mt-1 text-xs font-bold text-[#667085] hover:text-[#229ed9]">Trả lời</button></div></div>)}
                  {!inlineThreads[post.id] && <p className="py-2 text-center text-sm text-[#667085]">Đang tải bình luận...</p>}
                  {inlineThreads[post.id]?.length === 0 && <p className="py-2 text-center text-sm text-[#667085]">Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>}
                </div>}
                <div className="mt-3 flex items-center gap-2.5">
                  <img src="/avatars/user-nguyen-van-a.png" alt="Ảnh đại diện của bạn" className="size-9 shrink-0 rounded-full object-cover"/>
                  <div className="flex min-w-0 flex-1 items-center rounded-full bg-[#f0f2f5] pl-4 pr-1.5">
                    <input value={inlineDrafts[post.id] ?? ""} onChange={(event) => setInlineDrafts((current) => ({ ...current, [post.id]: event.target.value }))} onFocus={() => { if (!inlineOpen[post.id]) void toggleInlineComments(post); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendInlineComment(post); } }} className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[#182230] outline-none placeholder:text-[#65676b]" placeholder="Viết bình luận..." maxLength={600}/>
                    <button type="button" onClick={() => void sendInlineComment(post)} disabled={inlineBusy[post.id] || !(inlineDrafts[post.id] ?? "").trim()} className="grid size-8 shrink-0 place-items-center rounded-full text-[#229ed9] hover:bg-white disabled:text-[#bcc0c4]" aria-label="Gửi bình luận"><Send size={17}/></button>
                  </div>
                </div>
              </article>)}
              {!visible.length && <div className="rounded-2xl bg-white p-10 text-center"><Search className="mx-auto mb-3 text-[#3f5064]"/><p className="font-bold">Chưa tìm thấy bài viết phù hợp</p><p className="mt-1 text-sm text-[#3f5064]">Thử từ khóa hoặc chuyên mục khác nhé.</p></div>}
            </div>
          </section>

          <aside className="hidden xl:col-start-3 xl:row-start-2 xl:block">
            <div className="sticky top-24 space-y-5">
              <div id="chuyen-gia" className="scroll-mt-24 overflow-hidden rounded-[16px] bg-[#168ac0] shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 text-white"><div><h3 className="text-[20px] font-extrabold">Hỏi chuyên gia</h3><p className="mt-1 text-xs text-white/90">Câu hỏi được lưu và theo dõi trong tài khoản</p></div><a href="/hoi-chuyen-gia" className="text-xs font-semibold">Xem tất cả →</a></div>
                <div className="bg-white px-5">
                  {[["/avatars/expert-khanh-linh.png","KTS. Khánh Linh","Thiết kế nhà phố, biệt thự"],["/avatars/expert-trong-hieu.png","KS. Trọng Hiếu","Kết cấu & thi công"],["/avatars/expert-vu-mai.png","Vũ Mai","Dự toán công trình"]].map(([avatar,name,job]) => <div key={name} className="flex min-h-[78px] items-center gap-3 border-b border-[#edf1f6] last:border-b-0"><img src={avatar} alt={name} className="size-12 rounded-full object-cover"/><span className="min-w-0 flex-1"><b className="block truncate text-sm text-[#0b2e59]">{name}</b><small className="mt-1 block truncate text-xs text-[#465a70]">{job}</small></span><RequestActionButton requestType="expert-question" targetType="expert" targetId={name} label="Đặt câu hỏi" title={"Hỏi " + name} description={"Chuyên môn: " + job} allowFile className="shrink-0 rounded-full border border-[#7bc8ea] px-3.5 py-2 text-[12px] font-bold text-[#229ed9]"/></div>)}
                </div>
              </div>              <div className="rounded-[18px] bg-white p-5 shadow-[0_5px_18px_rgba(25,55,90,.05)] ring-1 ring-[#edf2f7]">
                <div className="flex items-center justify-between"><h3 className="text-[20px] font-extrabold text-[#0b2e59]">Nhóm theo khu vực</h3><a href="/tai-khoan" className="text-xs font-bold text-[#147aa8]">Nhóm của tôi →</a></div>
                <div className="mt-4 flex items-center gap-3">
                  <img src="/mau-nha-pho-xanh.png" alt="Xây nhà Bình Dương" className="size-16 shrink-0 rounded-xl object-cover"/>
                  <div className="min-w-0 flex-1"><b className="block truncate text-sm text-[#0b2e59]">Xây nhà Bình Dương</b><p className="mt-1 flex items-center gap-1 text-[11px] text-[#556a80]"><MapPin size={12}/>Bình Dương và khu vực lân cận</p></div>
                  <ToggleActionButton actionType="join" targetType="group" targetId="xay-nha-binh-duong" label="Tham gia" activeLabel="Đã tham gia" icon="follow" className="shrink-0 flex items-center gap-1 rounded-full border border-[#7bc8ea] px-3 py-2 text-[12px] font-bold text-[#229ed9]"/>
                </div>
              </div>
              <div className="rounded-[22px] bg-[#eef9fd] p-5 ring-1 ring-[#d5e8f1]"><div className="flex items-center gap-2 text-[#147aa8]"><CalendarDays size={19}/><b className="text-sm">PHÒNG TRÒ CHUYỆN · 20:30</b></div><h3 className="mt-3 font-extrabold leading-5">5 khoản dễ đội chi phí khi hoàn thiện</h3><p className="mt-2 text-sm leading-5 text-[#3f5064]">Cùng kỹ sư dự toán Nguyễn Trọng Hiếu</p><ToggleActionButton actionType="reminder" targetType="event" targetId="chi-phi-hoan-thien-2030" label="Đặt lịch nhắc" activeLabel="Đã đặt lịch" icon="check" className="mt-4 flex items-center gap-1 text-sm font-extrabold text-[#147aa8]"/></div>
            </div>
          </aside>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-17 grid-cols-5 border-t border-[#e3eaf2] bg-white px-2 lg:hidden">
        <Link href="/" className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#229ed9]"><Home size={19}/>Trang chủ</Link>
        <a href="/mau-nha-dep" className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#3f5064]"><Sparkles size={19}/>Mẫu nhà</a>
        <button onClick={()=>setOpen(true)} className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#3f5064]"><span className="grid size-9 place-items-center rounded-full bg-[#229ed9] text-white"><Plus size={20}/></span>Đăng bài</button>
        <a href="/mat-bang-cong-nang" className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#3f5064]"><Layers3 size={19}/>Mặt bằng</a>
        <button onClick={() => { setActive("Hỏi đáp"); window.scrollTo({top: 620, behavior: "smooth"}); }} className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#3f5064]"><MessageCircle size={19}/>Hỏi đáp</button>
      </nav>

      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto border-l-[#e3eaf2] bg-[#f4f7fb] p-0 sm:max-w-[620px]">
          {selected && <>
            <div className="bg-white px-5 pb-5 pt-6 sm:px-7">
              <SheetHeader className="text-left">
                <div className="mb-2 flex items-center gap-3"><img src={selected.avatar ?? "/avatars/user-nguyen-van-a.png"} alt={selected.authorName} className="size-11 rounded-full object-cover"/><div><p className="font-bold">{selected.authorName}</p><p className="flex items-center gap-1.5 text-sm text-[#3f5064]"><Clock3 size={13}/>{selected.createdAt}{selected.location && <> · <MapPin size={13}/>{selected.location}</>}</p></div></div>
                <span className="w-fit rounded-full bg-[#eef9fd] px-3 py-1 text-xs font-bold text-[#147aa8]">{selected.category}</span>
                <SheetTitle className="pt-2 text-2xl font-extrabold leading-tight tracking-[-.03em] text-[#0b2e59] sm:text-3xl">{selected.title}</SheetTitle>
                <SheetDescription className="pt-2 text-base leading-7 text-[#3f5064]">{selected.content}</SheetDescription>
              </SheetHeader>
              <PostExtras post={selected}/>
              <AttachmentList attachments={selected.attachments} />
              <div className="mt-5 flex items-center gap-2 border-t border-[#edf1f6] pt-4">
                <button onClick={() => likePost(selected)} className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold ${liked[String(selected.id)] ? "bg-[#eef9fd] text-[#168ac0]" : "bg-[#f7f9fc] text-[#3f5064]"}`}><Heart size={18} className={liked[String(selected.id)] ? "fill-current" : ""}/>{selected.likes} hữu ích</button>
                <ToggleActionButton actionType="save" targetType="post" targetId={String(selected.id)} label="Lưu bài" activeLabel="Đã lưu" icon="bookmark" className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#3f5064] hover:bg-[#f7f9fc]"/>
                <ShareActionButton title={selected.title} className="ml-auto flex size-10 items-center justify-center rounded-xl bg-[#f7f9fc] text-[#3f5064] [&>span]:sr-only"/>
              </div>
            </div>

            <div className="px-5 py-6 sm:px-7">
              <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-extrabold">{selected.comments} bình luận</h3><span className="text-sm font-medium text-[#3f5064]">Cũ nhất trước</span></div>
              <div className="space-y-3">
                {thread.map((comment, index) => <div key={comment.id} className="rounded-2xl border border-[#e4ebf3] bg-white p-4">
                  <div className="flex items-center gap-2"><span className={`grid size-9 place-items-center rounded-full text-sm font-extrabold ${index % 2 ? "bg-[#e8edfa] text-[#5368a6]" : "bg-[#d9f1fb] text-[#229ed9]"}`}>{comment.authorName.charAt(0)}</span><div><b className="block text-sm">{comment.authorName}</b><small className="text-[#3f5064]">{comment.createdAt.includes("T") ? "Vừa gần đây" : comment.createdAt}</small></div></div>
                  <p className="mt-3 text-[15px] leading-6 text-[#3f5064]">{comment.content}</p>
                  <button onClick={() => setCommentText("@" + comment.authorName + " ")} className="mt-3 text-xs font-bold text-[#3f5064] hover:text-[#229ed9]">Trả lời</button>
                </div>)}
                {!thread.length && <div className="rounded-2xl border border-dashed border-[#dce5ef] bg-white/70 p-7 text-center"><MessageCircle className="mx-auto text-[#3f5064]"/><p className="mt-2 font-bold">Chưa có bình luận</p><p className="mt-1 text-sm text-[#3f5064]">Hãy là người đầu tiên chia sẻ kinh nghiệm.</p></div>}
              </div>
              <div className="sticky bottom-0 mt-5 rounded-2xl border border-[#d5e8f1] bg-white p-3 shadow-[0_-8px_24px_rgba(23,49,38,.08)]">
                <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="min-h-24 resize-none border-0 p-2 text-base shadow-none focus-visible:ring-0" placeholder="Chia sẻ kinh nghiệm hoặc đặt câu hỏi..." maxLength={600}/>
                <div className="mt-2 flex items-center justify-between border-t border-[#edf1f6] pt-3"><span className="text-xs text-[#3f5064]">{commentText.length}/600</span><Button disabled={commentSaving || !commentText.trim()} onClick={sendComment} className="h-10 rounded-xl bg-[#229ed9] px-4 font-bold hover:bg-[#168ac0]"><Send size={16}/>{commentSaving ? "Đang gửi..." : "Bình luận"}</Button></div>
              </div>
            </div>
          </>}
        </SheetContent>
      </Sheet>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[520px] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-[0_18px_60px_rgba(0,0,0,.28)]">
          <DialogHeader className="relative shrink-0 border-b border-[#e4e6eb] px-14 py-[18px] text-center sm:text-center">
            <DialogTitle className="text-xl font-bold leading-6 text-[#050505]">Tạo bài viết</DialogTitle>
            <DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770] transition hover:bg-[#d8dadf]" aria-label="Đóng"><X size={22}/></DialogClose>
          </DialogHeader>

          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); createPost().catch((err) => setNotice(err.message)); }}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-4">
              <div className="flex items-start gap-3">
                <img src="/avatars/user-nguyen-van-a.png" alt="Thành viên ROOM" className="size-10 shrink-0 rounded-full object-cover"/>
                <div className="min-w-0">
                  <b className="block truncate text-[15px] font-semibold leading-5 text-[#050505]">Thành viên ROOM</b>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <select value={audience} onChange={(e) => setAudience(e.target.value)} className="h-6 rounded-md border-0 bg-[#e4e6eb] px-2 text-xs font-semibold text-[#050505] outline-none">
                      <option>Công khai</option><option>Chỉ thành viên</option><option>Chỉ mình tôi</option>
                    </select>
                    <button type="button" onClick={() => setFeeling(feeling ? "" : "hào hứng")} className="h-6 rounded-md bg-[#e4e6eb] px-2 text-xs font-semibold text-[#050505] hover:bg-[#d8dadf]">{feeling ? "Cảm thấy " + feeling : "Nhắn AI đang tắt"}</button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[150px] resize-none border-0 p-0 text-[22px] leading-8 text-[#050505] shadow-none placeholder:text-[#65676b] focus-visible:ring-0 sm:min-h-[175px]" placeholder="Bạn đang nghĩ gì thế?" maxLength={1200}/>
                <div className="mt-1 flex items-center justify-between">
                  <button type="button" onClick={() => setBackground((value) => value === "sky" ? "emerald" : value === "emerald" ? "" : "sky")} className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-[#229ed9] via-[#2aabee] to-[#06b6d4] text-lg font-black text-white shadow-sm" aria-label="Thêm nền bài viết">Aa</button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#8a8d91]">{content.length}/1200</span>
                    <button type="button" onClick={() => setFeeling(feeling ? "" : "hào hứng")} className="grid size-9 place-items-center rounded-full text-[#65676b] hover:bg-[#f0f2f5]" aria-label="Thêm cảm xúc"><Smile size={24}/></button>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[#65676b]">Chuyên mục<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ced0d4] bg-white px-3 text-sm text-[#050505] outline-none focus:border-[#229ed9]">{stages.map((item) => <option key={item}>{item}</option>)}<option>Hỏi đáp</option><option>Kinh nghiệm</option><option>Nhật ký xây nhà</option></select></label>
                <label className="text-xs font-semibold text-[#65676b]">Gắn thẻ<input value={mentions} onChange={(event) => setMentions(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ced0d4] px-3 text-sm text-[#050505] outline-none focus:border-[#229ed9]" placeholder="Tên, cách nhau bằng dấu phẩy"/></label>
              </div>
              {background && <p className={"mt-3 rounded-xl p-3 text-sm font-semibold text-white " + (background === "sky" ? "bg-gradient-to-r from-sky-500 to-blue-600" : "bg-gradient-to-r from-emerald-500 to-teal-600")}>Nền màu sẽ được áp dụng cho bài viết.</p>}
              {pollQuestion && <div className="mt-3 rounded-xl border border-[#d8dadf] p-3"><div className="flex items-center justify-between gap-2"><b className="text-sm text-[#050505]">Thăm dò ý kiến</b><button type="button" onClick={() => { setPollQuestion(""); setPollOptions(["", ""]); }} className="text-xs font-bold text-rose-600">Xóa</button></div><input value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[#ced0d4] px-3 text-sm" placeholder="Câu hỏi"/>{pollOptions.map((option, index) => <input key={index} value={option} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="mt-2 h-10 w-full rounded-lg border border-[#ced0d4] px-3 text-sm" placeholder={"Lựa chọn " + (index + 1)}/>)}</div>}
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="sr-only" aria-label="Tiêu đề bài viết" maxLength={120}/>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} className="sr-only" id="post-location" aria-label="Vị trí" maxLength={60}/>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={selectPostFiles}/>
              <AttachmentList attachments={attachments} removable onRemove={(key) => { setAttachments((current) => current.filter((item) => item.key !== key)); fetch("/api/files?key=" + encodeURIComponent(key), { method: "DELETE" }).catch(() => {}); }} />
              {uploading && <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#eef9fd] px-3 py-2 text-sm font-medium text-[#168ac0]"><span className="size-2 animate-pulse rounded-full bg-[#229ed9]"/>Đang tải tệp lên...</div>}
            </div>

            <div className="shrink-0 border-t border-[#f0f2f5] bg-white px-4 pb-4 pt-3">
              <div className="flex min-h-14 items-center justify-between rounded-xl border border-[#ced0d4] px-3 shadow-[0_1px_2px_rgba(0,0,0,.08)]">
                <span className="hidden min-w-0 text-[15px] font-semibold text-[#050505] sm:block">Thêm vào bài viết</span>
                <span className="text-sm font-semibold text-[#050505] sm:hidden">Thêm</span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="grid size-10 place-items-center rounded-full text-[#45bd62] hover:bg-[#f0f2f5] disabled:opacity-50" aria-label="Đính kèm tệp"><ImageIcon size={24}/></button>
                  <button type="button" onClick={() => { const value = window.prompt("Nhập tên người muốn gắn thẻ, cách nhau bằng dấu phẩy", mentions); if (value !== null) setMentions(value); }} className="grid size-10 place-items-center rounded-full text-[#1877f2] hover:bg-[#f0f2f5]" aria-label="Gắn thẻ bạn bè"><Users size={23}/></button>
                  <button type="button" onClick={() => setFeeling(feeling ? "" : "hào hứng")} className="grid size-10 place-items-center rounded-full text-[#f7b928] hover:bg-[#f0f2f5]" aria-label="Cảm xúc"><Smile size={24}/></button>
                  <Popover>
                    <PopoverTrigger asChild><button type="button" className="grid size-10 place-items-center rounded-full text-[#f5533d] hover:bg-[#f0f2f5]" aria-label="Thêm vị trí"><MapPin size={23}/></button></PopoverTrigger>
                    <PopoverContent align="end" sideOffset={8} collisionPadding={16} className="z-[100] w-72 rounded-xl border-[#d8dadf] bg-white p-3 shadow-xl">
                      <label className="block text-sm font-semibold text-[#050505]">Vị trí</label>
                      <input value={location} onChange={(event) => setLocation(event.target.value)} autoFocus className="mt-2 h-10 w-full rounded-lg border border-[#ced0d4] bg-[#f0f2f5] px-3 text-sm text-[#050505] outline-none focus:border-[#229ed9] focus:bg-white" placeholder="Bạn đang ở đâu?"/>
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild><button type="button" className="grid size-10 place-items-center rounded-full text-[#65676b] hover:bg-[#f0f2f5]" aria-label="Thêm lựa chọn khác"><span className="-mt-1 text-xl font-bold tracking-widest">•••</span></button></PopoverTrigger>
                    <PopoverContent align="end" sideOffset={8} collisionPadding={16} className="z-[100] w-64 rounded-xl border-[#d8dadf] bg-white p-2 shadow-xl">
                      <p className="px-2 pb-2 pt-1 text-sm font-bold text-[#050505]">Thêm vào bài viết</p>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-semibold text-[#344054] hover:bg-[#f2f4f7]"><FileText size={19} className="text-[#45bd62]"/>Tải tệp bất kỳ</button>
                      <button type="button" onClick={() => setFeeling(feeling ? "" : "hào hứng")} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-semibold text-[#344054] hover:bg-[#f2f4f7]"><Smile size={19} className="text-[#f7b928]"/>{feeling ? "Bỏ cảm xúc" : "Thêm cảm xúc"}</button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {notice && notice !== "Bài viết đã được đăng." && <p className="mt-2 rounded-lg bg-[#eef9fd] px-3 py-2 text-sm text-[#147aa8]">{notice}</p>}
              <Button disabled={saving || uploading || !content.trim()} className="mt-3 h-10 w-full rounded-lg bg-[#229ed9] text-[15px] font-bold text-white shadow-none hover:bg-[#168ac0] disabled:bg-[#e4e6eb] disabled:text-[#bcc0c4]">{uploading ? "Đang tải tệp..." : saving ? "Đang đăng..." : "Đăng bài"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>    </div>
  );
}
