import { pageMetadata, seoCatalogPage } from "@/lib/seo";
import { parseFileCatalogSort } from "@/lib/file-catalog-sort";
import { DrawingFilesPage } from "@/components/drawing-files-page";

type Search = { q?: string | string[]; sort?: string | string[]; postId?: string | string[]; page?: string | string[] };
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }) {
  const page = seoCatalogPage((await searchParams).page);
  return pageMetadata("Kho bản vẽ kiến trúc & xây dựng | NhàĐẹpChất", "Thư viện file bản vẽ CAD, hồ sơ thiết kế và mẫu nhà do kiến trúc sư, kỹ sư đăng bán.", "/file-ban-ve-nha-dep-chat" + (page > 1 ? `?page=${page}` : ""));
}

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { q, postId, sort, page } = await searchParams;
  return <DrawingFilesPage page={seoCatalogPage(page)} sort={parseFileCatalogSort(sort)} query={typeof q === "string" ? q.trim().slice(0, 120) : ""} targetPostId={typeof postId === "string" ? postId : undefined} />;
}
