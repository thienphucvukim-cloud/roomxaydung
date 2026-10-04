import { env } from "cloudflare:workers";
import { cache } from "react";
import { GET as readNewsFeed } from "@/app/api/news-feed/route";
import { GET as readProfile } from "@/app/api/public-profile/[id]/route";
import { GET as readCatalog } from "@/app/api/posts/route";
import type { NewsFeedResponse } from "./news-feed";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { virtualProfiles } from "@/db/schema";
import { SITE_ORIGIN } from "./seo";
import type { PublicProfileData } from "./public-profile-data";

// These readers use the same public visibility/file rules as the existing APIs.
// No fetch back to production and no session-dependent data enters shared HTML.
export const publicFeed = cache(async (postId?: number): Promise<NewsFeedResponse | undefined> => {
  if (!env.DB) return undefined; // secret-free UI shell generation only
  const response = await readNewsFeed(new Request(SITE_ORIGIN + "/api/news-feed" + (postId ? "?postId=" + postId : "")));
  if (!response.ok) throw new Error("Public feed unavailable");
  return response.json();
});
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
