import { notFound } from "next/navigation";
import { NewsFeed } from "@/components/news-feed";
import { publicFeed } from "@/lib/seo-data";
import { postMetadata, postStructuredData } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const feed = await publicFeed(Number(id));
  if (feed && !feed.posts.length) notFound();
  return feed ? postMetadata(feed.posts[0]) : {};
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const feed = await publicFeed(Number(id));
  if (feed && !feed.posts.length) notFound();
  return <>{feed && <StructuredData value={postStructuredData(feed.posts[0])}/>}<NewsFeed postId={Number(id)} initialData={feed}/></>;
}
