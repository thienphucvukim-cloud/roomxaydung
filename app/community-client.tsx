"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, BarChart3, BookOpen, Bookmark, CalendarDays, CheckCircle2, ChevronRight,
  CircleDollarSign, Clock3, Compass, HardHat, Heart, Home, Image as ImageIcon,
  Layers3, MapPin, MessageCircle, Plus, Search, Send, Share2, Smile, Sparkles, TrendingUp,
  Users, WalletCards, X
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Post = { id: number | string; authorName: string; avatar?: string; category: string; title: string; content: string; location: string | null; comments: number; likes: number; createdAt: string; image?: string | null; feeling?: string | null; audience?: string };
type Comment = { id: number | string; authorName: string; content: string; createdAt: string };

const demoPosts: Post[] = [
  { id: "m1", authorName: "Minh Anh", avatar: "/avatars/user-minh-anh.png", category: "Chuẩn bị xây", title: "Nhà 5×20m nên chừa giếng trời ở vị trí nào?", content: "Vợ chồng mình chuẩn bị xây nhà 2 tầng, muốn phòng khách và bếp đủ sáng nhưng vẫn giữ được 3 phòng ngủ. Mọi người có kinh nghiệm bố trí giếng trời chia sẻ giúp mình nhé.", location: "Bình Dương", comments: 18, likes: 42, createdAt: "2 giờ trước" },
  { id: "m2", authorName: "Hoàng Nam", avatar: "/avatars/user-hoang-nam.png", category: "Chi phí thực tế", title: "Chia sẻ bảng chi phí phần thô nhà 2 tầng", content: "Mình vừa hoàn thành phần thô căn 80m². Tổng chi phí thấp hơn dự toán ban đầu khoảng 7% nhờ chốt vật tư sớm. Mình ghi lại những khoản dễ phát sinh để mọi người tham khảo.", location: "Đà Nẵng", comments: 31, likes: 76, createdAt: "5 giờ trước" },
  { id: "m3", authorName: "Thu Hà", avatar: "/avatars/user-thu-ha.png", category: "Đang thi công", title: "Có nên đổi từ gạch ống sang gạch không nung?", content: "Nhà thầu đề xuất đổi vật liệu vì khả năng cách âm tốt hơn. Mình chưa rõ ảnh hưởng đến tải trọng và chi phí hoàn thiện, mong anh chị có kinh nghiệm góp ý.", location: "TP. Hồ Chí Minh", comments: 12, likes: 19, createdAt: "Hôm qua" },
];

const stages = ["Chuẩn bị xây", "Thiết kế", "Chi phí thực tế", "Đang thi công", "Hoàn thiện"];
const feedCategories = ["Tất cả", "Nhật ký xây nhà", "Hỏi đáp", "Kinh nghiệm", "Chi phí", "Thiết kế", "Nhà thầu"];
const quickTopics = [
  { icon: WalletCards, title: "Dự toán chi phí", note: "Ước tính chi phí, lập kế hoạch tài chính", color: "bg-sky-50 text-[#229ed9]" },
  { icon: Layers3, title: "Mặt bằng công năng", note: "Tham khảo mẫu và chia sẻ mặt bằng đẹp", color: "bg-sky-50 text-sky-600" },
  { icon: HardHat, title: "Chọn nhà thầu", note: "Đánh giá, kinh nghiệm thực tế từ cộng đồng", color: "bg-sky-50 text-[#229ed9]" },
  { icon: Home, title: "Vật liệu hoàn thiện", note: "So sánh, đánh giá vật liệu xây dựng", color: "bg-emerald-50 text-emerald-600" },
];

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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Post | null>(null);
  const [thread, setThread] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/posts").then((r) => r.ok ? r.json() : Promise.reject()).then((data) => {
      if (data.posts?.length) setPosts([...data.posts, ...demoPosts]);
    }).catch(() => {});
  }, []);

  const selectPostImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
  };
  const createPost = useCallback(async (values?: { title: string; content: string; category?: string; location?: string }) => {
    const payload = values ?? { title: title.trim() || content.trim().slice(0, 80), content, category, location };
    if (!payload.title.trim() || !payload.content.trim()) throw new Error("Vui lòng nhập tiêu đề và nội dung.");
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chưa thể đăng bài.");
      setPosts((current) => [{ ...data.post, image: imagePreview, feeling, audience }, ...current]);
      setTitle(""); setContent(""); setLocation(""); setFeeling(""); setImagePreview(null); setOpen(false); setNotice("Bài viết đã được đăng.");
      return { id: data.post.id, title: data.post.title };
    } finally { setSaving(false); }
  }, [title, content, category, location, imagePreview, feeling, audience]);

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
    (active === "Tất cả" || active === "Hỏi đáp" || active === "Kinh nghiệm" || (active === "Chi phí" && post.category.includes("Chi phí")) || post.category === active) &&
    `${post.title} ${post.content} ${post.location ?? ""}`.toLowerCase().includes(query.toLowerCase())
  ), [posts, active, query]);

  const openPost = async (post: Post) => {
    setSelected(post);
    setCommentText("");
    if (typeof post.id === "number") {
      try {
        const response = await fetch(`/api/comments?postId=${post.id}`);
        const data = await response.json();
        setThread(response.ok ? data.comments : []);
      } catch { setThread([]); }
    } else {
      setThread([
        { id: `${post.id}-1`, authorName: "Nguyễn Hùng", content: post.id === "m1" ? "Nhà mình cùng kích thước, đặt giếng trời giữa cầu thang và bếp nên cả hai tầng đều sáng. Nhớ làm lam che mưa và chừa đường bảo trì nhé." : "Cảm ơn bạn đã chia sẻ rất chi tiết. Những con số thực tế như này giúp người chuẩn bị xây dễ dự trù hơn nhiều.", createdAt: "1 giờ trước" },
        { id: `${post.id}-2`, authorName: "KTS. Khánh Linh", content: "Bạn nên gửi thêm hướng đất và vị trí các phòng để mọi người góp ý chính xác hơn. Với nhà phố, thông gió chéo quan trọng không kém diện tích giếng trời.", createdAt: "38 phút trước" },
      ]);
    }
  };

  const likePost = async (post: Post) => {
    const key = String(post.id);
    if (liked[key]) return;
    setLiked((current) => ({ ...current, [key]: true }));
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, likes: item.likes + 1 } : item));
    setSelected((current) => current?.id === post.id ? { ...current, likes: current.likes + 1 } : current);
    if (typeof post.id === "number") fetch("/api/likes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id }) }).catch(() => {});
  };

  const sendComment = async () => {
    const contentValue = commentText.trim();
    if (!selected || !contentValue) return;
    setCommentSaving(true);
    try {
      let comment: Comment;
      if (typeof selected.id === "number") {
        const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: selected.id, content: contentValue }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
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

  return (
    <div className="min-h-screen bg-[#f5f8fc] pb-20 text-[#0b2e59] lg:pb-0">

      <main className="mx-auto grid max-w-[1568px] gap-x-4 gap-y-3 px-4 py-4 lg:px-0 lg:py-4 xl:grid-cols-[210px_minmax(0,890px)_436px]">
        <section className="mb-1 grid gap-4 xl:col-span-2 xl:col-start-2 xl:row-start-1 xl:grid-cols-[890px_436px]">
          <div className="relative h-[320px] overflow-hidden rounded-[18px] bg-[#083469] text-white shadow-[0_18px_45px_rgba(21,68,49,.15)]">
            <img src="/community-house.png" alt="Gia chủ trao đổi bản vẽ cùng kiến trúc sư tại công trình" className="absolute inset-0 h-full w-full scale-[1.01] object-cover object-center contrast-[1.12] saturate-[1.08]"/>
            <div className="absolute inset-0" style={{background: "linear-gradient(90deg, rgba(4,31,69,.92) 0%, rgba(6,43,90,.62) 32%, rgba(6,43,90,.20) 58%, rgba(6,43,90,0) 78%)"}}/>
            <div className="relative flex h-full max-w-[610px] flex-col justify-center p-7 sm:p-10">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur"><Sparkles size={15}/> 2.486 người đang cùng xây nhà</div>
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
                {[{icon: Compass,label:"Khám phá"},{icon: TrendingUp,label:"Đang nổi"},{icon: MessageCircle,label:"Hỏi đáp"},{icon: BookOpen,label:"Cẩm nang"},{icon: Users,label:"Nhóm của tôi"}].map(({icon:Icon,label}, i) => <button key={label} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[15px] font-semibold ${i===0 ? "bg-[#e8f6fc] text-[#168ac0]" : "text-[#3f5064] hover:bg-white"}`}><Icon size={19}/>{label}</button>)}
              </nav>
              <div>
                <p className="mb-2 px-3 text-xs font-extrabold uppercase tracking-[.12em] text-[#3f5064]">Giai đoạn xây nhà</p>
                {stages.map((item, index) => <button key={item} onClick={() => setActive(item)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#3f5064] hover:bg-white"><span className={`size-2 rounded-full ${["bg-sky-400","bg-violet-400","bg-indigo-500","bg-cyan-600","bg-emerald-500"][index]}`}/>{item}</button>)}
              </div>
              <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#edf5ff] to-white p-4 ring-1 ring-[#dce8f4]"><svg aria-hidden="true" viewBox="0 0 76 68" className="mb-3 h-[68px] w-[76px] drop-shadow-[0_6px_12px_rgba(25,126,204,.16)]"><defs><linearGradient id="houseTile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e4f5ff"/><stop offset="1" stopColor="#b9e0ff"/></linearGradient></defs><rect x="5" y="13" width="52" height="50" rx="15" fill="url(#houseTile)"/><path d="M15 35.5 31 22l16 13.5v17.2a3.3 3.3 0 0 1-3.3 3.3H18.3a3.3 3.3 0 0 1-3.3-3.3Z" fill="#063a75"/><path d="m12.5 36 18.5-16 18.5 16" fill="none" stroke="#149ee9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><rect x="27" y="43" width="8.5" height="13" rx="2.2" fill="#fff"/><path d="M62 8v12M56 14h12" stroke="#128fd8" strokeWidth="3" strokeLinecap="round"/><path d="m68 24 1.5 3.2 3.5 1.5-3.5 1.5L68 34l-1.5-3.8-3.5-1.5 3.5-1.5Z" fill="#31b5f4"/><circle cx="65" cy="8" r="2.4" fill="#31b5f4"/></svg><p className="max-w-[150px] text-[15px] font-extrabold leading-[22px] text-[#0b3264]">Cùng nhau xây những ngôi nhà tốt hơn</p><p className="mt-3 text-xs italic leading-5 text-[#556a80]">Tri thức hôm nay,<br/>ngôi nhà bền vững mai sau</p><button className="mt-3 flex w-full items-center justify-between text-sm font-medium text-[#0b3264]">Khám phá <span className="grid size-6 place-items-center rounded-full bg-[#dceafa]"><ArrowUpRight size={14}/></span></button></div>
            </div>
          </aside>

          <section className="min-w-0 xl:col-start-2 xl:row-start-2">
            <div className="mb-4 rounded-2xl border border-[#e4ebf3] bg-white p-4 shadow-[0_5px_18px_rgba(25,55,90,.05)]">
              <div className="flex items-center gap-3"><img src="/avatars/user-nguyen-van-a.png" alt="Nguyễn Văn A" className="size-12 shrink-0 rounded-full object-cover"/><button onClick={() => setOpen(true)} className="h-12 flex-1 rounded-xl bg-[#f4f7fb] px-4 text-left text-[15px] text-[#53677d] transition hover:bg-[#edf2f8]">Bạn đang băn khoăn điều gì khi xây nhà?</button></div>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[#edf1f6] pt-3"><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#405874] hover:bg-[#f4f7fb]"><ImageIcon size={18} className="text-[#55779d]"/> Thêm hình ảnh</button><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#405874] hover:bg-[#f4f7fb]"><CircleDollarSign size={18} className="text-[#229ed9]"/> Chia sẻ chi phí</button><button onClick={() => setOpen(true)} className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#405874] hover:bg-[#f4f7fb] sm:flex"><BarChart3 size={18} className="text-[#426b8d]"/> Tạo thăm dò</button><button onClick={() => setOpen(true)} className="ml-auto rounded-xl bg-[#229ed9] px-7 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#168ac0]">Đăng bài</button></div>
            </div>


            <div className="mb-4 flex min-h-9 items-center justify-between gap-3">
              <Tabs value={active} onValueChange={setActive} className="min-w-0 flex-1 gap-0"><TabsList className="h-9 w-full flex-nowrap justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 shadow-none scrollbar-none">{feedCategories.map((item) => <TabsTrigger key={item} value={item} className="h-8 flex-none rounded-full border-0 bg-transparent px-4 py-0 text-sm text-[#4b5f73] shadow-none after:hidden data-[state=active]:bg-[#229ed9] data-[state=active]:text-white data-[state=active]:shadow-none">{item}</TabsTrigger>)}</TabsList></Tabs><button className="hidden h-9 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-[#405874] sm:flex">Mới nhất <ChevronRight className="size-4 rotate-90"/></button>
            </div>
            <div id="nhat-ky" className="mb-4 scroll-mt-24 rounded-[18px] border border-[#e4ebf3] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(25,55,90,.035)] sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-[#229ed9]"><Home size={15} className="fill-[#229ed9] text-[#229ed9]"/> Nhật ký xây nhà</p>
                <button className="shrink-0 rounded-full bg-[#eef9fd] px-4 py-2 text-sm font-medium text-[#229ed9] transition hover:bg-[#d9f1fb]">Theo dõi hành trình</button>
              </div>
              <div className="mt-2 grid gap-4 sm:grid-cols-[164px_minmax(0,1fr)]">
                <div className="relative h-[150px] overflow-hidden rounded-[14px]">
                  <img src="/community-house.png" alt="Công trình nhà phố đang thi công" className="h-full w-full object-cover"/>
                  <span className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-bold text-[#17365d] shadow-sm">Ngày 96/180</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-[20px] font-extrabold leading-tight tracking-[-.025em] text-[#082f61]">180 ngày xây ngôi nhà đầu tiên</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#465a70]"><img src="/avatars/user-hoang-nam.png" alt="Trần Đức" className="size-8 rounded-full object-cover"/><b className="text-[#0b2e59]">Trần Đức</b><span>·</span><span>Nhà phố 3 tầng</span><span>·</span><span>Biên Hòa</span><span>·</span><span>2 ngày trước</span></div>
                  <p className="mt-3 text-[15px] leading-6 text-[#334c68]">Tuần này hoàn thành chống thấm sân thượng và bắt đầu đi điện âm. Khoản phát sinh lớn nhất là nâng cấp dây điện tổng, thêm 8,6 triệu so với dự toán.</p>
                  <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-[#eef9fd] px-3 py-1 text-xs font-bold text-[#168ac0]">◉ Đã chi 1,24 tỷ</span><span className="rounded-full bg-[#eef9fd] px-3 py-1 text-xs font-bold text-[#229ed9]">↗ Tiến độ 53%</span><span className="rounded-full bg-[#edf5ff] px-3 py-1 text-xs font-bold text-[#168ac0]">▣ 32 cập nhật</span></div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-6 border-t border-[#edf1f6] pt-3 text-sm text-[#40566f]"><button className="flex items-center gap-2 hover:text-[#229ed9]"><Heart size={18}/>128</button><button className="flex items-center gap-2 hover:text-[#229ed9]"><MessageCircle size={18}/>24</button><button className="flex items-center gap-2 hover:text-[#229ed9]"><Bookmark size={17}/>Lưu</button><button className="flex items-center gap-2 hover:text-[#229ed9]"><Share2 size={17}/>Chia sẻ</button><button className="ml-auto hidden items-center gap-1 font-bold text-[#147aa8] sm:flex">Xem chi tiết <ArrowUpRight size={16}/></button></div>
            </div>
            {notice && <div className="mb-4 flex items-center justify-between rounded-xl bg-[#dff1e5] px-4 py-3 text-sm font-semibold text-[#168ac0]">{notice}<button onClick={() => setNotice("")}><X size={17}/></button></div>}

            <div className="mb-4 md:hidden"><label className="relative block"><Search className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#3f5064]"/><Input value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 rounded-xl bg-white pl-11" placeholder="Tìm trong cộng đồng..."/></label></div>

            <div className="space-y-4">
              {visible.map((post, index) => <article key={post.id} className="group rounded-[22px] border border-[#e4ebf3] bg-white p-5 shadow-[0_4px_18px_rgba(24,49,39,.035)] transition hover:border-[#bde7f8] sm:p-6">
                <div className="flex items-start gap-3"><img src={post.avatar ?? "/avatars/user-nguyen-van-a.png"} alt={post.authorName} className="size-11 shrink-0 rounded-full object-cover"/><div className="min-w-0"><p className="flex items-center gap-1.5 font-bold">{post.authorName}{index===1 && <CheckCircle2 size={15} className="fill-[#229ed9] text-white"/>}</p><p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-[#3f5064]"><Clock3 size={13}/>{post.createdAt}{post.location && <><span>·</span><MapPin size={13}/>{post.location}</>}</p></div><span className="ml-auto rounded-full bg-[#eef9fd] px-3 py-1 text-xs font-bold text-[#147aa8]">{post.category}</span></div>
                <button onClick={() => openPost(post)} className="block w-full text-left"><h2 className="mt-4 text-[1.2rem] font-extrabold leading-snug tracking-[-.02em] transition group-hover:text-[#229ed9]">{post.title}</h2>{post.feeling && <p className="mt-2 text-sm font-semibold text-[#168ac0]">cảm thấy {post.feeling}</p>}<p className="mt-2 line-clamp-3 text-[15px] leading-7 text-[#3f5064]">{post.content}</p>{post.image && <img src={post.image} alt="Ảnh đính kèm bài viết" className="mt-4 max-h-96 w-full rounded-xl object-cover"/>}<span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#229ed9]">Đọc thảo luận <ChevronRight size={15}/></span></button>
                <div className="mt-5 flex items-center gap-2 border-t border-[#edf1f6] pt-4"><button onClick={() => likePost(post)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-[#eef9fd] hover:text-[#168ac0] ${liked[String(post.id)] ? "bg-[#eef9fd] text-[#168ac0]" : "text-[#3f5064]"}`}><Heart size={18} className={liked[String(post.id)] ? "fill-current" : ""}/>{post.likes} hữu ích</button><button onClick={() => openPost(post)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#3f5064] hover:bg-[#eef9fd] hover:text-[#229ed9]"><MessageCircle size={18}/>{post.comments} bình luận</button><button onClick={() => setSaved((current) => ({...current, [String(post.id)]: !current[String(post.id)]}))} className={`ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-[#f7f9fc] ${saved[String(post.id)] ? "text-[#229ed9]" : "text-[#3f5064]"}`}><Bookmark size={17} className={saved[String(post.id)] ? "fill-current" : ""}/><span className="hidden sm:inline">{saved[String(post.id)] ? "Đã lưu" : "Lưu bài"}</span></button></div>
              </article>)}
              {!visible.length && <div className="rounded-2xl bg-white p-10 text-center"><Search className="mx-auto mb-3 text-[#3f5064]"/><p className="font-bold">Chưa tìm thấy bài viết phù hợp</p><p className="mt-1 text-sm text-[#3f5064]">Thử từ khóa hoặc chuyên mục khác nhé.</p></div>}
            </div>
          </section>

          <aside className="hidden xl:col-start-3 xl:row-start-2 xl:block">
            <div className="sticky top-24 space-y-5">
              <div id="chuyen-gia" className="scroll-mt-24 overflow-hidden rounded-[16px] bg-[#168ac0] shadow-[0_5px_18px_rgba(25,55,90,.05)] ring-1 ring-[#edf2f7]">
                <div className="bg-[#168ac0] px-5 py-4 text-white"><div className="flex items-center justify-between gap-3"><h3 className="text-[20px] font-extrabold">Hỏi nhanh chuyên gia</h3><button className="shrink-0 text-xs font-semibold text-white/90">Xem tất cả →</button></div><p className="mt-1 text-xs text-white/90">Kết nối với các chuyên gia giàu kinh nghiệm</p></div>
                <div className="relative -mt-px rounded-t-[14px] bg-white px-5">
                  {[["/avatars/expert-khanh-linh.png","KTS. Khánh Linh","Thiết kế nhà phố, biệt thự","Đang online",true],["/avatars/expert-trong-hieu.png","KS. Trọng Hiếu","Kết cấu & thi công","Đang online",true],["/avatars/expert-vu-mai.png","Vũ Mai","Dự toán công trình","Offline lúc 10:24",false]].map(([avatar,name,job,status,online]) => <div key={String(name)} className="flex min-h-[78px] items-center gap-3 border-b border-[#edf1f6] last:border-b-0"><span className="relative size-12 shrink-0"><img src={String(avatar)} alt={String(name)} className="size-12 rounded-full object-cover"/><i className={`absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-white ${online?"bg-emerald-500":"bg-slate-400"}`}/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm text-[#0b2e59]">{String(name)}</b><small className="mt-0.5 block truncate text-xs text-[#465a70]">{String(job)}</small><small className={`mt-0.5 flex items-center gap-1 text-[11px] ${online?"text-emerald-600":"text-[#556a80]"}`}><i className={`size-1.5 rounded-full ${online?"bg-[#10b981]":"bg-slate-400"}`}/>{String(status)}</small></span><button className="shrink-0 rounded-full border border-[#7bc8ea] h-8 px-3.5 text-[12px] font-bold leading-none text-[#229ed9] transition hover:bg-[#eef9fd]">Đặt câu hỏi</button></div>)}
                </div>
              </div>
              <div className="rounded-[18px] bg-white p-5 shadow-[0_5px_18px_rgba(25,55,90,.05)] ring-1 ring-[#edf2f7]">
                <div className="flex items-center justify-between"><h3 className="text-[20px] font-extrabold text-[#0b2e59]">Nhóm gần bạn</h3><button className="text-xs font-bold text-[#147aa8]">Xem tất cả →</button></div>
                <div className="mt-4 flex items-center gap-3">
                  <img src="/mau-nha-pho-xanh.png" alt="Xây nhà Bình Dương" className="size-16 shrink-0 rounded-xl object-cover"/>
                  <div className="min-w-0 flex-1"><b className="block truncate text-sm text-[#0b2e59]">Xây nhà Bình Dương</b><p className="mt-1 text-xs text-[#40566f]">1.204 thành viên · 323 bài viết</p><p className="mt-1 flex items-center gap-1 text-[11px] text-[#556a80]"><MapPin size={12}/>Bình Dương và khu vực lân cận</p></div>
                  <button className="shrink-0 rounded-full border border-[#7bc8ea] h-8 px-3.5 text-[12px] font-bold leading-none text-[#229ed9] transition hover:bg-[#eef9fd]">Tham gia</button>
                </div>
              </div>
              <div className="rounded-[22px] bg-[#eef9fd] p-5 ring-1 ring-[#d5e8f1]"><div className="flex items-center gap-2 text-[#147aa8]"><CalendarDays size={19}/><b className="text-sm">PHÒNG TRÒ CHUYỆN · 20:30</b></div><h3 className="mt-3 font-extrabold leading-5">5 khoản dễ đội chi phí khi hoàn thiện</h3><p className="mt-2 text-sm leading-5 text-[#3f5064]">Cùng kỹ sư dự toán Nguyễn Trọng Hiếu</p><button className="mt-4 text-sm font-extrabold text-[#147aa8]">Đặt lịch nhắc <ChevronRight className="inline size-4"/></button></div>
            </div>
          </aside>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-17 grid-cols-5 border-t border-[#e3eaf2] bg-white px-2 lg:hidden">
        <a href="/" className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#229ed9]"><Home size={19}/>Trang chủ</a>
        <a href="/mau-nha-dep" className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#3f5064]"><Sparkles size={19}/>Mẫu nhà</a>
        <button onClick={()=>setOpen(true)} className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#3f5064]"><span className="grid size-9 place-items-center rounded-full bg-[#229ed9] text-white"><Plus size={20}/></span>Đăng bài</button>
        <a href="/mat-bang-cong-nang" className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#3f5064]"><Layers3 size={19}/>Mặt bằng</a>
        <button className="flex flex-col items-center justify-center gap-1 whitespace-nowrap text-[11px] font-bold text-[#3f5064]"><MessageCircle size={19}/>Hỏi đáp</button>
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
              <div className="mt-5 flex items-center gap-2 border-t border-[#edf1f6] pt-4">
                <button onClick={() => likePost(selected)} className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold ${liked[String(selected.id)] ? "bg-[#eef9fd] text-[#168ac0]" : "bg-[#f7f9fc] text-[#3f5064]"}`}><Heart size={18} className={liked[String(selected.id)] ? "fill-current" : ""}/>{selected.likes} hữu ích</button>
                <button onClick={() => setSaved((current) => ({...current, [String(selected.id)]: !current[String(selected.id)]}))} className="flex items-center gap-2 rounded-xl bg-[#f7f9fc] px-3.5 py-2.5 text-sm font-bold text-[#3f5064]"><Bookmark size={18} className={saved[String(selected.id)] ? "fill-[#229ed9] text-[#229ed9]" : ""}/>{saved[String(selected.id)] ? "Đã lưu" : "Lưu"}</button>
                <button className="ml-auto grid size-10 place-items-center rounded-xl bg-[#f7f9fc] text-[#3f5064]" aria-label="Chia sẻ bài viết"><Share2 size={18}/></button>
              </div>
            </div>

            <div className="px-5 py-6 sm:px-7">
              <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-extrabold">{selected.comments} bình luận</h3><span className="text-sm font-medium text-[#3f5064]">Cũ nhất trước</span></div>
              <div className="space-y-3">
                {thread.map((comment, index) => <div key={comment.id} className="rounded-2xl border border-[#e4ebf3] bg-white p-4">
                  <div className="flex items-center gap-2"><span className={`grid size-9 place-items-center rounded-full text-sm font-extrabold ${index % 2 ? "bg-[#e8edfa] text-[#5368a6]" : "bg-[#d9f1fb] text-[#229ed9]"}`}>{comment.authorName.charAt(0)}</span><div><b className="block text-sm">{comment.authorName}</b><small className="text-[#3f5064]">{comment.createdAt.includes("T") ? "Vừa gần đây" : comment.createdAt}</small></div></div>
                  <p className="mt-3 text-[15px] leading-6 text-[#3f5064]">{comment.content}</p>
                  <button className="mt-3 text-xs font-bold text-[#3f5064] hover:text-[#229ed9]">Trả lời</button>
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
        <DialogContent showCloseButton={false} className="max-w-[500px] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl">
          <DialogHeader className="relative border-b border-[#e5e5e5] px-5 py-4 text-center"><DialogTitle className="text-xl font-extrabold text-black">Tạo bài viết</DialogTitle><DialogClose className="absolute right-4 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#4b4f56] hover:bg-[#d8dadf]" aria-label="Đóng"><X size={25}/></DialogClose></DialogHeader>
          <form className="p-4" onSubmit={(e) => { e.preventDefault(); createPost().catch((err) => setNotice(err.message)); }}>
            <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#d9f1fb] font-extrabold text-[#147aa8]">P</span><div><b className="block text-[15px] text-black">Thành viên ROOM</b><div className="mt-1 flex gap-1"><select value={audience} onChange={(e) => setAudience(e.target.value)} className="h-6 rounded-md border-0 bg-[#e4e6eb] px-1.5 text-xs font-bold text-black outline-none"><option>Công khai</option><option>Chỉ thành viên</option><option>Chỉ mình tôi</option></select><button type="button" onClick={() => setFeeling(feeling ? "" : "hào hứng")} className="h-6 rounded-md bg-[#e4e6eb] px-2 text-xs font-bold text-black">{feeling ? `Cảm thấy ${feeling}` : "Nhắn AI đang tắt"}</button></div></div></div>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="mt-4 min-h-36 resize-none border-0 p-0 text-xl text-black shadow-none placeholder:text-[#4f5661] focus-visible:ring-0" placeholder="Bạn đang nghĩ gì thế?" maxLength={1200}/>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="sr-only" aria-label="Tiêu đề bài viết" maxLength={120}/>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} className="sr-only" id="post-location" aria-label="Vị trí" maxLength={60}/>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={selectPostImage}/>
            {imagePreview && <div className="relative mt-3 overflow-hidden rounded-xl border border-[#e5e5e5]"><img src={imagePreview} alt="Xem trước ảnh đính kèm" className="max-h-64 w-full object-cover"/><button type="button" onClick={() => { setImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ""; }} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-black shadow" aria-label="Xóa ảnh"><X size={17}/></button></div>}
            <div className="mt-2 flex items-center justify-between"><button type="button" className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#229ed9] via-[#2aabee] to-[#06b6d4] text-lg font-black text-white">Aa</button><button type="button" onClick={() => setFeeling(feeling ? "" : "hào hứng")} className="text-[#4f5661] hover:text-[#229ed9]" aria-label="Thêm cảm xúc"><Smile size={24}/></button></div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#d8dadf] px-4 py-3 shadow-sm"><span className="text-[15px] font-semibold text-black">Thêm vào bài viết của bạn</span><div className="flex items-center gap-3"><button type="button" onClick={() => imageInputRef.current?.click()} className="text-[#44bd62]" aria-label="Thêm ảnh hoặc video"><ImageIcon size={24}/></button><button type="button" className="text-[#229ed9]" aria-label="Gắn thẻ bạn bè"><Users size={24}/></button><button type="button" onClick={() => setFeeling(feeling ? "" : "hào hứng")} className="text-[#229ed9]" aria-label="Cảm xúc"><Smile size={25}/></button><button type="button" onClick={() => document.getElementById("post-location")?.focus()} className="text-[#ef5b55]" aria-label="Thêm vị trí"><MapPin size={24}/></button><button type="button" className="text-[#5e6065]" aria-label="Thêm lựa chọn khác">•••</button></div></div>
            {notice && notice !== "Bài viết đã được đăng." && <p className="mt-3 text-sm text-[#147aa8]">{notice}</p>}
            <Button disabled={saving || !content.trim()} className="mt-4 h-10 w-full rounded-lg bg-[#229ed9] font-bold text-white hover:bg-[#168ac0] disabled:bg-[#e4e6eb] disabled:text-[#a9adb3]">{saving ? "Đang đăng..." : "Đăng bài"}</Button>
          </form>
        </DialogContent>
      </Dialog>    </div>
  );
}

