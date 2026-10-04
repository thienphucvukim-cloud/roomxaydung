"use client";

import { SITE_EVENTS } from "@/lib/site-events";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { avatarInitial } from "@/lib/member-avatar";

type AvatarMember = { name: string; avatarUrl?: string | null; authenticated?: boolean };
const AvatarContext = createContext<AvatarMember & { loaded: boolean }>({ name: "", loaded: false });

export function useCurrentMember() { return useContext(AvatarContext); }

export function MemberAvatar({ name, src, className = "size-9", decorative = false }: { name: string; src?: string | null; className?: string; decorative?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <span role={decorative ? undefined : "img"} aria-label={decorative ? undefined : `Ảnh đại diện ${name || "tài khoản"}`} aria-hidden={decorative || undefined} className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f6fc] font-bold text-[#0b2e59] ${className}`}>
    {src && src !== failedSrc ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} className="h-full w-full object-cover"/> : avatarInitial(name)}
  </span>;
}

export function MemberAvatarProvider({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  const [member, setMember] = useState<AvatarMember & { loaded: boolean }>({ name: "", loaded: false });
  const pathname = usePathname();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const refresh = () => {
      void fetch("/api/me", { signal: controller.signal, cache: "no-store" }).then(response => {
        if (!response.ok) throw new Error("Profile unavailable");
        return response.json() as Promise<{ user?: AvatarMember }>;
      }).then(data => setMember({ ...(data.user ?? { name: "", authenticated: false }), loaded: true })).catch(() => { if (!controller.signal.aborted) setMember({ name: "", authenticated: false, loaded: true }); });
    };
    refresh();
    window.addEventListener(SITE_EVENTS.avatarChanged, refresh);
    return () => { controller.abort(); window.removeEventListener(SITE_EVENTS.avatarChanged, refresh); };
  }, [pathname, enabled]);
  return <AvatarContext.Provider value={member}>{children}</AvatarContext.Provider>;
}

export function CurrentMemberAvatar({ className = "size-9" }: { className?: string }) {
  const member = useContext(AvatarContext);
  return <MemberAvatar name={member.name} src={member.avatarUrl} className={className} decorative/>;
}
