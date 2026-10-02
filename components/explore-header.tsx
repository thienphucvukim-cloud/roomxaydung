"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Calculator, ChevronDown, CircleHelp, FileText, Heart, Images, LogIn, LogOut, Menu, Search, ShieldCheck, Sofa, UserRound, WalletCards } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ClientNavigationLink } from "@/components/client-navigation-link";
import { AnimatedTabNavigation } from "@/components/animated-tab-navigation";
import { EditableImage, useSiteEditor } from "@/components/site-editor";

const nav = [
  ["Mặt tiền", "/kho-mau-nha-dep-tipook", Images],
  ["Kho bản vẽ", "/file-ban-ve-nha-dep-tipook", FileText],
  ["Nội thất", "/noi-that", Sofa],
  ["Tính vật tư", "/tinh-vat-tu-tipook", Calculator],
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/kho-mau-nha-dep-tipook") {
    return ["/kho-mau-nha-dep-tipook", "/mat-bang-cong-nang"].some((item) => pathname.startsWith(item));
  }
  return pathname.startsWith(href);
}

export function ExploreHeader() {
  const siteEditor = useSiteEditor();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const [member, setMember] = useState<{ name: string; authenticated?: boolean; isAdmin?: boolean } | null>(null);
  const [notifications, setNotifications] = useState<{ id: number; subject: string; readAt?: string | null }[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/me", { signal: controller.signal, cache: "no-store" }).then(response => response.json() as Promise<{ user?: { name: string; authenticated?: boolean; isAdmin?: boolean } }>).then(data => setMember(data.user ?? null)).catch(() => {});
    const refresh = () => fetch("/api/messages", { signal: controller.signal, cache: "no-store" }).then(response => response.json() as Promise<{ messages?: { id: number; subject: string; readAt?: string | null }[] }>).then(data => setNotifications(data.messages ?? [])).catch(() => {});
    void refresh();
    const onMessageChange = () => void refresh();
    window.addEventListener("tipook-messages-changed", onMessageChange);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("tipook-messages-changed", onMessageChange); };
  }, [pathname]);
  const unread = notifications.filter(message => !message.readAt);

  const search = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) {
      setMobileSearchExpanded(false);
      router.push("/tim-kiem?q=" + encodeURIComponent(query.trim()));
    }
  };

  return <header className="social-header sticky top-0 z-50 border-b border-[#e1e7ee] bg-white/95 shadow-[0_1px_8px_rgba(16,40,72,.07)] backdrop-blur-xl">
    <div className="relative mx-auto grid h-[60px] min-h-[60px] max-h-[60px] max-w-[1360px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:h-[68px] lg:min-h-[68px] lg:max-h-[68px] lg:grid-cols-[1fr_minmax(300px,480px)_1fr] lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <ClientNavigationLink href="/kho-mau-nha-dep-tipook" className="flex shrink-0 items-center" aria-label="Tipook - Mặt tiền">
          <EditableImage contentKey="global.logo" src="/nhadepchat-symbol.png" alt={siteEditor.content["global.name"]?.value || "NhàĐẹpChất"} width={1774} height={887} className="h-[40px] w-[80px] object-contain sm:h-[42px] sm:w-[84px] lg:h-[48px] lg:w-[96px]"/>
          {siteEditor.content["global.name"] && <span className="ml-2 hidden max-w-28 truncate text-xs font-bold lg:inline">{siteEditor.content["global.name"].value}</span>}
        </ClientNavigationLink>
        <form onSubmit={search} className={`absolute left-3 right-3 top-[calc(100%+8px)] z-50 min-w-0 rounded-2xl border border-[#dde5ed] bg-white p-2 shadow-xl ${mobileSearchExpanded ? "block" : "hidden"} sm:left-4 sm:right-4 lg:relative lg:left-auto lg:right-auto lg:top-auto lg:z-auto lg:block lg:flex-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none 2xl:w-[238px] 2xl:flex-none`}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#64748b]"/>
          <input autoFocus={mobileSearchExpanded} value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-full border border-transparent bg-[#f0f4f8] pl-10 pr-9 text-sm outline-none transition hover:bg-[#eaf0f5] focus:border-[#9dd9ef] focus:bg-white focus:ring-4 focus:ring-[#229ed9]/10 lg:pr-4" placeholder="Tìm kiếm trên Tipook"/>
          <button type="button" onClick={() => setMobileSearchExpanded(false)} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-lg leading-none text-[#667085] hover:bg-white lg:hidden" aria-label="Đóng tìm kiếm">×</button>
        </form>
      </div>

      <AnimatedTabNavigation
        items={nav}
        activeIndex={nav.findIndex(([, href]) => isActive(pathname, href))}
        label="Điều hướng chính"
        className="hidden h-full w-full grid-cols-4 lg:grid"
      />

      <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
        {!member?.authenticated && <ClientNavigationLink href={`/dang-nhap?return_to=${encodeURIComponent(pathname)}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#073b74] px-3 text-xs font-semibold text-white hover:bg-[#0b4b8d]"><LogIn size={16}/><span className="hidden sm:inline">Đăng nhập</span></ClientNavigationLink>}
        <button type="button" onClick={() => setMobileSearchExpanded((value) => !value)} className={`social-icon-button grid lg:hidden ${mobileSearchExpanded ? "bg-[#dff3fb] text-[#168ac0]" : ""}`} aria-label={mobileSearchExpanded ? "Đóng tìm kiếm" : "Mở tìm kiếm"}><Search size={20}/></button>
        <Popover>
          <PopoverTrigger asChild><button className="social-icon-button relative grid" aria-label={`Thông báo${unread.length ? ` (${unread.length} chưa đọc)` : ""}`}><Bell size={20}/>{unread.length > 0 && <i className="absolute right-1 top-1 size-2 rounded-full bg-[#f04438] ring-2 ring-white"/>}</button></PopoverTrigger>
          <PopoverContent align="end" className="w-80 rounded-2xl border-[#dde5ed] p-4 shadow-xl"><h2 className="text-lg font-extrabold text-[#172b43]">Thông báo</h2>{notifications.length ? <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{notifications.slice(0, 8).map(message => <a key={message.id} href="/tai-khoan#tin-nhan" className={`block rounded-xl p-3 text-sm ${message.readAt ? "bg-[#f3f7fa] text-[#667085]" : "bg-sky-50 font-bold text-[#0b2e59]"}`}>{message.subject}</a>)}</div> : <div className="mt-3 rounded-xl bg-[#f3f7fa] p-6 text-center text-sm text-[#667085]">Bạn chưa có thông báo mới.</div>}</PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild><button className="flex items-center gap-1 rounded-full p-0.5 hover:bg-[#eef3f7] lg:p-1" aria-label="Tài khoản"><Image src="/avatars/user-nguyen-van-a.png" alt="Thành viên Tipook" width={36} height={36} className="size-8 rounded-full object-cover lg:size-9"/><ChevronDown className="mr-1 hidden size-4 lg:block"/></button></PopoverTrigger>
          <PopoverContent align="end" className="w-72 rounded-2xl border-[#dde5ed] p-2 shadow-xl">
            <ClientNavigationLink href="/tai-khoan" className="flex items-center gap-3 rounded-xl bg-[#f3f7fa] p-3"><Image src="/avatars/user-nguyen-van-a.png" alt="" width={44} height={44} className="size-11 rounded-full object-cover"/><span><b className="block text-sm">{member?.name || "Thành viên Tipook"}</b><small className="text-[#667085]">Xem trang cá nhân</small></span></ClientNavigationLink>
            <ClientNavigationLink href="/tai-khoan" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><UserRound size={18}/>Hoạt động của tôi</ClientNavigationLink>
            <a href="/tai-khoan#vi-tipook" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#168ac0] hover:bg-[#f3f7fa]"><WalletCards size={18}/>Nạp tiền vào ví</a>
            <a href="/tai-khoan#mau-ua-thich" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><Heart size={18}/>Mẫu ưa thích</a>
            {member?.isAdmin && <button type="button" onClick={() => siteEditor.manage("noi-dung")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><ShieldCheck size={18}/>Quản lý website</button>}
            {member?.authenticated ? <form action="/api/auth/logout" method="post"><button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><LogOut size={18}/>Đăng xuất</button></form> : <ClientNavigationLink href={"/dang-nhap?return_to=" + encodeURIComponent(pathname)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><LogIn size={18}/>Đăng nhập</ClientNavigationLink>}
          </PopoverContent>
        </Popover>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><button className="social-icon-button grid lg:hidden" aria-label="Mở menu"><Menu size={21}/></button></SheetTrigger>
          <SheetContent side="right" className="w-[min(360px,90vw)] bg-[#f6f8fa] p-0"><SheetHeader className="border-b bg-white p-5 text-left"><SheetTitle>Khám phá Tipook</SheetTitle></SheetHeader><nav className="grid grid-cols-2 gap-2 p-4">{nav.map(([label, href, Icon]) => <ClientNavigationLink key={href} href={href} onClick={() => setMenuOpen(false)} className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3.5 text-sm font-bold ${isActive(pathname, href) ? "border-[#b9e2f2] bg-[#e8f6fc] text-[#168ac0]" : "border-[#e1e7ee] bg-white text-[#344054]"}`}><span className="grid size-9 place-items-center rounded-xl bg-[#eef3f7]"><Icon size={19}/></span>{label}</ClientNavigationLink>)}<ClientNavigationLink href="/hoi-chuyen-gia" onClick={() => setMenuOpen(false)} className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3.5 text-sm font-bold ${pathname.startsWith("/hoi-chuyen-gia") ? "border-[#b9e2f2] bg-[#e8f6fc] text-[#168ac0]" : "border-[#e1e7ee] bg-white text-[#344054]"}`}><span className="grid size-9 place-items-center rounded-xl bg-[#eef3f7]"><CircleHelp size={19}/></span>Hỏi chuyên gia</ClientNavigationLink></nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  </header>;
}
