import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thống kê cốt thép | Tipook",
  description: "Lập bảng thống kê cốt thép, tính chiều dài và khối lượng theo quy trình DeltaTIP.",
};

export default function RebarTakeoffPage() {
  return (
    <main className="h-[calc(100dvh-68px)] min-h-[620px] overflow-hidden bg-[#080808]">
      <h1 className="sr-only">Thống kê và tính khối lượng cốt thép</h1>
      <iframe
        src="/tools/rebar/index.html?v=22.2.1"
        title="Công cụ thống kê cốt thép DeltaTIP Web"
        className="block size-full border-0"
        loading="eager"
        allow="clipboard-write"
      />
    </main>
  );
}
