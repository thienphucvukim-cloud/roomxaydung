import { CATALOG_PAGE_SIZE, catalogPageHref } from "./catalog-pagination";

export const NEWS_SOURCES = [
  { category: "Bảng tin", label: "Bảng tin", path: "/" },
  { category: "Bộ sưu tập ảnh", label: "Mặt tiền", path: "/kho-mau-nha-dep-chat" },
  { category: "Bản vẽ cộng đồng", label: "Kho bản vẽ", path: "/file-ban-ve-nha-dep-chat" },
  { category: "Nội thất cộng đồng", label: "Nội thất", path: "/noi-that" },
] as const;

export const NEWS_PAGE_SIZE = 20;

export type NewsPost = {
  id: number;
  userId: string;
  authorName: string;
  avatarUrl?: string | null;
  category: string;
  title: string;
  content: string;
  location: string | null;
  feeling: string | null;
  pollQuestion: string | null;
  createdAt: string;
  sourceLabel: string;
  sourceHref: string;
  images: { url: string; name: string }[];
};

export type NewsFeedResponse = {
  posts: NewsPost[];
  total: number;
  page: number;
  totalPages: number;
};

export function newsSourceLink(category: string, postId: number, position: number) {
  const source = NEWS_SOURCES.find(item => item.category === category);
  if (!source) throw new Error("Unknown news source");
  return {
    sourceLabel: source.label,
    sourceHref: category === "Bảng tin" ? `/bai-viet/${postId}` : `${catalogPageHref(source.path, Math.ceil(position / CATALOG_PAGE_SIZE))}#post-${postId}`,
  };
}
