import type { Metadata } from "next";
import { BadgeCheck, Building2, MapPin, ShieldCheck, Star } from "lucide-react";
import { EditorialContent } from "@/components/editorial-content";
import { DetailActionButton, FilterChips, RequestActionButton } from "@/components/interactive-actions";

export const metadata: Metadata = {
  title: "Nhà thầu thi công uy tín | ROOM XÂY DỰNG",
  description: "Kết nối gia chủ với nhà thầu thi công, kỹ sư và đội ngũ xây dựng phù hợp.",
};

const contractors = [
  { tags: "tron-goi|nha-pho|biet-thu", name: "An Phú Construction", location: "TP. Hồ Chí Minh", specialty: "Nhà phố & biệt thự", rating: "4.9", projects: 126 },
  { tags: "tron-goi|nha-pho", name: "Kiến Tạo Việt", location: "Bình Dương", specialty: "Thi công trọn gói", rating: "4.8", projects: 94 },
  { tags: "nha-pho", name: "Minh Thành Build", location: "Đồng Nai", specialty: "Nhà phố hiện đại", rating: "4.8", projects: 78 },
  { tags: "tron-goi|biet-thu", name: "Nam Việt Engineering", location: "Đà Nẵng", specialty: "Kết cấu & hoàn thiện", rating: "4.7", projects: 65 },
  { tags: "cai-tao|nha-pho", name: "Hưng Gia Homes", location: "Hà Nội", specialty: "Cải tạo nhà ở", rating: "4.9", projects: 112 },
  { tags: "nha-cap-4", name: "Thịnh Phát Build", location: "Long An", specialty: "Nhà cấp 4 & nhà vườn", rating: "4.7", projects: 53 },
];

export default function ContractorsPage() {
  return <main className="mx-auto max-w-[1440px] px-4 py-7 lg:px-8 lg:py-10">
    <section className="rounded-[26px] bg-[#073b74] p-7 text-white sm:p-9"><p className="text-sm font-extrabold tracking-[.12em] text-[#bde7f8]">NHÀ THẦU THI CÔNG</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Tìm nhà thầu phù hợp cho ngôi nhà của bạn</h1><p className="mt-3 max-w-3xl text-base leading-7 text-white/90">Tham khảo hồ sơ năng lực, công trình đã thi công và đánh giá thực tế từ cộng đồng trước khi liên hệ.</p></section>
    <div className="mt-6"><FilterChips scope="contractors" items={[{label:"Tất cả",value:"all"},{label:"Thi công trọn gói",value:"tron-goi"},{label:"Nhà phố",value:"nha-pho"},{label:"Biệt thự",value:"biet-thu"},{label:"Cải tạo",value:"cai-tao"},{label:"Nhà cấp 4",value:"nha-cap-4"}]}/></div>
    <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{contractors.map((contractor) => <article key={contractor.name} data-filter-scope="contractors" data-filter-tags={contractor.tags} className="rounded-[22px] border border-[#e3eaf2] bg-white p-6 shadow-[0_5px_20px_rgba(24,49,39,.045)]"><div className="flex items-start gap-3"><span className="grid size-12 place-items-center rounded-xl bg-[#eef9fd] text-[#229ed9]"><Building2 size={23}/></span><div><h2 className="flex items-center gap-1.5 text-lg font-extrabold"><BadgeCheck size={17} className="text-[#229ed9]"/>{contractor.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-[#3f5064]"><MapPin size={14}/>{contractor.location}</p></div></div><p className="mt-5 text-sm font-bold text-[#147aa8]">{contractor.specialty}</p><div className="mt-3 flex items-center justify-between border-y border-[#e8eef5] py-3 text-sm"><span className="flex items-center gap-1 font-bold text-[#d99016]"><Star size={16} className="fill-current"/>{contractor.rating}/5</span><span className="text-[#3f5064]">{contractor.projects} công trình</span></div><DetailActionButton label="Xem hồ sơ nhà thầu" title={contractor.name} className="mt-4 w-full rounded-xl bg-[#229ed9] py-2.5 text-sm font-bold text-white hover:bg-[#168ac0]"><p><b>Địa điểm:</b> {contractor.location}</p><p><b>Chuyên môn:</b> {contractor.specialty}</p><p><b>Đánh giá:</b> {contractor.rating}/5 · {contractor.projects} công trình</p><RequestActionButton requestType="contractor-contact" targetType="contractor" targetId={contractor.name} label="Gửi yêu cầu liên hệ" title={"Liên hệ " + contractor.name} description="Mô tả loại công trình, địa điểm, quy mô và thời gian dự kiến." className="mt-5 w-full rounded-xl bg-[#229ed9] px-4 py-3 font-bold text-white"/></DetailActionButton></article>)}</section>
        <EditorialContent
      eyebrow="CHỌN NHÀ THẦU AN TOÀN"
      title="Quy trình đánh giá nhà thầu trước khi ký hợp đồng"
      intro="Báo giá thấp nhất chưa chắc là lựa chọn tiết kiệm nhất. Hãy đánh giá cùng lúc năng lực thực tế, phạm vi công việc, tổ chức công trường và cách nhà thầu chịu trách nhiệm khi có sai sót."
      sections={[
        { title: "Kiểm chứng công trình đã thực hiện", paragraphs: ["Yêu cầu xem công trình có quy mô và điều kiện tương tự, ưu tiên công trình đang thi công để quan sát tổ chức hiện trường. Trao đổi trực tiếp với khách hàng cũ về tiến độ, phát sinh, khả năng phối hợp và chất lượng bảo hành."], bullets: ["Công trình tương đồng", "Đội ngũ trực tiếp thi công", "Quy trình an toàn", "Phản hồi của khách hàng cũ"] },
        { title: "So sánh báo giá trên cùng phạm vi", paragraphs: ["Chuẩn hóa khối lượng, thương hiệu vật tư, quy cách thi công và phần việc loại trừ trước khi so giá. Một báo giá thấp có thể chưa bao gồm giàn giáo, vận chuyển, vệ sinh, điện nước tạm hoặc nhiều hạng mục hoàn thiện."] },
        { title: "Hợp đồng và mốc thanh toán", paragraphs: ["Hợp đồng cần ghi rõ bản vẽ áp dụng, vật tư, tiến độ, tiêu chuẩn nghiệm thu, trách nhiệm bảo vệ công trình lân cận và thời hạn bảo hành. Thanh toán nên gắn với khối lượng đã nghiệm thu, không chỉ dựa trên thời gian."], bullets: ["Có phụ lục vật tư", "Có tiến độ theo giai đoạn", "Quy định xử lý phát sinh", "Giữ lại tiền bảo hành hợp lý"] },
        { title: "Duy trì cơ chế giám sát độc lập", paragraphs: ["Người giám sát cần kiểm tra vật tư đầu vào, biện pháp thi công và chất lượng trước khi chuyển bước. Với các hạng mục quan trọng, nên có biên bản và hình ảnh xác nhận giữa gia chủ, giám sát và nhà thầu."] }
      ]}
      checklist={["Không ký khi phạm vi còn mơ hồ", "Không thanh toán vượt khối lượng", "Xác minh pháp lý đơn vị thi công", "Lưu mọi thay đổi bằng văn bản"]}
    />
        <section className="mt-9 flex flex-col justify-between gap-5 rounded-[24px] border border-[#e3eaf2] bg-white p-7 sm:flex-row sm:items-center"><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#eef9fd] text-[#147aa8]"><ShieldCheck size={24}/></span><div><h2 className="text-xl font-extrabold">Bạn là đơn vị thi công?</h2><p className="mt-1 text-[#3f5064]">Tạo hồ sơ năng lực để kết nối với khách hàng phù hợp.</p></div></div><RequestActionButton requestType="contractor-registration" targetType="directory" targetId="contractors" label="Đăng ký nhà thầu" title="Đăng ký hồ sơ nhà thầu" description="Cung cấp pháp nhân, khu vực hoạt động, chuyên môn và kinh nghiệm. Có thể đính kèm hồ sơ năng lực." allowFile className="rounded-xl bg-[#229ed9] px-5 py-3 font-bold text-white"/></section>
  </main>;
}