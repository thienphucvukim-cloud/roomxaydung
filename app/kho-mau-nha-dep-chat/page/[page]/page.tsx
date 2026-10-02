import { notFound, redirect } from "next/navigation";
import { facadePageHref } from "@/lib/facade-pagination";
import { parseFacadeSort } from "@/lib/facade-feed";

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
};

export default async function FacadeNumberedPage({ params, searchParams }: PageProps) {
  const [{ page }, { q, sort }] = await Promise.all([params, searchParams]);
  if (!/^[1-9]\d*$/.test(page) || Number(page) > 1000000) notFound();
  redirect(facadePageHref(1, q?.trim().slice(0, 120) ?? "", parseFacadeSort(sort)));
}
