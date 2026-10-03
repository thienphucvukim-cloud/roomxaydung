"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Calculator, ChevronDown, CircleHelp, DraftingCompass, Heart, LogIn, LogOut, Menu, House, Search, ShieldCheck, Sofa, UserRound, WalletCards, Handshake } from "lucide-react";
import { HouseGalleryIcon } from "@/components/house-gallery-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ClientNavigationLink } from "@/components/client-navigation-link";
import { AnimatedTabNavigation } from "@/components/animated-tab-navigation";
import { EditableImage, useSiteEditor } from "@/components/site-editor";
import { AccountSwitcher } from "@/components/account-switcher";
import { RequestActionButton } from "@/components/interactive-actions";
import { CurrentMemberAvatar } from "@/components/member-avatar";

const nav = [
  ["Bảng tin", "/", House],
  ["Mẫu nhà đẹp", "/kho-mau-nha-dep-chat", HouseGalleryIcon],
  ["Kho bản vẽ", "/file-ban-ve-nha-dep-chat", DraftingCompass],
  ["Nội thất", "/noi-that", Sofa],
  ["Thuê thiết kế", "/thue-thiet-ke", Handshake],
  ["Tính vật tư", "/tinh-vat-tu-nha-dep-chat", Calculator],
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/kho-mau-nha-dep-chat") {
    return ["/kho-mau-nha-dep-chat", "/mat-bang-cong-nang"].some((item) => pathname.startsWith(item));
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
  const [notifications, setNotifications] = useState<{ id: number; subject: string; content?: string; readAt?: string | null }[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/me", { signal: controller.signal, cache: "no-store" }).then(response => response.json() as Promise<{ user?: { name: string; authenticated?: boolean; isAdmin?: boolean } }>).then(data => setMember(data.user ?? null)).catch(() => {});
    const refresh = () => fetch("/api/messages", { signal: controller.signal, cache: "no-store" }).then(response => response.json() as Promise<{ messages?: { id: number; subject: string; content?: string; readAt?: string | null }[] }>).then(data => setNotifications(data.messages ?? [])).catch(() => {});
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
    <div className="relative mx-auto grid h-[48px] min-h-[48px] max-h-[48px] max-w-[1360px] grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 px-2.5 sm:gap-2 sm:px-3.5 lg:h-[56px] lg:min-h-[56px] lg:max-h-[56px] lg:grid-cols-[1fr_minmax(300px,480px)_1fr] lg:gap-3 lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <ClientNavigationLink href="/" className="flex shrink-0 items-center" aria-label="NhàĐẹpChất - Trang chủ">
          <EditableImage contentKey="global.logo" src="/nhadepchat-symbol.png?v=4" alt={siteEditor.content["global.name"]?.value || "NhàĐẹpChất"} width={1774} height={887} className="h-[32px] w-[64px] object-contain lg:h-[40px] lg:w-[80px]"/>
          {siteEditor.content["global.name"] && <span className="ml-2 hidden max-w-28 truncate text-xs font-bold lg:inline">{siteEditor.content["global.name"].value}</span>}
        </ClientNavigationLink>
        <form onSubmit={search} className={`absolute left-3 right-3 top-[calc(100%+8px)] z-50 min-w-0 rounded-2xl border border-[#dde5ed] bg-white p-2 shadow-xl ${mobileSearchExpanded ? "block" : "hidden"} sm:left-4 sm:right-4 lg:relative lg:left-auto lg:right-auto lg:top-auto lg:z-auto lg:block lg:flex-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none 2xl:w-[238px] 2xl:flex-none`}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#64748b]"/>
          <input autoFocus={mobileSearchExpanded} value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-full border border-transparent bg-[#f0f4f8] pl-10 pr-9 text-sm outline-none transition hover:bg-[#eaf0f5] focus:border-[#9dd9ef] focus:bg-white focus:ring-4 focus:ring-[#229ed9]/10 lg:h-[36px] lg:pr-4 lg:text-[13px]" placeholder="Tìm kiếm trên NhàĐẹpChất"/>
          <button type="button" onClick={() => setMobileSearchExpanded(false)} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-lg leading-none text-[#667085] hover:bg-white lg:hidden" aria-label="Đóng tìm kiếm">×</button>
        </form>
      </div>

      <AnimatedTabNavigation
        items={nav}
        activeIndex={nav.findIndex(([, href]) => isActive(pathname, href))}
        label="Điều hướng chính"
        className="hidden h-full w-full grid-cols-6 lg:grid"
      />

      <div className="flex min-w-0 items-center justify-end gap-0.5 sm:gap-1">
        <button type="button" onClick={() => setMobileSearchExpanded((value) => !value)} className={`social-icon-button grid lg:hidden ${mobileSearchExpanded ? "bg-[#dff3fb] text-[#168ac0]" : ""}`} aria-label={mobileSearchExpanded ? "Đóng tìm kiếm" : "Mở tìm kiếm"}><Search size={20}/></button>
        <ClientNavigationLink href="/hoi-chuyen-gia" title="Hỏi chuyên gia" aria-label="Hỏi chuyên gia" aria-current={pathname.startsWith("/hoi-chuyen-gia") ? "page" : undefined} className={`social-icon-button hidden sm:grid lg:hidden ${pathname.startsWith("/hoi-chuyen-gia") ? "bg-[#dff3fb] text-[#168ac0]" : ""}`}><CircleHelp size={20}/></ClientNavigationLink>
        <RequestActionButton requestType="admin-help" targetType="website" targetId={pathname} label="Liên hệ admin" title="Nhắn admin" description="Gửi câu hỏi hoặc báo lỗi cho admin. Bạn có thể đính kèm ảnh hoặc tài liệu và để lại email hoặc số điện thoại để được hỗ trợ." allowFile iconOnly="admin" className="social-icon-button social-admin-button grid"/>
        <Popover>
          <PopoverTrigger asChild><button type="button" className="social-icon-button relative grid" aria-label={`Thông báo${unread.length ? ` (${unread.length} chưa đọc)` : ""}`}><Bell size={20} className="social-notification-icon"/>{unread.length > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e41e3f] px-1 text-[10px] font-bold leading-none tabular-nums text-white ring-2 ring-white">{unread.length > 99 ? "99+" : unread.length}</span>}</button></PopoverTrigger>
          <PopoverContent align="end" className="w-80 rounded-2xl border-[#dde5ed] p-4 shadow-xl"><h2 className="text-lg font-extrabold text-[#172b43]">Thông báo</h2>{notifications.length ? <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{notifications.slice(0, 8).map(message => <a key={message.id} href="/tai-khoan#tin-nhan" className={`block rounded-xl p-3 text-sm ${message.readAt ? "bg-[#f3f7fa] text-[#667085]" : "bg-sky-50 font-bold text-[#0b2e59]"}`}>{message.subject}</a>)}</div> : <div className="mt-3 rounded-xl bg-[#f3f7fa] p-6 text-center text-sm text-[#667085]">Bạn chưa có thông báo mới.</div>}</PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild><button className="flex items-center gap-1 rounded-full p-0.5 hover:bg-[#eef3f7]" aria-label="Tài khoản"><CurrentMemberAvatar className="size-7 lg:size-8"/><ChevronDown className="mr-1 hidden size-4 lg:block"/></button></PopoverTrigger>
          <PopoverContent align="end" className="max-h-[var(--radix-popover-content-available-height)] w-72 overflow-y-auto rounded-2xl border-[#dde5ed] p-2 shadow-xl">
            <ClientNavigationLink href="/tai-khoan" className="flex items-center gap-3 rounded-xl bg-[#f3f7fa] p-3"><CurrentMemberAvatar className="size-11"/><span><b className="block text-sm">{member?.name || "Thành viên NhàĐẹpChất"}</b><small className="text-[#667085]">Xem trang cá nhân</small></span></ClientNavigationLink>
            <ClientNavigationLink href="/tai-khoan" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><UserRound size={18}/>Hoạt động của tôi</ClientNavigationLink>
            <a href="/tai-khoan#vi-nhadepchat" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#168ac0] hover:bg-[#f3f7fa]"><WalletCards size={18}/>Nạp tiền vào ví</a>
            <ClientNavigationLink href="/thue-thiet-ke" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><Handshake size={18}/>Dự án thuê thiết kế</ClientNavigationLink>
            <a href="/tai-khoan#mau-ua-thich" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><Heart size={18}/>Mẫu ưa thích</a>
            {member?.isAdmin && <button type="button" onClick={() => siteEditor.manage("noi-dung")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><ShieldCheck size={18}/>Quản lý website</button>}
            <AccountSwitcher returnTo={pathname} blocked={siteEditor.accountSwitchBlocked}/>
            {member?.authenticated ? <form action="/api/auth/logout" method="post"><button disabled={siteEditor.accountSwitchBlocked} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa] disabled:opacity-50"><LogOut size={18}/>Đăng xuất</button></form> : <ClientNavigationLink href={"/dang-nhap?return_to=" + encodeURIComponent(pathname)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><LogIn size={18}/>Đăng nhập</ClientNavigationLink>}
          </PopoverContent>
        </Popover>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><button className="social-icon-button grid lg:hidden" aria-label="Mở menu"><Menu size={21}/></button></SheetTrigger>
          <SheetContent side="right" className="w-[min(360px,90vw)] bg-[#f6f8fa] p-0"><SheetHeader className="border-b bg-white p-5 text-left"><SheetTitle>Khám phá NhàĐẹpChất</SheetTitle></SheetHeader><nav className="grid grid-cols-2 gap-2 p-4">{nav.map(([label, href, Icon]) => <ClientNavigationLink key={href} href={href} onClick={() => setMenuOpen(false)} className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3.5 text-sm font-bold ${isActive(pathname, href) ? "border-[#b9e2f2] bg-[#e8f6fc] text-[#168ac0]" : "border-[#e1e7ee] bg-white text-[#344054]"}`}><span className="grid size-9 place-items-center rounded-xl bg-[#eef3f7]"><Icon size={19}/></span>{label}</ClientNavigationLink>)}<ClientNavigationLink href="/hoi-chuyen-gia" onClick={() => setMenuOpen(false)} className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3.5 text-sm font-bold ${pathname.startsWith("/hoi-chuyen-gia") ? "border-[#b9e2f2] bg-[#e8f6fc] text-[#168ac0]" : "border-[#e1e7ee] bg-white text-[#344054]"}`}><span className="grid size-9 place-items-center rounded-xl bg-[#eef3f7]"><CircleHelp size={19}/></span>Hỏi chuyên gia</ClientNavigationLink></nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  </header>;
}
