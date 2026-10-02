import type { SiteContent } from "./site-content";

export function demoPostState(content: SiteContent, prefix: string) {
  const value = content[`${prefix}.visibility`]?.value;
  return value === "hidden" || value === "deleted" ? value : "public";
}

export function demoPostVisible(content: SiteContent, prefix?: string, isAdmin = false) {
  return !prefix || isAdmin || demoPostState(content, prefix) === "public";
}
