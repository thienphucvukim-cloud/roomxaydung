import { env } from "cloudflare:workers";
import { POST_CATEGORIES } from "./legacy-contracts";
import { PUBLIC_SEO_PATHS, SITE_ORIGIN } from "./seo";

const PAGE_SIZE = 1000;
const categories = Object.values(POST_CATEGORIES).filter(category => category !== POST_CATEGORIES.modelDiscussion);
const categorySql = categories.map(() => "?").join(",");
const visiblePosts = `p.audience = 'Công khai' AND p.category IN (${categorySql})`;
const genuineProfile = `mp.account_status = 'active' AND NOT EXISTS (SELECT 1 FROM virtual_profiles vp WHERE vp.id = mp.user_id) AND EXISTS (SELECT 1 FROM posts p WHERE p.user_id = mp.user_id AND ${visiblePosts})`;
export const xmlEscape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const urlEntry = (url: string, images: { key: string; title: string }[] = []) => `<url><loc>${xmlEscape(url)}</loc>${images.map(image => `<image:image><image:loc>${xmlEscape(SITE_ORIGIN + "/api/files?key=" + encodeURIComponent(image.key))}</image:loc></image:image>`).join("")}</url>`;
const reply = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...(status === 503 ? { "Retry-After": "60" } : {}) } });

export async function sitemapResponse(pathname: string) {
  // Generate from current public records on every read. A DB outage must not
  // publish an empty successful sitemap that looks like all URLs disappeared.
  try { return await generateSitemap(pathname); }
  catch {
    console.error("Sitemap generation unavailable");
    return reply("Sitemap temporarily unavailable", 503);
  }
}

async function generateSitemap(pathname: string) {
  if (!env.DB) return reply("Sitemap unavailable", 503);
  if (pathname === "/sitemap.xml") {
    const [postCount, profileCount] = await Promise.all([
      env.DB.prepare(`SELECT count(*) AS total FROM posts p WHERE ${visiblePosts}`).bind(...categories).first<{ total: number }>(),
      env.DB.prepare(`SELECT count(*) AS total FROM member_profiles mp WHERE ${genuineProfile}`).bind(...categories).first<{ total: number }>(),
    ]);
    const urls = ["/sitemaps/static.xml", ...["posts", "profiles"].flatMap((type, index) => Array.from({ length: Math.ceil((index === 0 ? postCount?.total ?? 0 : profileCount?.total ?? 0) / PAGE_SIZE) }, (_, index) => `/sitemaps/${type}-${index + 1}.xml`))];
    return reply(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<sitemap><loc>${SITE_ORIGIN}${url}</loc></sitemap>`).join("")}</sitemapindex>`);
  }
  let entries: string[];
  if (pathname === "/sitemaps/static.xml") entries = PUBLIC_SEO_PATHS.map(path => urlEntry(SITE_ORIGIN + path));
  else {
    const match = pathname.match(/^\/sitemaps\/(posts|profiles)-([1-9]\d*)\.xml$/);
    if (!match || Number(match[2]) > 1000000) return reply("Not found", 404);
    const offset = (Number(match[2]) - 1) * PAGE_SIZE;
    if (match[1] === "profiles") {
      const result = await env.DB.prepare(`SELECT mp.user_id FROM member_profiles mp WHERE ${genuineProfile} ORDER BY mp.user_id LIMIT ? OFFSET ?`).bind(...categories, PAGE_SIZE, offset).all<{ user_id: string }>();
      entries = result.results.map(profile => urlEntry(SITE_ORIGIN + "/nguoi-dung/" + encodeURIComponent(profile.user_id)));
    } else {
      const result = await env.DB.prepare(`SELECT p.id FROM posts p WHERE ${visiblePosts} ORDER BY p.id LIMIT ? OFFSET ?`).bind(...categories, PAGE_SIZE, offset).all<{ id: number }>();
      const ids = result.results.map(post => post.id);
      const images = ids.length ? await env.DB.prepare(`SELECT pa.post_id, pa.object_key FROM post_attachments pa JOIN (SELECT p.id FROM posts p WHERE ${visiblePosts} ORDER BY p.id LIMIT ? OFFSET ?) eligible ON eligible.id = pa.post_id WHERE pa.access_type = 'public' AND pa.mime_type IN ('image/webp','image/jpeg','image/png','image/gif') ORDER BY pa.id`).bind(...categories, PAGE_SIZE, offset).all<{ post_id: number; object_key: string }>() : { results: [] };
      const byPost = new Map<number, { key: string; title: string }[]>();
      for (const image of images.results) { const current = byPost.get(image.post_id) ?? []; current.push({ key: image.object_key, title: "" }); byPost.set(image.post_id, current); }
      entries = ids.map(id => urlEntry(SITE_ORIGIN + "/bai-viet/" + id, byPost.get(id)));
    }
    if (!entries.length) return reply("Not found", 404);
  }
  return reply(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries.join("")}</urlset>`);
}
