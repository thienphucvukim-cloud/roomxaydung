import type { Metadata } from "next";
import { DrawingFilesPage } from "@/components/drawing-files-page";

export const metadata: Metadata = {
  title: "Kho bản vẽ kiến trúc & xây dựng | Tipook",
  description: "Thư viện file bản vẽ CAD, hồ sơ thiết kế và mẫu nhà do kiến trúc sư, kỹ sư đăng bán.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <DrawingFilesPage query={typeof q === "string" ? q.trim().slice(0, 120) : ""} />;
}
