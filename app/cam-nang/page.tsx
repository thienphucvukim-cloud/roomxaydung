import type { Metadata } from "next";
import { SectionPage } from "@/components/section-page";

export const metadata: Metadata = {
  title: "Cẩm nang xây nhà từ chuẩn bị đến bàn giao | Tipook",
  description: "Hướng dẫn lập ngân sách, chọn nhà thầu, quản lý thi công và nghiệm thu nhà ở theo từng giai đoạn.",
};

export default function GuidePage() { return <SectionPage section="guides"/>; }