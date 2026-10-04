import type { Metadata } from "next";
import { HouseModelsPage } from "@/components/house-models-page";
import { parseHouseModelSort } from "@/lib/house-model-feed";

export const metadata: Metadata = {
  title: "Mẫu nhà đẹp hiện đại, dễ xây | NhàĐẹpChất",
  description: "Tham khảo mẫu mặt tiền nhà phố, nhà vườn và nhà hiện đại theo kích thước đất.",
};

export default async function BeautifulHouseModels({ searchParams }: { searchParams: Promise<{ q?: string | string[]; sort?: string | string[]; postId?: string | string[] }> }) {
  const { q, sort, postId } = await searchParams;
  return <HouseModelsPage query={typeof q === "string" ? q.trim().slice(0, 120) : ""} sort={parseHouseModelSort(sort)} targetPostId={typeof postId === "string" ? postId : undefined} />;
}
