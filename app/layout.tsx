import type { Metadata } from "next";
import "./globals.css";
import { ExploreHeader } from "@/components/explore-header";
import { SocialDock } from "@/components/social-dock";

export const metadata: Metadata = {
  title: "Tipook — Cộng đồng tư vấn và thiết kế nhà",
  description: "Hỏi đáp, chia sẻ chi phí thực tế và kinh nghiệm từ những người đã và đang xây nhà.",
  icons: {
    icon: [{ url: "/tipook-browser-icon.png?v=2", type: "image/png" }],
    shortcut: "/tipook-browser-icon.png?v=2",
    apple: "/tipook-browser-icon.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head><meta charSet="utf-8" /></head>
      <body className="antialiased"><ExploreHeader />{children}<SocialDock /></body>
    </html>
  );
}
