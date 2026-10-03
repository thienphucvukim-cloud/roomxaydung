import type { Metadata } from "next";
import { FacadePage } from "@/components/facade-page";
import { parseFacadeSort } from "@/lib/facade-feed";

export const metadata: Metadata = {
  title: "Mặt tiền đẹp hiện đại, dễ xây | NhàĐẹpChất",
  description: "Tham khảo mẫu mặt tiền nhà phố, nhà vườn và nhà hiện đại theo kích thước đất.",
};

export default async function BeautifulHouseModels({ searchParams }: { searchParams: Promise<{ q?: string | string[]; sort?: string | string[]; postId?: string | string[] }> }) {
  const { q, sort, postId } = await searchParams;
  return <FacadePage query={typeof q === "string" ? q.trim().slice(0, 120) : ""} sort={parseFacadeSort(sort)} targetPostId={typeof postId === "string" ? postId : undefined} />;
}
