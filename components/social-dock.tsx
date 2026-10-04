"use client";

import { SITE_SECTIONS } from "@/lib/site-sections";
import { usePathname } from "next/navigation";
import { DraftingCompass, House, Sofa, Handshake } from "lucide-react";
import { HouseGalleryIcon } from "@/components/house-gallery-icon";
import { AnimatedTabNavigation } from "@/components/animated-tab-navigation";

const items = [
  [SITE_SECTIONS.news.label, SITE_SECTIONS.news.path, House],
  [SITE_SECTIONS.houseModels.label, SITE_SECTIONS.houseModels.path, HouseGalleryIcon],
  [SITE_SECTIONS.drawings.label, SITE_SECTIONS.drawings.path, DraftingCompass],
  [SITE_SECTIONS.interiors.label, SITE_SECTIONS.interiors.path, Sofa],
  [SITE_SECTIONS.designMarketplace.label, SITE_SECTIONS.designMarketplace.path, Handshake],
] as const;

export function SocialDock() {
  const pathname = usePathname();

  return <AnimatedTabNavigation
    items={items}
    activeIndex={items.findIndex(([, href]) => href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/kho-mau-nha-dep-chat" && pathname.startsWith("/mat-bang-cong-nang")))}
    mobile
    label="Điều hướng nhanh"
    className="mobile-social-nav fixed z-50 grid grid-cols-5 border border-white/20 bg-white/20 px-1 shadow-[0_3px_16px_rgba(16,36,58,.12)] backdrop-blur-xl lg:hidden"
  />;
}
