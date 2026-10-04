import type { Metadata } from "next";
import "./globals.css";
import { SiteChrome } from "@/components/site-chrome";
import { getSiteContent } from "@/lib/site-content";
import "./owner-editor.css";
import "./account-security.css";
import { SITE_ORIGIN, SITE_IMAGE, SITE_IMAGE_ALT } from "@/lib/seo";

const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "NhàĐẹpChất — Cộng đồng tư vấn và thiết kế nhà",
  description: "Hỏi đáp, chia sẻ chi phí thực tế và kinh nghiệm từ những người đã và đang xây nhà.",
  openGraph: { siteName: "NhàĐẹpChất", locale: "vi_VN", type: "website", images: [{ url: SITE_IMAGE, width: 1122, height: 1402, alt: SITE_IMAGE_ALT }] },
  twitter: { card: "summary_large_image", images: [SITE_IMAGE] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
};

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const name = content["global.name"]?.value || "NhàĐẹpChất";
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
      <head>
        <meta charSet="utf-8" />
        {/* Keep crawler discovery independent of streamed async metadata. */}
        <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192"/>
        <link rel="shortcut icon" href="/favicon.ico"/>
        <link rel="apple-touch-icon" href="/favicon.png"/>
      </head>
      <body className="antialiased"><SiteChrome initialContent={initialContent}>{children}</SiteChrome></body>
    </html>
  );
}
