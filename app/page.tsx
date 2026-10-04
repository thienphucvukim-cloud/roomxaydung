import type { Metadata } from "next";
import { NewsFeed } from "@/components/news-feed";
import { publicFeed } from "@/lib/seo-data";
import { pageMetadata, sitePageStructuredData } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";

export const metadata: Metadata = pageMetadata("Bảng tin cộng đồng", "Cập nhật bài đăng mới về mẫu nhà, bản vẽ và nội thất từ cộng đồng NhàĐẹpChất.", "/");

export default async function Home() {
  return <><StructuredData value={sitePageStructuredData("/")}/><NewsFeed initialData={await publicFeed()} /></>;
}
