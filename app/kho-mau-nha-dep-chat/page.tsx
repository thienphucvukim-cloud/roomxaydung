import { pageMetadata, postMetadata } from "@/lib/seo";
import { publicCatalogPost } from "@/lib/seo-data";
import { POST_CATEGORIES } from "@/lib/legacy-contracts";
import { HouseModelsPage } from "@/components/house-models-page";
import { parseHouseModelSort } from "@/lib/house-model-feed";
import { permanentRedirect } from "next/navigation";
import { postHref } from "@/lib/post-url";

type Search = { q?: string | string[]; sort?: string | string[]; postId?: string | string[] };
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }) {
  const post = await publicCatalogPost((await searchParams).postId, [POST_CATEGORIES.houseModels, POST_CATEGORIES.drawings]);
  return post ? postMetadata(post) : pageMetadata("Mẫu nhà đẹp hiện đại, dễ xây | NhàĐẹpChất", "Tham khảo mẫu mặt tiền nhà phố, nhà vườn và nhà hiện đại theo kích thước đất.", "/kho-mau-nha-dep-chat");
}

export default async function BeautifulHouseModels({ searchParams }: { searchParams: Promise<Search> }) {
  const { q, sort, postId } = await searchParams;
  const post = await publicCatalogPost(postId, [POST_CATEGORIES.houseModels, POST_CATEGORIES.drawings]);
  if (post) permanentRedirect(postHref(post));
  return <HouseModelsPage query={typeof q === "string" ? q.trim().slice(0, 120) : ""} sort={parseHouseModelSort(sort)} targetPostId={typeof postId === "string" ? postId : undefined} />;
}
