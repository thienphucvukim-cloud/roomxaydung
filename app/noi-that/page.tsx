import type { Metadata } from "next";
import { InteriorPage } from "@/components/interior-page";

export const metadata: Metadata = {
  title: "Nội thất — Kho hồ sơ thiết kế | Tipook",
  description: "Khám phá, đăng bán và mua hồ sơ thiết kế nội thất, bản vẽ CAD và file 3D từ cộng đồng kỹ sư, kiến trúc sư.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <InteriorPage query={typeof q === "string" ? q.trim().slice(0, 120) : ""} />;
}
