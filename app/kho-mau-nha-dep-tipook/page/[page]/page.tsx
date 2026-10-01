import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FacadePage } from "@/components/facade-page";

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  return { title: `Mặt tiền đẹp — Trang ${page} | Tipook` };
}

export default async function FacadeNumberedPage({ params, searchParams }: PageProps) {
  const [{ page }, { q }] = await Promise.all([params, searchParams]);
  if (!/^[1-9]\d*$/.test(page) || Number(page) > 1000000) notFound();
  return <FacadePage page={Number(page)} query={q?.trim().slice(0, 120) ?? ""} />;
}
