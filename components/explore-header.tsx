"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, FileText, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const collectionItems = [
  { label: "Mẫu nhà đẹp", href: "/mau-nha-dep", note: "Khám phá phong cách và mẫu nhà nổi bật" },
  { label: "Mặt bằng công năng", href: "/mat-bang-cong-nang", note: "Tham khảo cách bố trí không gian" },
  { label: "Kho bản vẽ", href: "/file-ban-ve", note: "Tìm hồ sơ CAD và bản vẽ thi công" },
];

const items = [
  { label: "Cộng đồng", href: "/" },
  { label: "Bộ sưu tập", children: collectionItems },
  { label: "Nhà thầu thi công", href: "/nha-thau-thi-cong" },
  { label: "Hỏi chuyên gia", href: "/hoi-chuyen-gia" },
  { label: "Việc làm", href: "/viec-lam" },
];

type Activity = { id: number; label: string; note: string; createdAt: string };
type Member = { user?: { name: string; email: string }; counts?: { posts: number; actions: number; requests: number } };

export function ExploreHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCollectionOpen, setMobileCollectionOpen] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [member, setMember] = useState<Member>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/actions").then((response) => response.ok ? response.json() as Promise<{ actions?: Array<{ id: number; actionType: string; targetId: string; createdAt: string }> }> : Promise.reject()),
      fetch("/api/requests").then((response) => response.ok ? response.json() as Promise<{ requests?: Array<{ id: number; requestType: string; subject: string; status: string; createdAt: string }> }> : Promise.reject()),
      fetch("/api/me").then((response) => response.ok ? response.json() as Promise<Member> : Promise.reject()),
    ]).then(([actionData, requestData, memberData]) => {
      const actionItems = (actionData.actions ?? []).map((item) => ({ id: item.id, label: "Đã " + item.actionType.replaceAll("-", " "), note: item.targetId, createdAt: item.createdAt }));
      const requestItems = (requestData.requests ?? []).map((item) => ({ id: -item.id, label: item.subject, note: "Trạng thái: " + item.status, createdAt: item.createdAt }));
      setActivities([...actionItems, ...requestItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8));
      setMember(memberData);
    }).catch(() => {});
  }, [pathname]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push("/tim-kiem?q=" + encodeURIComponent(value));
  };

  const displayName = member.user?.name || "Thành viên ROOM";

  return <header className="sticky top-0 z-40 border-b border-[#e6edf5] bg-white/95 shadow-[0_2px_12px_rgba(20,57,97,.04)] backdrop-blur-xl">
    <div className="mx-auto flex h-[72px] max-w-[1568px] items-center gap-4 px-4 lg:px-8">
      <Link href="/" className="flex shrink-0 items-center" aria-label="ROOM XÂY DỰNG - Trang chủ">
        <span className="flex flex-col items-center gap-0.5 leading-none"><img src="/logo-room-v2.png" alt="ROOM" className="h-auto w-[67px] object-contain sm:w-[89px]"/><span role="img" aria-label="XÂY DỰNG" className="mt-1 block aspect-[2170/725] w-[94px] bg-[#229ed9] sm:mt-0" style={{ WebkitMaskImage: "url('/logo-xay-dung.png')", maskImage: "url('/logo-xay-dung.png')", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskSize: "contain", maskSize: "contain" }}/></span>
      </Link>

      <nav className="ml-[70px] hidden h-full shrink-0 items-center gap-1 xl:flex">{items.map((item) => item.children ? <Popover key={item.label}>
        <PopoverTrigger asChild><button type="button" style={{ color: "#0b3264", opacity: 1, fontFamily: "inherit", fontSize: "14px", fontWeight: 600 }} className={"relative flex h-full appearance-none items-center gap-1 whitespace-nowrap border-0 bg-transparent px-2.5 leading-none opacity-100 transition-colors disabled:opacity-100 after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-[3px] after:rounded-full " + (item.children.some((child) => pathname === child.href) ? "after:bg-[#229ed9]" : "after:scale-x-0 hover:text-[#229ed9] hover:after:scale-x-100 hover:after:bg-[#229ed9]")}>{item.label}<ChevronDown size={14} className="shrink-0 opacity-100"/></button></PopoverTrigger>
        <PopoverContent align="start" sideOffset={0} className="z-[100] w-80 rounded-2xl border-[#e3eaf2] bg-white p-2 shadow-xl">{item.children.map((child, index) => <Link key={child.href} href={child.href} className={"flex gap-3 rounded-xl p-3 transition hover:bg-[#f1f7fc] " + (pathname === child.href ? "bg-[#e8f6fc]" : "")}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e8f6fc] font-extrabold text-[#168ac0]">{index + 1}</span><span><b className="block text-sm text-[#0b3264]">{child.label}</b><small className="mt-0.5 block text-xs leading-5 text-[#667085]">{child.note}</small></span></Link>)}</PopoverContent>
      </Popover> : <Link key={item.href} href={item.href} className={"relative flex h-full items-center whitespace-nowrap px-2.5 text-[14px] font-semibold transition-colors after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-[3px] after:rounded-full " + (pathname === item.href ? "text-[#0b3264] after:bg-[#229ed9]" : "text-[#243d5d] after:scale-x-0 hover:text-[#229ed9] hover:after:scale-x-100 hover:after:bg-[#229ed9]")}>{item.label}</Link>)}</nav>

      <form onSubmit={search} className="relative ml-auto hidden w-full max-w-[315px] 2xl:block">
        <button type="submit" aria-label="Tìm kiếm" className="absolute left-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center text-[#4d647e]"><Search size={18}/></button>
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-full border-0 bg-[#f1f5fa] pl-11 pr-4 text-[14px] text-[#173b67] outline-none placeholder:text-[#66788c]" placeholder="Tìm bài viết, nhà thầu, kinh nghiệm..."/>
      </form>

      <Popover>
        <PopoverTrigger asChild><button className="relative ml-auto hidden size-10 place-items-center rounded-full text-[#314b6d] transition hover:bg-[#f1f5fa] md:grid 2xl:ml-0" aria-label="Hoạt động"><Bell size={21}/>{activities.length > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-[#229ed9] ring-2 ring-white"/>}</button></PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="z-[100] w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border-[#e3eaf2] bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between px-2 pb-2"><h2 className="font-bold text-[#0b2e59]">Hoạt động gần đây</h2><Link href="/tai-khoan" className="text-xs font-bold text-[#229ed9]">Xem tài khoản</Link></div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {activities.map((item) => <div key={item.id} className="rounded-xl px-3 py-2.5 hover:bg-[#f4f7fb]"><p className="truncate text-sm font-semibold text-[#182230]">{item.label}</p><p className="mt-0.5 truncate text-xs text-[#667085]">{item.note}</p></div>)}
            {!activities.length && <div className="px-3 py-8 text-center text-sm text-[#667085]">Chưa có hoạt động nào.</div>}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild><button className="hidden shrink-0 items-center gap-2 rounded-full p-1 pr-2 text-[#173b67] hover:bg-[#f4f7fb] md:flex" aria-label="Tài khoản"><img src="/avatars/user-nguyen-van-a.png" alt={displayName} className="size-9 rounded-full object-cover"/><span className="hidden max-w-28 truncate text-sm font-semibold 2xl:inline">{displayName}</span><ChevronDown className="hidden size-[15px] 2xl:block"/></button></PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="z-[100] w-72 rounded-2xl border-[#e3eaf2] bg-white p-2 shadow-xl">
          <div className="rounded-xl bg-[#f4f7fb] p-3"><p className="truncate font-bold text-[#0b2e59]">{displayName}</p><p className="truncate text-xs text-[#667085]">{member.user?.email}</p></div>
          <Link href="/tai-khoan" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#f4f7fb]"><UserRound size={18}/>Hồ sơ và hoạt động</Link>
          <a href="/signout-with-chatgpt?return_to=/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#f4f7fb]"><LogOut size={18}/>Đăng xuất</a>
        </PopoverContent>
      </Popover>

      <button type="button" onClick={() => router.push("/tim-kiem")} className="grid size-10 place-items-center rounded-xl text-[#173b67] hover:bg-[#f1f5fa] 2xl:hidden" aria-label="Tìm kiếm"><Search size={21}/></button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild><button className="grid size-10 place-items-center rounded-xl text-[#173b67] hover:bg-[#f1f5fa] xl:hidden" aria-label="Mở menu"><Menu size={22}/></button></SheetTrigger>
        <SheetContent side="right" className="w-[min(360px,90vw)] bg-white p-0">
          <SheetHeader className="border-b border-[#e6edf5] p-5 text-left"><SheetTitle>ROOM XÂY DỰNG</SheetTitle></SheetHeader>
          <form onSubmit={(event) => { search(event); setMobileOpen(false); }} className="relative m-4"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#667085]"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl bg-[#f1f5fa] pl-10 pr-3 text-sm outline-none" placeholder="Tìm kiếm..."/></form>
          <nav className="px-3">{items.map((item) => item.children ? <div key={item.label} className="py-1"><button type="button" onClick={() => setMobileCollectionOpen((value) => !value)} className={"flex w-full appearance-none items-center justify-between rounded-xl border-0 bg-transparent px-4 py-3 font-[inherit] text-sm font-semibold " + (item.children.some((child) => pathname === child.href) ? "bg-[#e8f6fc] text-[#168ac0]" : "text-[#344054] hover:bg-[#f4f7fb]")}><span>{item.label}</span><ChevronDown size={16} className={mobileCollectionOpen ? "rotate-180 transition" : "transition"}/></button>{mobileCollectionOpen && <div className="ml-3 mt-1 border-l-2 border-[#dce8f4] pl-2">{item.children.map((child) => <Link key={child.href} href={child.href} onClick={() => setMobileOpen(false)} className={"block rounded-xl px-4 py-2.5 text-sm font-medium " + (pathname === child.href ? "bg-[#eef9fd] text-[#168ac0]" : "text-[#536273] hover:bg-[#f4f7fb]")}>{child.label}</Link>)}</div>}</div> : <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={"block rounded-xl px-4 py-3 text-sm font-semibold " + (pathname === item.href ? "bg-[#e8f6fc] text-[#168ac0]" : "text-[#344054] hover:bg-[#f4f7fb]")}>{item.label}</Link>)}</nav>
          <div className="mt-4 border-t border-[#e6edf5] p-3"><Link href="/tai-khoan" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold text-[#344054]"><UserRound size={19}/>Tài khoản của tôi</Link></div>
        </SheetContent>
      </Sheet>
    </div>
  </header>;
}
