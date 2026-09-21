import type { Metadata } from "next";
import { SectionPage } from "@/components/section-page";

export const metadata: Metadata = {
  title: "Nhật ký xây nhà thực tế | ROOM XÂY DỰNG",
  description: "Theo dõi tiến độ, chi phí, vật liệu và kinh nghiệm thực tế từ các công trình nhà ở.",
};

export default function DiaryPage() { return <SectionPage section="diary"/>; }