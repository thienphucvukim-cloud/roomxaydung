"use client";

import { usePathname } from "next/navigation";
import { Calculator, CircleHelp, FileText, Images, Sofa } from "lucide-react";
import { AnimatedTabNavigation } from "@/components/animated-tab-navigation";

const items = [
  ["Mặt tiền", "/kho-mau-nha-dep-tipook", Images],
  ["Kho bản vẽ", "/file-ban-ve-nha-dep-tipook", FileText],
  ["Nội thất", "/noi-that", Sofa],
  ["Tính vật tư", "/tinh-vat-tu-tipook", Calculator],
  ["Tư vấn", "/hoi-chuyen-gia", CircleHelp],
] as const;

export function SocialDock() {
  const pathname = usePathname();

  return <AnimatedTabNavigation
    items={items}
    activeIndex={items.findIndex(([, href]) => pathname.startsWith(href) || (href === "/kho-mau-nha-dep-tipook" && pathname.startsWith("/mat-bang-cong-nang")))}
    mobile
    label="Điều hướng nhanh"
    className="mobile-social-nav fixed inset-x-0 bottom-0 z-50 grid h-[calc(66px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-[#dce4eb] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_22px_rgba(16,36,58,.08)] backdrop-blur-xl lg:hidden"
  />;
}
