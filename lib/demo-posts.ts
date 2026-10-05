import type { SiteContent } from "./site-content";

export function demoPostState(content: SiteContent, prefix: string) {
  const value = content[`${prefix}.visibility`]?.value;
  return value === "hidden" || value === "deleted" ? value : "public";
}

export function demoPostVisible(content: SiteContent, prefix?: string, isAdmin = false) {
  if (!prefix) return true;
  const state = demoPostState(content, prefix);
  return state === "public" || (isAdmin && state === "hidden");
}
