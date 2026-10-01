import type { Metadata } from "next";
import "./globals.css";
import { SiteChrome } from "@/components/site-chrome";
import { getSiteContent } from "@/lib/site-content";
import "./owner-editor.css";
import "./account-security.css";
export const dynamic = "force-dynamic";

const metadata: Metadata = {
  title: "Tipook — Cộng đồng tư vấn và thiết kế nhà",
  description: "Hỏi đáp, chia sẻ chi phí thực tế và kinh nghiệm từ những người đã và đang xây nhà.",
  icons: {
    icon: [{ url: "/tipook-browser-icon.png?v=2", type: "image/png" }],
    shortcut: "/tipook-browser-icon.png?v=2",
    apple: "/tipook-browser-icon.png?v=2",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const name = content["global.name"]?.value || "Tipook";
  return { ...metadata, title: `${name} — Cộng đồng tư vấn và thiết kế nhà` };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialContent = await getSiteContent();
  return (
    <html lang="vi">
      <head><meta charSet="utf-8" /></head>
      <body className="antialiased"><SiteChrome initialContent={initialContent}>{children}</SiteChrome></body>
    </html>
  );
}
