import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InteriorPage } from "@/components/interior-page";

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  return { title: `Nội thất — Trang ${page} | Tipook` };
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ page }, { q }] = await Promise.all([params, searchParams]);
  if (!/^[1-9]\d*$/.test(page) || Number(page) > 1000000) notFound();
  return <InteriorPage page={Number(page)} query={typeof q === "string" ? q.trim().slice(0, 120) : ""} />;
}
