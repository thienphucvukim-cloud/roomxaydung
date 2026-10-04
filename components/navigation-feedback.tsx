"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { SITE_SECTIONS } from "@/lib/site-sections";

type PendingNavigation = { href: string; pathname: string; from: string };
const NavigationFeedbackContext = createContext<{
  pending: PendingNavigation | null;
  begin: (href: string) => void;
} | null>(null);

export function NavigationFeedbackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  // A committed route or Back/Forward must never resurrect an old loading UI.
  if (pending && pending.from !== pathname) setPending(null);
  useEffect(() => {
    const cancel = () => setPending(null);
    window.addEventListener("popstate", cancel);
    return () => window.removeEventListener("popstate", cancel);
  }, []);
  const begin = (href: string) => {
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin) return;
    setPending(target.pathname === pathname ? null : { href: target.pathname + target.search + target.hash, pathname: target.pathname, from: pathname });
  };
  return <NavigationFeedbackContext.Provider value={{ pending: pending?.from === pathname ? pending : null, begin }}>{children}</NavigationFeedbackContext.Provider>;
}

export function useNavigationFeedback() {
  return useContext(NavigationFeedbackContext);
}

export function useNavigationMenuPathname() {
  const pathname = usePathname();
  return useNavigationFeedback()?.pending?.pathname ?? pathname;
}

export function NavigationPageContent({ children }: { children: ReactNode }) {
  const pending = useNavigationFeedback()?.pending;
  const [slowNavigation, setSlowNavigation] = useState<PendingNavigation | null>(null);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setSlowNavigation(pending), 12000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  const label = Object.values(SITE_SECTIONS).find(section => section.path === pending?.pathname)?.label;
  return <div data-navigation-content aria-busy={Boolean(pending)}>
    <div className="navigation-page-content" data-navigation-pending={Boolean(pending)} inert={pending ? true : undefined} aria-hidden={pending ? true : undefined}>{children}</div>
    {pending && <main data-navigation-loading className="fixed inset-x-0 bottom-0 top-[48px] z-40 overflow-y-auto bg-[#f6f8fa] lg:top-[56px]"><div className="mx-auto max-w-[1360px] px-4 py-10 sm:px-6">
      <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm font-semibold text-[#667085]">
        <LoaderCircle size={20} className="animate-spin text-[#229ed9]" aria-hidden="true"/>
        <span>Đang tải{label ? ` ${label}` : " trang"}…</span>
      </div>
      <div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map(item => <div key={item} className="rounded-2xl border border-[#e1e7ee] bg-white p-4"><div className="h-36 rounded-xl bg-[#eef3f7]"/><div className="mt-4 h-4 w-3/4 rounded bg-[#eef3f7]"/><div className="mt-3 h-3 w-1/2 rounded bg-[#eef3f7]"/></div>)}
      </div>
      {slowNavigation === pending && <p className="mt-6 text-sm text-[#667085]">Trang đang tải lâu hơn bình thường. <a href={pending.href} className="font-semibold text-[#168ac0] underline">Tải lại trang này</a></p>}
    </div></main>}
  </div>;
}
