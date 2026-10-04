import { SITE_ORIGIN } from "./seo.ts";

// Crawlers must still reach public pages, JS/CSS and public image APIs.
// Private HTML uses noindex; authorization protects private data separately.
export function robotsResponse(method = "GET") {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/admin/",
    "Disallow: /api/wallet/",
    "Disallow: /api/auth/",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(method === "HEAD" ? null : body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
