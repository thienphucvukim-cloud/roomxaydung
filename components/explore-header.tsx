"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";

const items = [
  { label: "Cộng đồng", href: "/" },
  { label: "Mẫu nhà đẹp", href: "/mau-nha-dep" },
  { label: "Mặt bằng công năng", href: "/mat-bang-cong-nang" },
  { label: "Kho bản vẽ", href: "/file-ban-ve" },
  { label: "Nhà thầu thi công", href: "/nha-thau-thi-cong" },
  { label: "Hỏi chuyên gia", href: "/hoi-chuyen-gia" },
  { label: "Việc làm", href: "/viec-lam" },
];

export function ExploreHeader() {
  const pathname = usePathname();
  return <header className="sticky top-0 z-40 border-b border-[#e6edf5] bg-white/95 shadow-[0_2px_12px_rgba(20,57,97,.04)] backdrop-blur-xl">
    <div className="mx-auto flex h-[72px] max-w-[1568px] items-center gap-4 px-4 lg:px-8">
      <Link href="/" className="flex shrink-0 items-center" aria-label="ROOM XÂY DỰNG - Trang chủ">
        <span className="flex flex-col items-center gap-0.5 leading-none"><img src="/logo-room-v2.png" alt="ROOM" className="h-auto w-[67px] object-contain sm:w-[89px]"/><span role="img" aria-label="XÂY DỰNG" className="mt-1 block aspect-[2170/725] w-[94px] bg-[#229ed9] sm:mt-0" style={{ WebkitMaskImage: "url('/logo-xay-dung.png')", maskImage: "url('/logo-xay-dung.png')", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskSize: "contain", maskSize: "contain" }}/></span>
      </Link>
      <nav className="ml-[70px] hidden h-full shrink-0 items-center gap-1 xl:flex">{items.map((item) => <Link key={item.href} href={item.href} className={`relative flex h-full items-center whitespace-nowrap px-2.5 text-[14px] font-semibold transition-colors after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-[3px] after:rounded-full ${pathname === item.href ? "text-[#0b3264] after:bg-[#229ed9]" : "text-[#243d5d] after:scale-x-0 hover:text-[#229ed9] hover:after:scale-x-100 hover:after:bg-[#229ed9]"}`}>{item.label}</Link>)}</nav>
      <label className="relative ml-auto hidden w-full max-w-[315px] 2xl:block"><Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#4d647e]"/><input className="h-11 w-full rounded-full border-0 bg-[#f1f5fa] pl-11 pr-4 text-[14px] text-[#173b67] outline-none placeholder:text-[#66788c]" placeholder="Tìm kiếm bài viết, nhà thầu, kinh nghiệm..."/></label>
      <button className="relative ml-auto hidden size-10 place-items-center rounded-full text-[#314b6d] transition hover:bg-[#f1f5fa] 2xl:grid" aria-label="Thông báo"><Bell size={21}/><span className="absolute right-1 top-1 size-2 rounded-full bg-[#229ed9] ring-2 ring-white"/></button>
      <Link href="/dang-nhap" className="hidden shrink-0 items-center gap-2 rounded-full p-1 pr-2 text-[#173b67] hover:bg-[#f4f7fb] md:flex" aria-label="Tài khoản"><img src="/avatars/user-nguyen-van-a.png" alt="Nguyễn Văn A" className="size-9 rounded-full object-cover"/><span className="hidden whitespace-nowrap text-sm font-semibold 2xl:inline">Nguyễn Văn A</span><ChevronDown className="hidden size-[15px] 2xl:block"/></Link>
      <button className="grid size-10 place-items-center rounded-xl text-[#173b67] hover:bg-[#f1f5fa] xl:hidden" aria-label="Mở menu"><Menu size={22}/></button>
    </div>
  </header>;
}
