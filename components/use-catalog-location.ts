"use client";
import { useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Read the current URL after hydration so one public shell can serve every
// filter without sharing a visitor's query or session with another visitor.
export function useCatalogLocation(initial: { searchQuery: string; sort: string; targetPostId?: string; page?: number; initialReady?: boolean }) {
  // These hooks subscribe to client-router commits as well as browser history.
  usePathname();
  useSearchParams();
  const href = useSyncExternalStore(subscribe, () => window.location.href, () => "");
  if (!href) return { ...initial, ready: initial.initialReady ?? false };
  const url = new URL(href);
  const single = (key: string) => url.searchParams.getAll(key).length === 1 ? url.searchParams.get(key) ?? undefined : undefined;
  const page = url.pathname.match(/\/page\/([1-9]\d*)$/)?.[1] ?? single("page");
  return { searchQuery: (single("q") ?? "").trim().slice(0, 120), sort: single("sort") ?? "",
    targetPostId: single("postId"), page: page && /^[1-9]\d*$/.test(page) && Number(page) <= 1000000 ? Number(page) : 1, ready: true };
}
function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}
