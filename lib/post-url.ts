export const RESERVED_POST_SLUGS = new Set([
  "api", "admin", "bai-viet", "nguoi-dung", "thue-thiet-ke", "dang-nhap", "dang-ky", "quen-mat-khau", "tai-khoan", "nhat-ky-xay-nha", "cam-nang", "mat-bang-cong-nang", "hoi-chuyen-gia", "tinh-vat-tu-nha-dep-chat", "gioi-thieu", "privacy", "tim-kiem", "kho-mau-nha-dep-chat", "file-ban-ve-nha-dep-chat", "noi-that", "bang-tin", "kho-mau-nha-dep-tipook", "file-ban-ve-nha-dep-tipook", "tinh-vat-tu-tipook", "nha-thau-thi-cong", "viec-lam", "quan-tri", "callback", "signout-with-chatgpt", "signin-with-chatgpt", "sitemaps", "bai-viet-shell",
]);
export function titleSlug(title: string) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160).replace(/-+$/g, "") || "bai-viet";
}
export function isPostSlug(slug: string) {
  return slug.length <= 180 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED_POST_SLUGS.has(slug);
}
export function postHref(post: { id: number; slug?: string | null }) {
  return post.slug && isPostSlug(post.slug) ? `/${post.slug}` : `/bai-viet/${post.id}`;
}
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;
export function postShareImage(post: { id: number; images: { url: string }[] }) {
  const image = post.images[0];
  if (!image) return undefined;
  const key = new URL(image.url, "https://nhadepchat.top").searchParams.get("key");
  return key && /^[0-9a-f-]{36}$/i.test(key) ? `/api/share-image/${post.id}.jpg?v=${key}` : image.url;
}
