import { pageMetadata, postMetadata, seoCatalogPage } from "@/lib/seo";
import { publicCatalogPost } from "@/lib/seo-data";
import { POST_CATEGORIES } from "@/lib/legacy-contracts";
import { parseFileCatalogSort } from "@/lib/file-catalog-sort";
import { DrawingFilesPage } from "@/components/drawing-files-page";

type Search = { q?: string | string[]; sort?: string | string[]; postId?: string | string[]; page?: string | string[] };
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const post = await publicCatalogPost(search.postId, POST_CATEGORIES.drawings);
  if (post) return postMetadata(post);
  const page = seoCatalogPage(search.page);
  return pageMetadata("Kho bản vẽ kiến trúc & xây dựng | NhàĐẹpChất", "Thư viện file bản vẽ CAD, hồ sơ thiết kế và mẫu nhà do kiến trúc sư, kỹ sư đăng bán.", "/file-ban-ve-nha-dep-chat" + (page > 1 ? `?page=${page}` : ""));
}

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { q, postId, sort, page } = await searchParams;
  await publicCatalogPost(postId, POST_CATEGORIES.drawings);
  return <DrawingFilesPage page={seoCatalogPage(page)} sort={parseFileCatalogSort(sort)} query={typeof q === "string" ? q.trim().slice(0, 120) : ""} targetPostId={typeof postId === "string" ? postId : undefined} />;
}
