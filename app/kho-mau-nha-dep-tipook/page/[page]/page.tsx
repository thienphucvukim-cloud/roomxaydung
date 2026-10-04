import { notFound, permanentRedirect } from "next/navigation";
import { houseModelHref } from "@/lib/house-model-links";

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function LegacyHouseModelsNumberedPage({ params, searchParams }: PageProps) {
  const [{ page }, { q }] = await Promise.all([params, searchParams]);
  if (!/^[1-9]\d*$/.test(page) || Number(page) > 1000000) notFound();
  permanentRedirect(houseModelHref(q?.trim().slice(0, 120) ?? ""));
}
