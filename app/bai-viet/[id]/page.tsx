import { notFound } from "next/navigation";
import { NewsFeed } from "@/components/news-feed";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  return <NewsFeed postId={Number(id)} />;
}
