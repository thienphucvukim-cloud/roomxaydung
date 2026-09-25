import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, Eye, FileText, Star } from "lucide-react";
import { EditorialContent } from "@/components/editorial-content";
import { ProjectGallery } from "@/components/project-gallery";
import { DrawingCommunity } from "@/components/drawing-community";
import { RequestActionButton, ToggleActionButton } from "@/components/interactive-actions";
import { PurchaseActionButton } from "@/components/purchase-action-button";
import { drawings } from "@/lib/drawing-catalog";

export const metadata: Metadata = {
  title: "Kho bản vẽ kiến trúc & xây dựng | Tipook",
  description: "Thư viện file bản vẽ CAD, hồ sơ thiết kế và mẫu nhà do kiến trúc sư, kỹ sư đăng bán.",
};


export default function DrawingFilesPage() {
  return <main className="mx-auto max-w-[1320px] px-4 py-5 lg:px-8">
    <DrawingCommunity />
    <section className="mt-8">
      <p className="text-sm font-extrabold uppercase tracking-[.13em] text-[#229ed9]">Thư viện bản vẽ</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] text-[#0b2e59] sm:text-4xl">Kho bản vẽ từ kỹ sư và kiến trúc sư</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-[#3f5064]">Khám phá, mua và tải file CAD, hồ sơ thiết kế, SketchUp cùng các tài liệu phục vụ thi công.</p>
    </section>
    <section className="mt-7 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{drawings.map((drawing) => <article key={drawing.title} data-drawing-search={`${drawing.title} ${drawing.category} ${drawing.price}`} className="group min-w-0"><div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#f7f9fc]"><img src={drawing.image} alt={drawing.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/><ToggleActionButton actionType="save" targetType="drawing" targetId={drawing.title} label="Lưu bản vẽ" activeLabel="Đã lưu" icon="heart" className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full bg-white/90 text-[#3f5064] opacity-0 shadow-sm transition group-hover:opacity-100 [&>span]:sr-only"/><ProjectGallery model={{ title: drawing.title, meta: `${drawing.price} · ${drawing.downloads} lượt tải`, style: drawing.category, image: drawing.image }} trigger="overlay"/></div><div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#3f5064]"><span className="truncate text-[#147aa8]">{drawing.category}</span><span className="flex shrink-0 items-center gap-2"><span className="flex items-center gap-1"><Eye size={14}/>{drawing.views}</span><span className="flex items-center gap-1"><ArrowDownToLine size={14}/>{drawing.downloads}</span><span className="flex items-center gap-0.5 text-[#d99016]"><Star size={14} className="fill-current"/>{drawing.rating}</span></span></div><h2 className="mt-2 line-clamp-2 min-h-12 text-[15px] font-bold leading-6 text-[#1d3429]">{drawing.title}</h2><p className="mt-1 text-sm text-[#66778a]">Đăng bởi <Link href={`/nguoi-dung/${drawing.authorId}`} className="font-semibold text-[#0b2e59] hover:text-[#229ed9] hover:underline">{drawing.authorName}</Link></p><div className="mt-3 flex items-center justify-between"><strong className="text-base text-[#229ed9]">{drawing.price}</strong><span className="flex shrink-0 items-center gap-1.5"><RequestActionButton requestType="drawing-file-request" targetType="drawing" targetId={drawing.title} label="Yêu cầu file" title={"Yêu cầu file: " + drawing.title} description="Người đăng sẽ nhận yêu cầu và liên hệ để cung cấp thông tin về phạm vi, định dạng và phiên bản của file." recipientUserId={drawing.authorId} iconOnly="file" className="grid size-9 place-items-center rounded-full border border-[#cfeaf5] bg-[#f1faff] text-[#168ac0] transition hover:border-[#229ed9] hover:bg-[#e2f5fc]"/><PurchaseActionButton targetType="drawing" targetId={drawing.title} title={drawing.title} price={drawing.price} className="grid size-9 place-items-center rounded-full bg-[#229ed9] text-white transition hover:bg-[#168ac0]"/></span></div></article>)}</section>
        <EditorialContent
      eyebrow="KIỂM TRA HỒ SƠ TRƯỚC KHI TẢI"
      title="Một bộ bản vẽ dùng được cần có những thành phần nào?"
      intro="Ảnh phối cảnh đẹp chưa đủ để thi công. Trước khi mua hoặc sử dụng một bộ hồ sơ tham khảo, bạn cần kiểm tra phạm vi file, mức độ chi tiết, phiên bản phần mềm và quyền sử dụng."
      sections={[
        { title: "Kiến trúc, kết cấu và hệ thống kỹ thuật", paragraphs: ["Hồ sơ thi công đầy đủ thường gồm mặt bằng, mặt đứng, mặt cắt, chi tiết cửa và hoàn thiện; bản vẽ móng, cột, dầm, sàn; cùng hệ thống điện, cấp thoát nước. Nếu chỉ có kiến trúc, kỹ sư vẫn phải triển khai lại các phần còn thiếu."], bullets: ["Mặt bằng và kích thước", "Chi tiết cấu tạo", "Kết cấu chịu lực", "Điện và cấp thoát nước"] },
        { title: "Đối chiếu với khu đất thực tế", paragraphs: ["Không dùng nguyên bản vẽ mẫu để xin phép hoặc thi công khi chưa kiểm tra kích thước đất, địa chất, hướng tiếp cận và quy định địa phương. Kết cấu móng đặc biệt cần được tính toán theo khảo sát hiện trường."] },
        { title: "Kiểm tra định dạng và quyền sử dụng", paragraphs: ["Xác nhận file có thể mở bằng phiên bản phần mềm bạn đang dùng, font và thư viện đi kèm có đầy đủ hay không. Đọc kỹ quyền chỉnh sửa, số lần sử dụng và điều kiện chia sẻ lại để tránh vi phạm bản quyền."] }
      ]}
      checklist={["Xem danh mục bản vẽ trước khi mua", "Kiểm tra phiên bản CAD hoặc SketchUp", "Không thi công khi chưa có kỹ sư rà soát", "Lưu hóa đơn và giấy phép sử dụng"]}
    />
        <section className="mt-10 grid gap-5 rounded-[24px] border border-[#e3eaf2] bg-white p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-8"><span className="grid size-12 place-items-center rounded-full bg-[#eef9fd] text-[#229ed9]"><FileText size={24}/></span><div><h2 className="text-xl font-extrabold">Bạn là kỹ sư hoặc kiến trúc sư?</h2><p className="mt-1 text-[#3f5064]">Đăng file bản vẽ, thiết lập giá bán và tiếp cận cộng đồng đang chuẩn bị xây nhà.</p></div><RequestActionButton requestType="drawing-listing" targetType="drawing-market" targetId="new-drawing-footer" label="Bắt đầu đăng bán" title="Đăng bán bản vẽ" description="Gửi thông tin chuyên môn, mô tả hồ sơ và tệp mẫu để kiểm duyệt trước khi xuất bản." allowFile className="flex items-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold text-white"/></section>
  </main>;
}