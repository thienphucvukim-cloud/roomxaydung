import { notFound } from "next/navigation";
import { NewsFeed } from "@/components/news-feed";
import { StructuredData } from "@/components/structured-data";
import { publicSlugFeed } from "@/lib/seo-data";
import { postMetadata, postStructuredData } from "@/lib/seo";
import { isPostSlug } from "@/lib/post-url";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isPostSlug(slug)) notFound();
  const feed = await publicSlugFeed(slug);
  return feed ? postMetadata(feed.posts[0]) : {};
}
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isPostSlug(slug)) notFound();
  const feed = await publicSlugFeed(slug);
  return <>{feed && <StructuredData value={postStructuredData(feed.posts[0])}/>}<NewsFeed postSlug={slug} postId={feed?.posts[0].id} initialData={feed}/></>;
}
