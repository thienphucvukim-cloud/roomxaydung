"use client";
import { usePathname } from "next/navigation";
import { ExploreHeader } from "@/components/explore-header";
import { SocialDock } from "@/components/social-dock";
import { OwnerWorkspace } from "@/components/site-editor";
import type { SiteContent } from "@/lib/site-content";
import { MemberAvatarProvider } from "@/components/member-avatar";
import { MemberAccessGate, MemberOnly } from "@/components/member-access";
import { NavigationFeedbackProvider, NavigationPageContent } from "@/components/navigation-feedback";

export function SiteChrome({ children, initialContent }: { children: React.ReactNode; initialContent: SiteContent }) {
  return <NavigationFeedbackProvider><SiteChromeContent initialContent={initialContent}>{children}</SiteChromeContent></NavigationFeedbackProvider>;
}

function SiteChromeContent({ children, initialContent }: { children: React.ReactNode; initialContent: SiteContent }) {
  const pathname = usePathname();
  const separateLayout = ["/admin", "/dang-nhap", "/dang-ky", "/quen-mat-khau"].includes(pathname);
  return <OwnerWorkspace initialContent={initialContent}><MemberAvatarProvider enabled={!separateLayout}><MemberAccessGate>{separateLayout ? <NavigationPageContent>{children}</NavigationPageContent> : <><ExploreHeader/><NavigationPageContent>{pathname === "/tai-khoan" ? <MemberOnly>{children}</MemberOnly> : children}</NavigationPageContent><footer className="border-t border-[#e3eaf2] bg-white px-4 pt-5 pb-28 text-xs text-[#667085] lg:pb-6"><div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3"><p>NhàĐẹpChất — Cộng đồng xây nhà</p><a href="/privacy" className="font-semibold text-[#168ac0] underline-offset-4 hover:underline">Chính sách bảo mật</a></div></footer><SocialDock/></>}</MemberAccessGate></MemberAvatarProvider></OwnerWorkspace>;
}
