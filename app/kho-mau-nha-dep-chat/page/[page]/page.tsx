import { notFound, redirect } from "next/navigation";
import { houseModelHref } from "@/lib/house-model-links";
import { parseHouseModelSort } from "@/lib/house-model-feed";

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
};

export default async function HouseModelsNumberedPage({ params, searchParams }: PageProps) {
  const [{ page }, { q, sort }] = await Promise.all([params, searchParams]);
  if (!/^[1-9]\d*$/.test(page) || Number(page) > 1000000) notFound();
  redirect(houseModelHref(q?.trim().slice(0, 120) ?? "", parseHouseModelSort(sort)));
}
