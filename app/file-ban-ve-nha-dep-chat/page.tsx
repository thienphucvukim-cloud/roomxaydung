import type { Metadata } from "next";
import { parseFileCatalogSort } from "@/lib/file-catalog-sort";
import { DrawingFilesPage } from "@/components/drawing-files-page";

export const metadata: Metadata = {
  title: "Kho bản vẽ kiến trúc & xây dựng | Tipook",
  description: "Thư viện file bản vẽ CAD, hồ sơ thiết kế và mẫu nhà do kiến trúc sư, kỹ sư đăng bán.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[]; sort?: string | string[]; postId?: string | string[] }> }) {
  const { q, postId, sort } = await searchParams;
  return <DrawingFilesPage sort={parseFileCatalogSort(sort)} query={typeof q === "string" ? q.trim().slice(0, 120) : ""} targetPostId={typeof postId === "string" ? postId : undefined} />;
}
