import type { Metadata } from "next";
import { FacadePage } from "@/components/facade-page";

export const metadata: Metadata = {
  title: "Mặt tiền đẹp hiện đại, dễ xây | Tipook",
  description: "Tham khảo mẫu mặt tiền nhà phố, nhà vườn và nhà hiện đại theo kích thước đất.",
};

export default async function BeautifulHouseModels({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <FacadePage query={q?.trim().slice(0, 120) ?? ""} />;
}
