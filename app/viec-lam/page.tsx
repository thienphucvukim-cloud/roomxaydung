import type { Metadata } from "next";
import { BriefcaseBusiness, Building2, MapPin, Send, Wallet } from "lucide-react";
import { EditorialContent } from "@/components/editorial-content";

export const metadata: Metadata = { title: "Việc làm xây dựng & kiến trúc | ROOM XÂY DỰNG" };

const jobs = [
  { title: "Kiến trúc sư thiết kế nhà phố", company: "An Phú Construction", place: "TP. Hồ Chí Minh", salary: "15 – 22 triệu", type: "Toàn thời gian" },
  { title: "Kỹ sư giám sát công trình", company: "Kiến Tạo Việt", place: "Bình Dương", salary: "14 – 20 triệu", type: "Toàn thời gian" },
  { title: "Họa viên triển khai bản vẽ CAD", company: "Minh Thành Build", place: "Đồng Nai", salary: "10 – 16 triệu", type: "Hybrid" },
  { title: "Chỉ huy trưởng công trình nhà ở", company: "Hưng Gia Homes", place: "Hà Nội", salary: "20 – 30 triệu", type: "Toàn thời gian" },
  { title: "Kỹ sư dự toán", company: "Nam Việt Engineering", place: "Đà Nẵng", salary: "12 – 18 triệu", type: "Toàn thời gian" },
  { title: "Cộng tác viên thiết kế 3D", company: "Thịnh Phát Build", place: "Làm việc từ xa", salary: "Theo dự án", type: "Freelance" },
];

export default function JobsPage() {
  return <main className="mx-auto max-w-[1440px] px-4 py-7 lg:px-8 lg:py-10">
    <section className="flex flex-col justify-between gap-6 rounded-[26px] bg-[#073b74] p-7 text-white sm:p-9 lg:flex-row lg:items-end"><div><p className="text-sm font-extrabold tracking-[.12em] text-[#bde7f8]">VIỆC LÀM XÂY DỰNG</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Cơ hội nghề nghiệp trong ngành xây dựng</h1><p className="mt-3 max-w-2xl text-base leading-7 text-white/90">Kết nối kỹ sư, kiến trúc sư và nhân sự thi công với các đơn vị đang tuyển dụng.</p></div><button className="flex items-center justify-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold"><BriefcaseBusiness size={18}/>Đăng tin tuyển dụng</button></section>
    <div className="mt-6 flex flex-wrap gap-2">{["Tất cả", "Kiến trúc sư", "Kỹ sư xây dựng", "Giám sát", "Họa viên", "Dự toán", "Freelance"].map((item, index) => <button key={item} className={`rounded-full px-4 py-2 text-sm font-bold ${index === 0 ? "bg-[#229ed9] text-white" : "border border-[#e3eaf2] bg-white text-[#3f5064]"}`}>{item}</button>)}</div>
    <section className="mt-6 grid gap-5 lg:grid-cols-2">{jobs.map((job) => <article key={job.title} className="rounded-[22px] border border-[#e3eaf2] bg-white p-6 shadow-[0_5px_20px_rgba(24,49,39,.045)]"><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#eef9fd] text-[#229ed9]"><Building2 size={23}/></span><div className="min-w-0"><h2 className="text-xl font-extrabold">{job.title}</h2><p className="mt-1 font-semibold text-[#147aa8]">{job.company}</p></div></div><div className="mt-5 flex flex-wrap gap-3 text-sm text-[#3f5064]"><span className="flex items-center gap-1.5"><MapPin size={16}/>{job.place}</span><span className="flex items-center gap-1.5"><Wallet size={16}/>{job.salary}</span><span className="rounded-full bg-[#eef9fd] px-2.5 py-0.5 text-xs font-bold text-[#229ed9]">{job.type}</span></div><div className="mt-5 flex justify-between border-t border-[#e8eef5] pt-4"><span className="text-sm text-[#3f5064]">Đăng hôm nay</span><button className="flex items-center gap-1.5 text-sm font-bold text-[#229ed9]">Ứng tuyển <Send size={15}/></button></div></article>)}</section>
      <EditorialContent
      eyebrow="PHÁT TRIỂN NGHỀ NGHIỆP"
      title="Chuẩn bị hồ sơ ứng tuyển trong ngành xây dựng"
      intro="Nhà tuyển dụng xây dựng quan tâm đến khả năng biến kiến thức thành kết quả tại dự án. Một hồ sơ tốt cần cho thấy vai trò cụ thể, quy mô công trình, công cụ bạn sử dụng và cách bạn giải quyết vấn đề."
      sections={[
        { title: "Trình bày kinh nghiệm theo dự án", paragraphs: ["Thay vì chỉ liệt kê chức danh, hãy nêu loại công trình, quy mô, giai đoạn tham gia và trách nhiệm trực tiếp. Nếu có thể, bổ sung kết quả đo lường được như số hồ sơ triển khai, giá trị gói thầu hoặc tiến độ đã kiểm soát."], bullets: ["Vai trò và phạm vi phụ trách", "Quy mô dự án", "Phần mềm và tiêu chuẩn sử dụng", "Kết quả hoặc bài học chính"] },
        { title: "Xây dựng portfolio có chọn lọc", paragraphs: ["Kiến trúc sư và họa viên nên chọn ít dự án nhưng trình bày rõ quá trình từ ý tưởng đến hồ sơ kỹ thuật. Kỹ sư và giám sát có thể dùng ảnh hiện trường, biện pháp thi công, báo cáo nghiệm thu hoặc bảng khối lượng đã được ẩn thông tin nhạy cảm."] },
        { title: "Đọc kỹ phạm vi công việc và quyền lợi", paragraphs: ["Làm rõ địa điểm dự án, thời gian làm việc, tần suất đi công tác, phụ cấp công trường, bảo hiểm và cách tính thưởng. Với công việc freelance, cần chốt số lần chỉnh sửa, định dạng bàn giao, thời hạn thanh toán và quyền sử dụng sản phẩm."] },
        { title: "Chuẩn bị cho phỏng vấn chuyên môn", paragraphs: ["Ôn lại dự án gần nhất và sẵn sàng giải thích một quyết định kỹ thuật, một sai sót đã xử lý và cách phối hợp với các bên. Câu trả lời trung thực, có bối cảnh và kết quả cụ thể thường thuyết phục hơn việc chỉ nói về điểm mạnh chung chung."] }
      ]}
      checklist={["CV không dài quá mức cần thiết", "Portfolio có chú thích vai trò", "Không đưa tài liệu mật của dự án", "Xác minh doanh nghiệp trước khi nhận việc"]}
    />
        </main>;
}