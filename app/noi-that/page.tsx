import { pageMetadata, postMetadata, seoCatalogPage } from "@/lib/seo";
import { publicCatalogPost } from "@/lib/seo-data";
import { POST_CATEGORIES } from "@/lib/legacy-contracts";
import { parseFileCatalogSort } from "@/lib/file-catalog-sort";
import { InteriorPage } from "@/components/interior-page";

type Search = { q?: string | string[]; sort?: string | string[]; postId?: string | string[]; page?: string | string[] };
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const post = await publicCatalogPost(search.postId, POST_CATEGORIES.interiors);
  if (post) return postMetadata(post);
  const page = seoCatalogPage(search.page);
  return pageMetadata("Nội thất — Kho hồ sơ thiết kế | NhàĐẹpChất", "Khám phá, đăng bán và mua hồ sơ thiết kế nội thất, bản vẽ CAD và file 3D từ cộng đồng kỹ sư, kiến trúc sư.", "/noi-that" + (page > 1 ? `?page=${page}` : ""));
}

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { q, postId, sort, page } = await searchParams;
  await publicCatalogPost(postId, POST_CATEGORIES.interiors);
  return <InteriorPage page={seoCatalogPage(page)} sort={parseFileCatalogSort(sort)} query={typeof q === "string" ? q.trim().slice(0, 120) : ""} targetPostId={typeof postId === "string" ? postId : undefined} />;
}
