import type { Metadata } from "next";
import { ArrowDownToLine, Eye, FileText, Heart, ShieldCheck, Star, Upload } from "lucide-react";
import { EditorialContent } from "@/components/editorial-content";
import { FilterChips, RequestActionButton, ToggleActionButton } from "@/components/interactive-actions";

export const metadata: Metadata = {
  title: "Kho bản vẽ kiến trúc & xây dựng | ROOM XÂY DỰNG",
  description: "Thư viện file bản vẽ CAD, hồ sơ thiết kế và mẫu nhà do kiến trúc sư, kỹ sư đăng bán.",
};

const drawings = [
  { category: "BẢN VẼ NHÀ PHỐ 1 TẦNG", title: "Nhà cấp 4 mái Thái 1 tầng 11 × 13m, diện tích 130m²", price: "150.000đ", views: 17, downloads: 8, rating: "4.9", image: "/mau-nha-pho-xanh.png" },
  { category: "FILE CAD VĂN PHÒNG", title: "File CAD thiết kế văn phòng 300m² đầy đủ hạng mục", price: "150.000đ", views: 31, downloads: 14, rating: "4.8", image: "/mat-bang-5x20.png" },
  { category: "BẢN VẼ NHÀ PHỐ 3 TẦNG", title: "Nhà phố 2 tầng + 1 tum, kích thước 7 × 16m", price: "95.000đ", views: 24, downloads: 11, rating: "4.7", image: "/community-house.png" },
  { category: "BẢN VẼ NHÀ PHỐ 3 TẦNG", title: "Bản vẽ nhà phố 3 tầng phong cách hiện đại 5 × 12m", price: "80.000đ", views: 22, downloads: 9, rating: "4.8", image: "/mau-nha-pho-xanh.png" },
  { category: "BẢN VẼ CÔNG TRÌNH XÃ HỘI", title: "Khối trường mầm non 58 × 36m, quy mô 20 lớp học", price: "150.000đ", views: 26, downloads: 12, rating: "4.9", image: "/community-house.png" },
  { category: "BẢN VẼ BIỆT THỰ 1 TẦNG", title: "Full bản vẽ nhà vườn cấp 4 bằng CAD, SketchUp", price: "70.000đ", views: 32, downloads: 16, rating: "4.8", image: "/mau-nha-pho-xanh.png" },
  { category: "BẢN VẼ NHÀ PHỐ 2 TẦNG", title: "Nhà phố 2 tầng hiện đại, kích thước 5 × 15m", price: "100.000đ", views: 84, downloads: 37, rating: "5.0", image: "/mat-bang-5x20.png" },
  { category: "HỒ SƠ THIẾT KẾ THI CÔNG", title: "Hồ sơ nhà phố 3 tầng + 1 tum phong cách hiện đại", price: "100.000đ", views: 31, downloads: 14, rating: "4.8", image: "/mat-bang-5x20.png" },
  { category: "BẢN VẼ NHÀ PHỐ 2 TẦNG", title: "Nhà phố 2 tầng hiện đại, diện tích xây dựng 8,2 × 14m", price: "80.000đ", views: 70, downloads: 28, rating: "4.9", image: "/community-house.png" },
  { category: "BẢN VẼ NHÀ CẤP 4", title: "Bản vẽ nhà cấp 4 mái Thái kích thước 7,3 × 14m", price: "50.000đ", views: 59, downloads: 21, rating: "4.7", image: "/mat-bang-5x20.png" },
];

export default function DrawingFilesPage() {
  return <main className="mx-auto max-w-[1440px] px-4 py-7 lg:px-8 lg:py-10">
    <section className="flex flex-col justify-between gap-5 rounded-[26px] bg-[#073b74] p-7 text-white sm:p-9 lg:flex-row lg:items-center">
      <div className="max-w-3xl"><p className="text-sm font-extrabold tracking-[.12em] text-[#bde7f8]">THƯ VIỆN BẢN VẼ</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Kho bản vẽ từ kỹ sư và kiến trúc sư</h1><p className="mt-3 text-base leading-7 text-white/90">Khám phá, mua và tải file CAD, hồ sơ thiết kế, SketchUp cùng các tài liệu phục vụ thi công.</p></div>
      <RequestActionButton requestType="drawing-listing" targetType="drawing-market" targetId="new-drawing" label="Đăng bán bản vẽ" title="Đăng bán bản vẽ" description="Mô tả bộ hồ sơ, định dạng, phiên bản phần mềm, giá bán và quyền sử dụng. Đính kèm tệp mẫu hoặc danh mục bản vẽ." allowFile className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold"/>
    </section>
    <div className="mt-7"><FilterChips scope="drawings" items={[{label:"Tất cả",value:"all"},{label:"Nhà phố",value:"nha-pho"},{label:"Biệt thự",value:"biet-thu"},{label:"Nhà cấp 4",value:"nha-cap-4"},{label:"Công trình công cộng",value:"cong-cong"},{label:"File CAD",value:"cad"},{label:"Hồ sơ thi công",value:"thi-cong"}]}/></div>
    <section className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{drawings.map((drawing) => <article key={drawing.title} data-filter-scope="drawings" data-filter-tags={[drawing.category.includes("NHÀ PHỐ") ? "nha-pho" : "", drawing.category.includes("BIỆT THỰ") ? "biet-thu" : "", drawing.category.includes("CẤP 4") ? "nha-cap-4" : "", drawing.category.includes("XÃ HỘI") ? "cong-cong" : "", drawing.category.includes("CAD") ? "cad" : "", drawing.category.includes("THI CÔNG") ? "thi-cong" : ""].join("|")} className="group min-w-0"><div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#f7f9fc]"><img src={drawing.image} alt={drawing.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/><ToggleActionButton actionType="save" targetType="drawing" targetId={drawing.title} label="Lưu bản vẽ" activeLabel="Đã lưu" icon="heart" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 text-[#3f5064] opacity-0 shadow-sm transition group-hover:opacity-100 [&>span]:sr-only"/></div><div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#3f5064]"><span className="truncate text-[#147aa8]">{drawing.category}</span><span className="flex shrink-0 items-center gap-2"><span className="flex items-center gap-1"><Eye size={14}/>{drawing.views}</span><span className="flex items-center gap-1"><ArrowDownToLine size={14}/>{drawing.downloads}</span><span className="flex items-center gap-0.5 text-[#d99016]"><Star size={14} className="fill-current"/>{drawing.rating}</span></span></div><h2 className="mt-2 line-clamp-2 min-h-12 text-[15px] font-bold leading-6 text-[#1d3429]">{drawing.title}</h2><div className="mt-3 flex items-center justify-between"><strong className="text-base text-[#229ed9]">{drawing.price}</strong><RequestActionButton requestType="drawing-purchase" targetType="drawing" targetId={drawing.title} label="Yêu cầu file" title={"Yêu cầu mua: " + drawing.title} description={"Giá niêm yết: " + drawing.price + ". Người bán sẽ nhận yêu cầu và liên hệ để xác nhận phạm vi file, thanh toán và quyền sử dụng."} className="flex items-center gap-1 text-xs font-bold text-[#229ed9]"/></div></article>)}</section>
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