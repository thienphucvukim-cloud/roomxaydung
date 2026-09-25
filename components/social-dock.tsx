"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Images, MessageCircle, Plus, UserRound } from "lucide-react";

const left = [
  ["Bảng tin", "/", Home],
  ["Kho mẫu", "/kho-mau-nha-dep-tipook", Images],
] as const;
const right = [
  ["Tin nhắn", "/chat", MessageCircle],
  ["Cá nhân", "/tai-khoan", UserRound],
] as const;

export function SocialDock() {
  const pathname = usePathname();
  const router = useRouter();
  const createPost = () => {
    if (pathname === "/") window.dispatchEvent(new Event("tipook:open-composer"));
    else router.push("/?compose=1");
  };
  const item = ([label,href,Icon]: typeof left[number] | typeof right[number]) =>
    <Link key={href} href={href} aria-current={pathname===href?"page":undefined} className={`mobile-dock-link ${pathname===href?"text-[#168ac0]":"text-[#667085]"}`}><Icon size={20} strokeWidth={pathname===href?2.5:2}/>{label}</Link>;

  return <nav className="mobile-social-nav fixed inset-x-0 bottom-0 z-50 grid h-[calc(66px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-[#dce4eb] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_22px_rgba(16,36,58,.08)] backdrop-blur-xl lg:hidden" aria-label="Điều hướng nhanh">
    {left.map(item)}
    <button type="button" onClick={createPost} className="mobile-dock-link text-[#168ac0]" aria-label="Tạo bài viết"><span className="-mt-7 grid size-12 place-items-center rounded-full border-4 border-[#f5f8fb] bg-[#229ed9] text-white shadow-[0_6px_18px_rgba(34,158,217,.34)]"><Plus size={23}/></span><span className="-mt-0.5">Đăng bài</span></button>
    {right.map(item)}
  </nav>;
}
