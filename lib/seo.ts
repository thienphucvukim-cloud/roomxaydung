import type { Metadata } from "next";
import type { NewsPost } from "./news-feed";

export const SITE_ORIGIN = "https://nhadepchat.top";
export const SITE_NAME = "NhàĐẹpChất";
export const SITE_IMAGE = "/nha-dep-chat-kien-truc.webp";
export const SITE_IMAGE_ALT = "Công trình kiến trúc hiện đại với đường cong và mặt kính — NhàĐẹpChất";
export const DEFAULT_DESCRIPTION = "Chia sẻ mẫu nhà, bản vẽ, nội thất và kinh nghiệm xây nhà từ cộng đồng NhàĐẹpChất.";
export const PUBLIC_SEO_PATHS = ["/", "/kho-mau-nha-dep-chat", "/file-ban-ve-nha-dep-chat", "/noi-that", "/thue-thiet-ke", "/cam-nang", "/nhat-ky-xay-nha", "/mat-bang-cong-nang", "/hoi-chuyen-gia", "/tinh-vat-tu-nha-dep-chat", "/gioi-thieu", "/privacy"] as const;

export function isPublicSeoPage(pathname: string) {
  return PUBLIC_SEO_PATHS.some(path => path === pathname) || /^\/bai-viet\/[1-9]\d*$/.test(pathname) || /^\/nguoi-dung\/[A-Za-z0-9_-]{1,180}$/.test(pathname);
}
export function isSitemapPath(path: string) { return path === "/sitemap.xml" || path.startsWith("/sitemaps/"); }
export function seoText(value: string, limit = 160) { return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit); }
export function seoCatalogPage(value?: string | string[]) { return typeof value === "string" && /^[1-9]\d*$/.test(value) && Number(value) <= 1000000 ? Number(value) : 1; }
export function canonicalUrl(pathname: string) {
  const url = new URL(pathname, SITE_ORIGIN);
  if (url.origin !== SITE_ORIGIN || url.username || url.password) throw new Error("Invalid canonical URL");
  const page = url.searchParams.get("page");
  url.hash = ""; url.search = "";
  if (["/file-ban-ve-nha-dep-chat", "/noi-that"].includes(url.pathname) && page && /^[1-9]\d*$/.test(page) && Number(page) > 1 && Number(page) <= 1000000) url.searchParams.set("page", page);
  return url.href;
}
export function pageMetadata(title: string, description: string, path: string, images: string[] = []): Metadata {
  const canonical = canonicalUrl(path), fullTitle = seoText(title, 100).includes(SITE_NAME) ? seoText(title, 120) : `${seoText(title, 100)} | ${SITE_NAME}`;
  const summary = seoText(description) || DEFAULT_DESCRIPTION;
  const publicImages = (images.length ? images : [SITE_IMAGE]).map(image => new URL(image, SITE_ORIGIN).href);
  return { title: fullTitle, description: summary, alternates: { canonical },
    openGraph: { title: fullTitle, description: summary, url: canonical, siteName: SITE_NAME, locale: "vi_VN", type: "website", images: publicImages },
    twitter: { card: publicImages.length ? "summary_large_image" : "summary", title: fullTitle, description: summary, images: publicImages },
  };
}
export function sitePageStructuredData(path: "/" | "/gioi-thieu") {
  const url = canonicalUrl(path), image = SITE_ORIGIN + SITE_IMAGE;
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "WebSite", "@id": SITE_ORIGIN + "/#website", url: SITE_ORIGIN + "/", name: SITE_NAME, alternateName: "Nhà Đẹp Chất", description: DEFAULT_DESCRIPTION, inLanguage: "vi-VN" },
    { "@type": path === "/gioi-thieu" ? "AboutPage" : "WebPage", "@id": url + "#webpage", url, name: path === "/gioi-thieu" ? "Giới thiệu NhàĐẹpChất" : "Bảng tin cộng đồng NhàĐẹpChất", isPartOf: { "@id": SITE_ORIGIN + "/#website" }, inLanguage: "vi-VN", primaryImageOfPage: { "@type": "ImageObject", url: image, contentUrl: image, width: 1122, height: 1402, caption: SITE_IMAGE_ALT } },
  ] };
}
export function postMetadata(post: NewsPost): Metadata {
  const description = [post.content, post.specifications, post.listingType, post.priceLabel, post.sourceLabel].filter(Boolean).join(" · ");
  return { ...pageMetadata(post.title, description, `/bai-viet/${post.id}`, post.images.slice(0, 4).map(image => image.url)),
    openGraph: { title: `${post.title} | ${SITE_NAME}`, description: seoText(description), url: canonicalUrl(`/bai-viet/${post.id}`), type: "article", locale: "vi_VN", siteName: SITE_NAME,
      publishedTime: post.createdAt, authors: [canonicalUrl(`/nguoi-dung/${encodeURIComponent(post.userId)}`)], images: post.images.slice(0, 4).map(image => ({ url: new URL(image.url, SITE_ORIGIN).href, alt: post.title })) },
  };
}
export function postStructuredData(post: NewsPost) {
  return { "@context": "https://schema.org", "@type": "SocialMediaPosting", "@id": canonicalUrl(`/bai-viet/${post.id}`) + "#posting",
    url: canonicalUrl(`/bai-viet/${post.id}`), mainEntityOfPage: canonicalUrl(`/bai-viet/${post.id}`), headline: post.title,
    ...(post.content ? { text: post.content } : {}), datePublished: post.createdAt,
    author: { "@type": "Person", name: post.authorName, url: canonicalUrl(`/nguoi-dung/${encodeURIComponent(post.userId)}`) },
    ...(post.images.length ? { image: post.images.map(image => new URL(image.url, SITE_ORIGIN).href) } : {}),
    commentCount: post.comments,
  };
}
export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
