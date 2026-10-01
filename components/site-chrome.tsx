"use client";
import { usePathname } from "next/navigation";
import { ExploreHeader } from "@/components/explore-header";
import { SocialDock } from "@/components/social-dock";
import { OwnerWorkspace } from "@/components/site-editor";
import type { SiteContent } from "@/lib/site-content";

export function SiteChrome({ children, initialContent }: { children: React.ReactNode; initialContent: SiteContent }) {
  const pathname = usePathname();
  const separateLayout = ["/dang-nhap", "/dang-ky", "/quen-mat-khau"].includes(pathname);
  return <OwnerWorkspace initialContent={initialContent}>{separateLayout ? children : <><ExploreHeader/>{children}<SocialDock/></>}</OwnerWorkspace>;
}
