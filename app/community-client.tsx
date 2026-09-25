"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3, BookOpen, CheckCircle2,
  CircleDollarSign, Clock3, FileText, Heart, Home, Image as ImageIcon,
  MapPin, MessageCircle, Search, Send, Smile, TrendingUp,
  Users, X
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RequestActionButton, ShareActionButton, ToggleActionButton } from "@/components/interactive-actions";

type PostAttachment = { id?: number; key: string; name: string; type: string; size: number; url: string };
type Post = { id: number; authorName: string; avatar?: string; category: string; title: string; content: string; location: string | null; comments: number; likes: number; createdAt: string; attachments?: PostAttachment[]; feeling?: string | null; audience?: string; background?: string | null; mentions?: string | null; pollQuestion?: string | null; pollOptions?: string | null; shares?: number };
type Comment = { id: number | string; authorName: string; content: string; createdAt: string; imageKey?: string | null; imageUrl?: string | null };

const demoPosts: Post[] = [];

const stages = ["Chuẩn bị xây", "Thiết kế", "Chi phí thực tế", "Đang thi công", "Hoàn thiện"];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value.replace(" ", "T")).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Vừa xong";
  if (seconds < 3600) return Math.floor(seconds / 60) + " phút";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " giờ";
  if (seconds < 604800) return Math.floor(seconds / 86400) + " ngày";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(timestamp));
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
function HashtagText({ text, onSelect }: { text: string; onSelect: (hashtag: string) => void }) {
  return <>{text.split(/(#[\p{L}\p{N}_]+)/gu).map((part, index) => part.startsWith("#") ? <button type="button" key={part + index} onClick={() => onSelect(part.slice(1))} className="font-semibold text-[#168ac0] hover:underline">{part}</button> : part)}</>;
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
  const [inlineImages, setInlineImages] = useState<Record<number, PostAttachment | undefined>>({});
  const [inlineUploading, setInlineUploading] = useState<Record<number, boolean>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [sortNewest, setSortNewest] = useState(true);

  const [mentions, setMentions] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  useEffect(() => {
    const openComposerFromDock = () => setOpen(true);
    window.addEventListener("tipook:open-composer", openComposerFromDock);
    if (new URLSearchParams(window.location.search).has("compose")) {
      window.history.replaceState({}, "", "/");
      window.setTimeout(openComposerFromDock, 0);
    }
    return () => window.removeEventListener("tipook:open-composer", openComposerFromDock);
  }, []);

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
      setTitle(""); setContent(""); setLocation(""); setFeeling(""); setMentions(""); setPollQuestion(""); setPollOptions(["", ""]); setAttachments([]); setOpen(false); setNotice("Bài viết đã được đăng.");
      return { id: data.post.id, title: data.post.title };
    } finally { setSaving(false); }
  }, [title, content, category, location, attachments, feeling, audience, mentions, pollQuestion, pollOptions]);

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
  const hashtags = useMemo(() => Array.from(new Set(content.match(/#[\p{L}\p{N}_]+/gu) ?? [])), [content]);

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

  const selectInlineCommentImage = async (postId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setNotice("Bình luận chỉ hỗ trợ tệp ảnh."); return; }
    setInlineUploading((current) => ({ ...current, [postId]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/files", { method: "POST", body: formData });
      const data = await response.json() as { error?: string; attachment?: PostAttachment };
      if (!response.ok || !data.attachment) throw new Error(data.error || "Không thể tải ảnh bình luận.");
      setInlineImages((current) => ({ ...current, [postId]: data.attachment }));
      setInlineOpen((current) => ({ ...current, [postId]: true }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tải ảnh bình luận.");
    } finally {
      setInlineUploading((current) => ({ ...current, [postId]: false }));
    }
  };
  const sendInlineComment = async (post: Post) => {
    const value = (inlineDrafts[post.id] ?? "").trim();
    const image = inlineImages[post.id];
    if ((!value && !image) || inlineBusy[post.id] || inlineUploading[post.id]) return;
    setInlineBusy((current) => ({ ...current, [post.id]: true }));
    try {
      const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id, content: value, imageKey: image?.key }) });
      const data = await response.json() as { error?: string; comment?: Comment };
      if (!response.ok || !data.comment) throw new Error(data.error || "Chưa thể gửi bình luận.");
      setInlineThreads((current) => ({ ...current, [post.id]: [...(current[post.id] ?? []), data.comment as Comment] }));
      setInlineOpen((current) => ({ ...current, [post.id]: true }));
      setInlineDrafts((current) => ({ ...current, [post.id]: "" }));
      setInlineImages((current) => ({ ...current, [post.id]: undefined }));
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

      <main className="social-shell mx-auto grid max-w-[1360px] items-start justify-center gap-5 px-3 py-5 sm:px-4 lg:grid-cols-[220px_minmax(0,700px)] lg:px-5 xl:grid-cols-[220px_minmax(0,700px)_320px]">
        <aside className="sticky top-[84px] hidden max-h-[calc(100dvh-96px)] lg:block">
          <div className="sidebar-scroll max-h-[calc(100dvh-96px)] space-y-4 overflow-y-auto overscroll-contain pr-2">
            <section className="social-card p-4">
              <Link href="/tai-khoan" className="flex items-center gap-3">
                <img src="/avatars/user-nguyen-van-a.png" alt="Nguyễn Văn A" className="size-11 rounded-full object-cover ring-2 ring-white"/>
                <span className="min-w-0"><b className="block truncate text-sm text-[#182230]">Thành viên Tipook</b><small className="block truncate text-xs text-[#667085]">Xem trang cá nhân</small></span>
              </Link>
            </section>

            <nav className="social-card p-2" aria-label="Khám phá cộng đồng">
              {[
                {icon: Home,label:"Bảng tin"},
                {icon: TrendingUp,label:"Đang nổi"},
                {icon: MessageCircle,label:"Hỏi đáp"},
                {icon: BookOpen,label:"Cẩm nang"},
                {icon: Users,label:"Nhóm của tôi"}
              ].map(({icon:Icon,label}, i) => <button key={label} onClick={() => { if (i === 0) { setActive("Tất cả"); setQuery(""); setSortNewest(true); } else if (i === 1) { setSortNewest(false); window.scrollTo({ top: 120, behavior: "smooth" }); } else if (i === 2) { setActive("Hỏi đáp"); window.scrollTo({ top: 120, behavior: "smooth" }); } else if (i === 3) window.location.href = "/cam-nang"; else window.location.href = "/tai-khoan"; }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${i===0 ? "bg-[#e9f5fb] text-[#168ac0]" : "text-[#344054] hover:bg-[#f3f6f9]"}`}><span className={`grid size-9 place-items-center rounded-xl ${i===0 ? "bg-white text-[#168ac0] shadow-sm" : "bg-[#f3f6f9] text-[#52677f]"}`}><Icon size={18}/></span>{label}</button>)}
            </nav>

            <div className="px-3 text-[11px] leading-5 text-[#98a2b3]">Tipook · Cộng đồng xây nhà thực tế</div>
          </div>
        </aside>

        <section className="min-w-0">
          <section className="social-card mb-4 overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <img src="/avatars/user-nguyen-van-a.png" alt="Nguyễn Văn A" className="size-11 shrink-0 rounded-full object-cover"/>
              <button onClick={() => setOpen(true)} className="h-11 flex-1 rounded-full bg-[#f0f2f5] px-4 text-left text-[15px] text-[#667085] transition hover:bg-[#e8ecf0]">Bạn đang nghĩ gì về ngôi nhà của mình?</button>
            </div>
            <div className="grid grid-cols-3 border-t border-[#edf0f3] px-2 py-1.5">
              <button onClick={() => openComposer("file")} className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[#475467] hover:bg-[#f5f7f9]"><ImageIcon size={19} className="text-emerald-500"/><span className="hidden sm:inline">Ảnh / tệp</span><span className="sm:hidden">Tệp</span></button>
              <button onClick={() => openComposer("cost")} className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[#475467] hover:bg-[#f5f7f9]"><CircleDollarSign size={19} className="text-[#229ed9]"/><span>Chi phí</span></button>
              <button onClick={() => openComposer("poll")} className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[#475467] hover:bg-[#f5f7f9]"><BarChart3 size={19} className="text-violet-500"/><span>Thăm dò</span></button>
            </div>
          </section>



          {notice && <div className="mb-4 flex items-center justify-between rounded-xl bg-[#eaf7ef] px-4 py-3 text-sm font-semibold text-[#168ac0]">{notice}<button onClick={() => setNotice("")}><X size={17}/></button></div>}
          <div className="mb-4 lg:hidden"><label className="relative block"><Search className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#667085]"/><Input value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 rounded-xl border-[#e4e7ec] bg-white pl-11" placeholder="Tìm trong cộng đồng..."/></label></div>

          <div className="space-y-4">
            {visible.map((post, index) => <article key={post.id} className="social-card overflow-hidden transition hover:border-[#c9e8f5]">
              <header className="flex items-start gap-3 px-4 pb-2 pt-4 sm:px-5 sm:pt-5"><img src={post.avatar ?? "/avatars/user-nguyen-van-a.png"} alt={post.authorName} className="size-11 shrink-0 rounded-full object-cover"/><div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-[15px] font-bold text-[#182230]">{post.authorName}{index===1 && <CheckCircle2 size={15} className="fill-[#229ed9] text-white"/>}</p><p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#667085]">{formatRelativeTime(post.createdAt)}{post.location && <><span>·</span><MapPin size={12}/>{post.location}</>}<span>·</span><span>Công khai</span></p></div><span className="shrink-0 rounded-full bg-[#eef9fd] px-2.5 py-1 text-[11px] font-bold text-[#147aa8]">{post.category}</span></header>
              <div className="px-4 pb-3 text-left sm:px-5"><button type="button" onClick={() => openPost(post)} className="block w-full text-left"><h2 className="mt-2 text-[17px] font-bold leading-snug tracking-[-.015em] text-[#182230] transition hover:text-[#168ac0]">{post.title}</h2></button>{post.feeling && <p className="mt-1.5 text-sm font-semibold text-[#168ac0]">cảm thấy {post.feeling}</p>}<p className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-[#344054]"><HashtagText text={post.content} onSelect={(hashtag) => { setActive("Tất cả"); setQuery(hashtag); window.scrollTo({ top: 0, behavior: "smooth" }); }}/></p></div>
              <div className="px-4 sm:px-5"><PostExtras post={post}/><AttachmentList attachments={post.attachments}/></div>
              <div className="mx-2 mt-3 grid grid-cols-4 items-center border-b border-[#e4e7ec] pb-2 text-center text-xs text-[#667085] sm:mx-3"><button onClick={() => likePost(post)} className="hover:underline">{post.likes} lượt hữu ích</button><button onClick={() => toggleInlineComments(post)} className="hover:underline">{post.comments} bình luận</button><span>{post.shares ?? 0} lượt chia sẻ</span><span aria-hidden="true" /></div>
              <div className="mx-2 grid grid-cols-4 gap-1 py-1.5 sm:mx-3">
                <button onClick={() => likePost(post)} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold hover:bg-[#f2f4f7] ${liked[String(post.id)] ? "text-[#168ac0]" : "text-[#475467]"}`}><Heart size={18} className={liked[String(post.id)] ? "fill-current" : ""}/><span className="hidden sm:inline">Hữu ích</span></button>
                <button onClick={() => toggleInlineComments(post)} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold hover:bg-[#f2f4f7] ${inlineOpen[post.id] ? "text-[#168ac0]" : "text-[#475467]"}`}><MessageCircle size={18}/><span className="hidden sm:inline">Bình luận</span></button>
                <ShareActionButton title={post.title} targetType="post" targetId={String(post.id)} onShared={(created) => { if (created) setPosts((current) => current.map((item) => item.id === post.id ? { ...item, shares: (item.shares ?? 0) + 1 } : item)); }} className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-[#475467] hover:bg-[#f2f4f7] [&>span]:hidden [&>span]:sm:inline"/>
                <ToggleActionButton actionType="save" targetType="post" targetId={String(post.id)} label="Lưu" activeLabel="Đã lưu" icon="bookmark" className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-[#475467] hover:bg-[#f2f4f7] [&>span]:hidden [&>span]:sm:inline"/>
              </div>
              {inlineOpen[post.id] && <div className="space-y-3 border-t border-[#edf0f3] bg-[#fbfcfd] px-4 py-3 sm:px-5">
                {(inlineThreads[post.id] ?? []).map((comment) => <div key={comment.id} className="flex items-start gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d9f1fb] text-sm font-extrabold text-[#168ac0]">{comment.authorName.charAt(0)}</span><div className="min-w-0"><div className="rounded-2xl bg-[#eef1f4] px-3.5 py-2"><b className="block text-sm text-[#182230]">{comment.authorName}</b>{comment.content && <p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-[#344054]">{comment.content}</p>}{comment.imageUrl && <img src={comment.imageUrl} alt="Ảnh trong bình luận" className="mt-2 max-h-72 max-w-full rounded-xl object-contain" />}</div><button type="button" onClick={() => setInlineDrafts((current) => ({ ...current, [post.id]: "@" + comment.authorName + " " }))} className="ml-3 mt-1 text-xs font-bold text-[#667085] hover:text-[#229ed9]">Trả lời</button></div></div>)}
                {!inlineThreads[post.id] && <p className="py-2 text-center text-sm text-[#667085]">Đang tải bình luận...</p>}
                {inlineThreads[post.id]?.length === 0 && <p className="py-2 text-center text-sm text-[#667085]">Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>}
              </div>}
              <div className="flex items-center gap-2.5 border-t border-[#edf0f3] px-4 py-3 sm:px-5">
                <img src="/avatars/user-nguyen-van-a.png" alt="Ảnh đại diện của bạn" className="size-9 shrink-0 rounded-full object-cover"/>
                <div className="min-w-0 flex-1">{inlineImages[post.id] && <div className="relative mb-2 w-fit"><img src={inlineImages[post.id]?.url} alt="Ảnh chuẩn bị gửi" className="max-h-32 rounded-xl object-contain"/><button type="button" onClick={() => setInlineImages((current) => ({ ...current, [post.id]: undefined }))} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-[#344054] text-white" aria-label="Bỏ ảnh"><X size={14}/></button></div>}<div className="flex items-center rounded-full bg-[#f0f2f5] pl-4 pr-1.5"><input value={inlineDrafts[post.id] ?? ""} onChange={(event) => setInlineDrafts((current) => ({ ...current, [post.id]: event.target.value }))} onFocus={() => { if (!inlineOpen[post.id]) void toggleInlineComments(post); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendInlineComment(post); } }} className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[#182230] outline-none placeholder:text-[#667085]" placeholder="Viết bình luận..." maxLength={600}/><label className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-[#229ed9] hover:bg-white" aria-label="Thêm ảnh"><ImageIcon size={18}/><input type="file" accept="image/*" className="sr-only" disabled={inlineUploading[post.id]} onChange={(event) => void selectInlineCommentImage(post.id, event)}/></label><button type="button" onClick={() => void sendInlineComment(post)} disabled={inlineBusy[post.id] || inlineUploading[post.id] || (!(inlineDrafts[post.id] ?? "").trim() && !inlineImages[post.id])} className="grid size-8 shrink-0 place-items-center rounded-full text-[#229ed9] hover:bg-white disabled:text-[#bcc0c4]" aria-label="Gửi bình luận"><Send size={17}/></button></div></div>
              </div>
            </article>)}
            {!visible.length && <div className="social-card p-10 text-center"><Search className="mx-auto mb-3 text-[#667085]"/><p className="font-bold">Chưa tìm thấy bài viết phù hợp</p><p className="mt-1 text-sm text-[#667085]">Thử từ khóa hoặc chuyên mục khác nhé.</p></div>}
          </div>
        </section>

        <aside className="sticky top-[84px] hidden max-h-[calc(100dvh-96px)] xl:block">
          <div className="sidebar-scroll max-h-[calc(100dvh-96px)] space-y-4 overflow-y-auto overscroll-contain pr-2">
            <section id="chuyen-gia" className="social-card overflow-hidden scroll-mt-24">
              <div className="flex items-center justify-between border-b border-[#edf0f3] px-4 py-3.5"><div><h2 className="text-base font-extrabold text-[#182230]">Chuyên gia đang hoạt động</h2><p className="mt-0.5 text-xs text-[#667085]">Hỏi đúng người, đúng chuyên môn</p></div><Link href="/hoi-chuyen-gia" className="text-xs font-bold text-[#168ac0]">Xem thêm</Link></div>
              <div className="p-2">{[["/avatars/expert-khanh-linh.png","KTS. Khánh Linh","Thiết kế nhà phố","virtual-architect-001"],["/avatars/expert-trong-hieu.png","KS. Trọng Hiếu","Kết cấu & thi công","virtual-engineer-001"],["/avatars/expert-vu-mai.png","Vũ Mai","Dự toán công trình","virtual-engineer-003"]].map(([avatar,name,job,recipientUserId]) => <div key={name} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-[#f8fafb]"><span className="relative"><img src={avatar} alt={name} className="size-10 rounded-full object-cover"/><i className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500"/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm text-[#182230]">{name}</b><small className="block truncate text-xs text-[#667085]">{job}</small></span><RequestActionButton requestType="expert-question" targetType="expert" targetId={name} label="Hỏi" title={"Hỏi " + name} description={"Chuyên môn: " + job} recipientUserId={recipientUserId} allowFile className="rounded-full bg-[#e8f6fc] px-3 py-1.5 text-xs font-bold text-[#168ac0]"/></div>)}</div>
            </section>

            <section className="social-card p-4"><div className="flex items-center justify-between"><h2 className="text-base font-extrabold text-[#182230]">Nhóm gợi ý</h2><Link href="/tai-khoan" className="text-xs font-bold text-[#168ac0]">Xem tất cả</Link></div><div className="mt-3 flex items-center gap-3"><img src="/mau-nha-pho-xanh.png" alt="Xây nhà Bình Dương" className="size-12 shrink-0 rounded-xl object-cover"/><div className="min-w-0 flex-1"><b className="block truncate text-sm text-[#182230]">Xây nhà Bình Dương</b><p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#667085]"><Users size={12}/>2,8K thành viên</p></div><ToggleActionButton actionType="join" targetType="group" targetId="xay-nha-binh-duong" label="Tham gia" activeLabel="Đã tham gia" icon="follow" className="rounded-lg bg-[#229ed9] px-3 py-2 text-xs font-bold text-white"/></div></section>

            </div>
        </aside>
      </main>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto border-l-[#e3eaf2] bg-[#f4f7fb] p-0 sm:max-w-[620px]">
          {selected && <>
            <div className="bg-white px-5 pb-5 pt-6 sm:px-7">
              <SheetHeader className="text-left">
                <div className="mb-2 flex items-center gap-3"><img src={selected.avatar ?? "/avatars/user-nguyen-van-a.png"} alt={selected.authorName} className="size-11 rounded-full object-cover"/><div><p className="font-bold">{selected.authorName}</p><p className="flex items-center gap-1.5 text-sm text-[#3f5064]"><Clock3 size={13}/>{formatRelativeTime(selected.createdAt)}{selected.location && <> · <MapPin size={13}/>{selected.location}</>}</p></div></div>
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
                <img src="/avatars/user-nguyen-van-a.png" alt="Thành viên Tipook" className="size-10 shrink-0 rounded-full object-cover"/>
                <div className="min-w-0">
                  <b className="block truncate text-[15px] font-semibold leading-5 text-[#050505]">Thành viên Tipook</b>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <select value={audience} onChange={(e) => setAudience(e.target.value)} className="h-6 rounded-md border-0 bg-[#e4e6eb] px-2 text-xs font-semibold text-[#050505] outline-none">
                      <option>Công khai</option><option>Chỉ thành viên</option><option>Chỉ mình tôi</option>
                    </select>
                    <button type="button" onClick={() => setFeeling(feeling ? "" : "hào hứng")} className="h-6 rounded-md bg-[#e4e6eb] px-2 text-xs font-semibold text-[#050505] hover:bg-[#d8dadf]">{feeling ? "Cảm thấy " + feeling : "Nhắn AI đang tắt"}</button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[150px] resize-none border-0 p-0 text-[22px] leading-8 text-[#050505] shadow-none placeholder:text-[#65676b] focus-visible:ring-0 sm:min-h-[175px]" placeholder="Bạn đang nghĩ gì thế? Dùng # để thêm hashtag" maxLength={1200}/>
                {hashtags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{hashtags.map((hashtag) => <span key={hashtag} className="rounded-full bg-[#e8f6fc] px-2.5 py-1 text-xs font-semibold text-[#168ac0]">{hashtag}</span>)}</div>}
                <div className="mt-1 flex items-center justify-end">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#8a8d91]">{content.length}/1200</span>
                    <button type="button" onClick={() => setFeeling(feeling ? "" : "hào hứng")} className="grid size-9 place-items-center rounded-full text-[#65676b] hover:bg-[#f0f2f5]" aria-label="Thêm cảm xúc"><Smile size={24}/></button>
                  </div>
                </div>
              </div>

              <div className="mt-3">

                <label className="text-xs font-semibold text-[#65676b]">Gắn thẻ<input value={mentions} onChange={(event) => setMentions(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#ced0d4] px-3 text-sm text-[#050505] outline-none focus:border-[#229ed9]" placeholder="Tên, cách nhau bằng dấu phẩy"/></label>
              </div>
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
