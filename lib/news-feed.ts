import { SITE_SECTIONS } from "./site-sections.ts";
import { POST_CATEGORIES } from "./legacy-contracts.ts";
export const NEWS_SOURCES = [
  { category: POST_CATEGORIES.news, ...SITE_SECTIONS.news },
  { category: POST_CATEGORIES.houseModels, ...SITE_SECTIONS.houseModels },
  { category: POST_CATEGORIES.drawings, ...SITE_SECTIONS.drawings },
  { category: POST_CATEGORIES.interiors, ...SITE_SECTIONS.interiors },
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
  specifications: string | null;
  listingType: string | null;
  priceLabel: string | null;
  createdAt: string;
  comments: number;
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

export function newsSourceLink(category: string, postId: number) {
  const source = NEWS_SOURCES.find(item => item.category === category);
  if (!source) throw new Error("Unknown news source");
  return {
    sourceLabel: source.label,
    sourceHref: category === POST_CATEGORIES.news ? `/bai-viet/${postId}` : `${source.path}?postId=${postId}#post-${postId}`,
  };
}
