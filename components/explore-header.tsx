"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Calculator, ChevronDown, CircleHelp, FileText, Home, Images, LogOut, Menu, MessageCircle, Search, Sigma, UserRound, Wrench } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const nav = [
  ["Bảng tin", "/", Home],
  ["Kho bản vẽ", "/file-ban-ve", FileText],
  ["Tính vật tư", "/tinh-vat-tu", Calculator],
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/mau-nha-dep") return ["/mau-nha-dep", "/mat-bang-cong-nang", "/file-ban-ve"].some((item) => pathname.startsWith(item));
  return pathname.startsWith(href);
}

export function ExploreHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const samplesActive = ["/mau-nha-dep", "/mat-bang-cong-nang"].some((item) => pathname.startsWith(item));
  const utilitiesActive = pathname.startsWith("/tinh-khoi-luong-thep");

  const search = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) {
      setMobileSearchExpanded(false);
      router.push("/tim-kiem?q=" + encodeURIComponent(query.trim()));
    }
  };

  return <header className="social-header sticky top-0 z-50 border-b border-[#e1e7ee] bg-white/95 shadow-[0_1px_8px_rgba(16,40,72,.07)] backdrop-blur-xl">
    <div className="relative mx-auto grid h-[68px] max-w-[1360px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 sm:px-4 lg:grid-cols-[1fr_minmax(360px,600px)_1fr] lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Tipook - Bảng tin">
          <Image src="/tipook-logo.png" alt="Tipook" width={1774} height={887} priority className="h-auto w-[112px] object-contain sm:w-[124px]"/>
        </Link>
        <form onSubmit={search} className={`absolute left-3 right-3 top-[calc(100%+8px)] z-50 min-w-0 rounded-2xl border border-[#dde5ed] bg-white p-2 shadow-xl ${mobileSearchExpanded?"block":"hidden"} sm:left-4 sm:right-4 lg:relative lg:left-auto lg:right-auto lg:top-auto lg:z-auto lg:block lg:flex-1 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none 2xl:w-[238px] 2xl:flex-none`}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#64748b]"/>
          <input autoFocus={mobileSearchExpanded} value={query} onChange={(event)=>setQuery(event.target.value)} className="h-11 w-full rounded-full border border-transparent bg-[#f0f4f8] pl-10 pr-9 text-sm outline-none transition hover:bg-[#eaf0f5] focus:border-[#9dd9ef] focus:bg-white focus:ring-4 focus:ring-[#229ed9]/10 lg:pr-4" placeholder="Tìm kiếm trên Tipook"/>
          <button type="button" onClick={()=>setMobileSearchExpanded(false)} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-lg leading-none text-[#667085] hover:bg-white lg:hidden" aria-label="Đóng tìm kiếm">×</button>
        </form>
      </div>

      <nav className="hidden h-full w-full grid-cols-5 lg:grid" aria-label="Điều hướng chính">
        {nav.slice(0,1).map(([label,href,Icon]) => {
          const active=isActive(pathname,href);
          return <Link key={href} href={href} title={label} aria-current={active?"page":undefined} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg transition after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full ${active?"text-[#168ac0] after:bg-[#229ed9]":"text-[#52677f] after:scale-x-0 hover:bg-[#f5f8fb] hover:text-[#168ac0]"}`}><Icon size={23} strokeWidth={active?2.4:1.9}/><span className="max-w-full truncate text-[11px] font-semibold leading-none">{label}</span></Link>;
        })}
        <Link href="/mau-nha-dep" title="Kho mẫu" aria-current={samplesActive?"page":undefined} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg transition after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full ${samplesActive?"text-[#168ac0] after:bg-[#229ed9]":"text-[#52677f] after:scale-x-0 hover:bg-[#f5f8fb] hover:text-[#168ac0]"}`}><Images size={23} strokeWidth={samplesActive?2.4:1.9}/><span className="max-w-full truncate text-[11px] font-semibold leading-none">Kho mẫu</span></Link>
{nav.slice(1).map(([label,href,Icon]) => {
          const active=isActive(pathname,href);
          return <Link key={href} href={href} title={label} aria-current={active?"page":undefined} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg transition after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full ${active?"text-[#168ac0] after:bg-[#229ed9]":"text-[#52677f] after:scale-x-0 hover:bg-[#f5f8fb] hover:text-[#168ac0]"}`}><Icon size={23} strokeWidth={active?2.4:1.9}/><span className="max-w-full truncate text-[11px] font-semibold leading-none">{label}</span></Link>;
        })}
        <Popover>
          <PopoverTrigger asChild><button title="Tiện ích" aria-current={utilitiesActive?"page":undefined} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg transition after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full ${utilitiesActive?"text-[#168ac0] after:bg-[#229ed9]":"text-[#52677f] after:scale-x-0 hover:bg-[#f5f8fb] hover:text-[#168ac0]"}`}><Wrench size={23} strokeWidth={utilitiesActive?2.4:1.9}/><span className="max-w-full truncate text-[11px] font-semibold leading-none">Tiện ích</span></button></PopoverTrigger>
          <PopoverContent align="center" sideOffset={6} className="w-64 rounded-2xl border-[#dde5ed] p-2 shadow-xl"><Link href="/tinh-khoi-luong-thep" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${pathname.startsWith("/tinh-khoi-luong-thep")?"bg-[#e8f6fc] text-[#168ac0]":"text-[#344054] hover:bg-[#f3f6f9]"}`}><span className="grid size-9 place-items-center rounded-xl bg-[#eef3f7]"><Sigma size={18}/></span>Thống kê cốt thép</Link></PopoverContent>
        </Popover>
      </nav>

      <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
        <button type="button" onClick={()=>setMobileSearchExpanded((value)=>!value)} className={`social-icon-button grid lg:hidden ${mobileSearchExpanded?"bg-[#dff3fb] text-[#168ac0]":""}`} aria-label={mobileSearchExpanded?"Đóng tìm kiếm":"Mở tìm kiếm"}><Search size={20}/></button>
        <Link href="/hoi-chuyen-gia" className={`social-icon-button grid lg:hidden ${pathname.startsWith("/hoi-chuyen-gia")?"bg-[#dff3fb] text-[#168ac0]":""}`} aria-label="Hỏi chuyên gia"><CircleHelp size={20}/></Link>
        <Link href="/chat" className={`social-icon-button hidden lg:grid ${pathname==="/chat"?"bg-[#dff3fb] text-[#168ac0]":""}`} aria-label="Tin nhắn"><MessageCircle size={20}/></Link>
        <Popover>
          <PopoverTrigger asChild><button className="social-icon-button relative grid" aria-label="Thông báo"><Bell size={20}/><i className="absolute right-1 top-1 size-2 rounded-full bg-[#f04438] ring-2 ring-white"/></button></PopoverTrigger>
          <PopoverContent align="end" className="w-80 rounded-2xl border-[#dde5ed] p-4 shadow-xl"><h2 className="text-lg font-extrabold text-[#172b43]">Thông báo</h2><div className="mt-3 rounded-xl bg-[#f3f7fa] p-6 text-center text-sm text-[#667085]">Hoạt động mới sẽ xuất hiện tại đây.</div></PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild><button className="hidden items-center gap-1 rounded-full p-1 hover:bg-[#eef3f7] lg:flex" aria-label="Tài khoản"><Image src="/avatars/user-nguyen-van-a.png" alt="Thành viên Tipook" width={36} height={36} className="size-9 rounded-full object-cover"/><ChevronDown className="mr-1 size-4"/></button></PopoverTrigger>
          <PopoverContent align="end" className="w-72 rounded-2xl border-[#dde5ed] p-2 shadow-xl"><Link href="/tai-khoan" className="flex items-center gap-3 rounded-xl bg-[#f3f7fa] p-3"><Image src="/avatars/user-nguyen-van-a.png" alt="" width={44} height={44} className="size-11 rounded-full object-cover"/><span><b className="block text-sm">Thành viên Tipook</b><small className="text-[#667085]">Xem trang cá nhân</small></span></Link><Link href="/tai-khoan" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><UserRound size={18}/>Hoạt động của tôi</Link><a href="/signout-with-chatgpt?return_to=/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa]"><LogOut size={18}/>Đăng xuất</a></PopoverContent>
        </Popover>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild><button className="social-icon-button grid lg:hidden" aria-label="Mở menu"><Menu size={21}/></button></SheetTrigger>
          <SheetContent side="right" className="w-[min(360px,90vw)] bg-[#f6f8fa] p-0"><SheetHeader className="border-b bg-white p-5 text-left"><SheetTitle>Khám phá Tipook</SheetTitle></SheetHeader><nav className="grid grid-cols-2 gap-2 p-4">{nav.slice(0,1).map(([label,href,Icon])=><Link key={href} href={href} onClick={()=>setMenuOpen(false)} className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3.5 text-sm font-bold ${isActive(pathname,href)?"border-[#b9e2f2] bg-[#e8f6fc] text-[#168ac0]":"border-[#e1e7ee] bg-white text-[#344054]"}`}><span className="grid size-9 place-items-center rounded-xl bg-[#eef3f7]"><Icon size={19}/></span>{label}</Link>)}<Link href="/mau-nha-dep" onClick={()=>setMenuOpen(false)} className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3.5 text-sm font-bold ${samplesActive?"border-[#b9e2f2] bg-[#e8f6fc] text-[#168ac0]":"border-[#e1e7ee] bg-white text-[#344054]"}`}><span className="grid size-9 place-items-center rounded-xl bg-[#eef3f7]"><Images size={19}/></span>Kho mẫu</Link>{nav.slice(1).map(([label,href,Icon])=><Link key={href} href={href} onClick={()=>setMenuOpen(false)} className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3.5 text-sm font-bold ${isActive(pathname,href)?"border-[#b9e2f2] bg-[#e8f6fc] text-[#168ac0]":"border-[#e1e7ee] bg-white text-[#344054]"}`}><span className="grid size-9 place-items-center rounded-xl bg-[#eef3f7]"><Icon size={19}/></span>{label}</Link>)}<div className="col-span-2 rounded-2xl border border-[#e1e7ee] bg-white p-3.5"><div className="flex items-center gap-2 text-sm font-bold text-[#344054]"><span className="grid size-9 place-items-center rounded-xl bg-[#eef3f7]"><Wrench size={19}/></span>Tiện ích</div><Link href="/tinh-khoi-luong-thep" onClick={()=>setMenuOpen(false)} className={`mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${pathname.startsWith("/tinh-khoi-luong-thep")?"bg-[#e8f6fc] text-[#168ac0]":"bg-[#f6f8fa] text-[#344054]"}`}><Sigma size={18}/>Thống kê cốt thép</Link></div></nav>
        </SheetContent>
        </Sheet>
      </div>
    </div>
  </header>;
}
