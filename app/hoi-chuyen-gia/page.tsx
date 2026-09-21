import type { Metadata } from "next";
import { SectionPage } from "@/components/section-page";

export const metadata: Metadata = {
  title: "Hỏi chuyên gia kiến trúc và xây dựng | ROOM XÂY DỰNG",
  description: "Gửi câu hỏi về thiết kế, kết cấu, dự toán và thi công để nhận hướng dẫn từ kiến trúc sư, kỹ sư xây dựng.",
};

export default function Page() { return <SectionPage section="experts"/>; }