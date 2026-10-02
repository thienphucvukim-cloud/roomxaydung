import { notFound, permanentRedirect } from "next/navigation";
import { facadePageHref } from "@/lib/facade-pagination";

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function FacadeNumberedPage({ params, searchParams }: PageProps) {
  const [{ page }, { q }] = await Promise.all([params, searchParams]);
  if (!/^[1-9]\d*$/.test(page) || Number(page) > 1000000) notFound();
  permanentRedirect(facadePageHref(1, q?.trim().slice(0, 120) ?? ""));
}
