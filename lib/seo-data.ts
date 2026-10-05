import { env } from "cloudflare:workers";
import { cache } from "react";
import { GET as readNewsFeed } from "@/app/api/news-feed/route";
import { GET as readProfile } from "@/app/api/public-profile/[id]/route";
import { GET as readCatalog } from "@/app/api/posts/route";
import type { NewsFeedResponse } from "./news-feed";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { posts, virtualProfiles } from "@/db/schema";
import { SITE_ORIGIN } from "./seo";
import { notFound } from "next/navigation";
import type { PublicProfileData } from "./public-profile-data";

// These readers use the same public visibility/file rules as the existing APIs.
// No fetch back to production and no session-dependent data enters shared HTML.
export const publicFeed = cache(async (postId?: number): Promise<NewsFeedResponse | undefined> => {
  if (!env.DB) return undefined; // secret-free UI shell generation only
  const response = await readNewsFeed(new Request(SITE_ORIGIN + "/api/news-feed" + (postId ? "?postId=" + postId : "")));
  if (!response.ok) throw new Error("Public feed unavailable");
  return response.json();
});
export const publicSlugFeed = cache(async (slug: string) => {
  if (!env.DB) return undefined;
  const [post] = await getDb().select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
  if (!post) notFound();
  const feed = await publicFeed(post.id);
  if (!feed?.posts.length) notFound();
  return feed;
});
// Legacy catalog share links must expose the same public post as its detail URL.
export async function publicCatalogPost(postId: string | string[] | undefined, category: string | string[]) {
  if (postId === undefined) return undefined;
  if (typeof postId !== "string" || !/^[1-9]\d*$/.test(postId) || !Number.isSafeInteger(Number(postId))) notFound();
  const feed = await publicFeed(Number(postId));
  if (!feed) return undefined; // secret-free shell generation
  const post = feed.posts[0];
  if (!post || !(Array.isArray(category) ? category.includes(post.category) : post.category === category)) notFound();
  return post;
}
export const publicProfile = cache(async (id: string): Promise<{ profile: PublicProfileData; indexable: boolean } | null | undefined> => {
  if (!env.DB) return undefined;
  const response = await readProfile(new Request(SITE_ORIGIN + "/api/public-profile/" + encodeURIComponent(id)), { params: Promise.resolve({ id }) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public profile unavailable");
  const profile = await response.json() as PublicProfileData;
  profile.own = false;
  const [virtual] = await getDb().select({ id: virtualProfiles.id }).from(virtualProfiles).where(eq(virtualProfiles.id, id)).limit(1);
  return { profile, indexable: !virtual && profile.authoredPosts.length > 0 };
});
export async function publicCatalog<T extends { posts: unknown[] }>(params: URLSearchParams): Promise<T | undefined> {
  if (!env.DB) return undefined;
  const response = await readCatalog(new Request(SITE_ORIGIN + "/api/posts?" + params));
  if (!response.ok) throw new Error("Public catalog unavailable");
  return response.json() as Promise<T>;
}
