import type { Metadata } from "next";
import "./globals.css";
import { ExploreHeader } from "@/components/explore-header";

export const metadata: Metadata = {
  title: "ROOM XÂY DỰNG — Cộng đồng tư vấn và thiết kế nhà",
  description: "Hỏi đáp, chia sẻ chi phí thực tế và kinh nghiệm từ những người đã và đang xây nhà.",
  icons: {
    icon: [{ url: "/roomxaydung-browser-icon-v2.png", type: "image/png" }],
    shortcut: "/roomxaydung-browser-icon-v2.png",
    apple: "/roomxaydung-browser-icon-v2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased"><ExploreHeader />{children}</body>
    </html>
  );
}