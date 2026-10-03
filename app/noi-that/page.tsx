import type { Metadata } from "next";
import { parseFileCatalogSort } from "@/lib/file-catalog-sort";
import { InteriorPage } from "@/components/interior-page";

export const metadata: Metadata = {
  title: "Nội thất — Kho hồ sơ thiết kế | NhàĐẹpChất",
  description: "Khám phá, đăng bán và mua hồ sơ thiết kế nội thất, bản vẽ CAD và file 3D từ cộng đồng kỹ sư, kiến trúc sư.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[]; sort?: string | string[]; postId?: string | string[] }> }) {
  const { q, postId, sort } = await searchParams;
  return <InteriorPage sort={parseFileCatalogSort(sort)} query={typeof q === "string" ? q.trim().slice(0, 120) : ""} targetPostId={typeof postId === "string" ? postId : undefined} />;
}
