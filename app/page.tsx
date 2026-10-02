import type { Metadata } from "next";
import { NewsFeed } from "@/components/news-feed";

export const metadata: Metadata = {
  title: "Bảng tin cộng đồng | Tipook",
  description: "Cập nhật bài đăng mới về mặt tiền, bản vẽ và nội thất từ cộng đồng Tipook.",
};

export default function Home() {
  return <NewsFeed />;
}
