import { pageMetadata } from "@/lib/seo";
import { HouseModelsPage } from "@/components/house-models-page";
import { parseHouseModelSort } from "@/lib/house-model-feed";

export const metadata = pageMetadata("Mẫu nhà đẹp hiện đại, dễ xây | NhàĐẹpChất", "Tham khảo mẫu mặt tiền nhà phố, nhà vườn và nhà hiện đại theo kích thước đất.", "/kho-mau-nha-dep-chat");

export default async function BeautifulHouseModels({ searchParams }: { searchParams: Promise<{ q?: string | string[]; sort?: string | string[]; postId?: string | string[] }> }) {
  const { q, sort, postId } = await searchParams;
  return <HouseModelsPage query={typeof q === "string" ? q.trim().slice(0, 120) : ""} sort={parseHouseModelSort(sort)} targetPostId={typeof postId === "string" ? postId : undefined} />;
}
