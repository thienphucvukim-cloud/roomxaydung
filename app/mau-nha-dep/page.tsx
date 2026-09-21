import type { Metadata } from "next";
import { ArrowRight, BedDouble, Heart, Maximize2, MessageCircle, SlidersHorizontal } from "lucide-react";
import { ProjectGallery } from "@/components/project-gallery";
import { EditorialContent } from "@/components/editorial-content";
import { FilterChips, RequestActionButton, ToggleActionButton } from "@/components/interactive-actions";

export const metadata: Metadata = {
  title: "Mẫu nhà đẹp hiện đại, dễ xây | ROOM XÂY DỰNG",
  description: "Tham khảo mẫu nhà phố, nhà vườn và nhà hiện đại theo kích thước đất. Nhận tư vấn trực tiếp từ kiến trúc sư.",
};

const models = [
  { tags: "nha-pho|mat-tien-5m|3-tang|nhieu-cay", title: "Nhà phố 3 tầng xanh mát", meta: "5 × 20m · 4 phòng ngủ", style: "Hiện đại nhiệt đới", image: "/mau-nha-pho-xanh.png" },
  { tags: "nha-pho|3-tang", title: "Nhà phố lệch tầng thoáng sáng", meta: "4,5 × 18m · 3 phòng ngủ", style: "Hiện đại tối giản", image: "/community-house.png" },
  { tags: "nha-pho|mat-tien-5m|3-tang", title: "Nhà 3 tầng có sân trước", meta: "5 × 16m · 4 phòng ngủ", style: "Ấm áp, gần gũi", image: "/mau-nha-pho-xanh.png" },
  { tags: "nha-pho|mat-tien-5m|nhieu-cay", title: "Nhà phố có khoảng xanh giữa nhà", meta: "5 × 22m · 3 phòng ngủ", style: "Không gian mở", image: "/community-house.png" },
  { tags: "nha-pho|3-tang", title: "Nhà ống 3 tầng mặt tiền lam gỗ", meta: "4 × 20m · 4 phòng ngủ", style: "Hiện đại", image: "/mau-nha-pho-xanh.png" },
  { tags: "nha-pho|co-gara", title: "Nhà phố kết hợp kinh doanh", meta: "6 × 18m · 3 phòng ngủ", style: "Linh hoạt công năng", image: "/community-house.png" },
];

export default function BeautifulHouseModels() {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#0b2e59]">
      <main className="mx-auto max-w-[1320px] px-4 py-7 lg:px-8 lg:py-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="text-sm font-extrabold uppercase tracking-[.13em] text-[#229ed9]">Thư viện tham khảo</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Mẫu nhà đẹp, dễ ứng dụng</h1><p className="mt-3 max-w-2xl text-base leading-7 text-[#3f5064]">Khám phá ý tưởng theo đúng kích thước đất và nhu cầu gia đình. Mỗi mẫu đều có thể trao đổi với kiến trúc sư để điều chỉnh thành thiết kế riêng.</p></div>
          <RequestActionButton requestType="design-match" targetType="catalog" targetId="mau-nha-dep" label="Lọc mẫu phù hợp" title="Tìm mẫu nhà phù hợp" description="Gửi kích thước đất, số tầng, số phòng và phong cách mong muốn để kiến trúc sư đề xuất mẫu phù hợp." className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dce5ef] bg-white px-4 text-sm font-bold text-[#3f5064]"/>
        </div>
        <div className="mt-6 overflow-x-auto pb-2 scrollbar-none"><FilterChips scope="models" items={[{label:"Tất cả",value:"all"},{label:"Nhà phố",value:"nha-pho"},{label:"Nhà vườn",value:"nha-vuon"},{label:"Mặt tiền 5m",value:"mat-tien-5m"},{label:"3 tầng",value:"3-tang"},{label:"Có gara",value:"co-gara"},{label:"Nhiều cây xanh",value:"nhieu-cay"}]}/></div>
        <section className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model,index)=><article key={model.title} data-filter-scope="models" data-filter-tags={model.tags} className="group overflow-hidden rounded-[22px] border border-[#e3eaf2] bg-white shadow-[0_5px_20px_rgba(24,49,39,.045)]">
            <div className="relative aspect-[4/3] overflow-hidden"><img src={model.image} alt={model.title} className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${index%2 ? "object-center" : ""}`}/><span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-bold text-[#0b2e59] backdrop-blur">{model.style}</span><ToggleActionButton actionType="save" targetType="house-model" targetId={model.title} label="Lưu mẫu" activeLabel="Đã lưu" icon="heart" className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full bg-white/90 text-[#3f5064] backdrop-blur [&>span]:sr-only"/><ProjectGallery model={model} trigger="overlay"/></div>
            <div className="p-5"><h2 className="text-lg font-extrabold tracking-[-.02em]">{model.title}</h2><p className="mt-2 flex items-center gap-2 text-sm font-medium text-[#3f5064]"><Maximize2 size={15}/>{model.meta}</p><div className="mt-5 flex items-center justify-between border-t border-[#e8eef5] pt-4"><ProjectGallery model={model}/><RequestActionButton requestType="architect-consultation" targetType="house-model" targetId={model.title} label="Nhờ KTS tư vấn" title={"Tư vấn: " + model.title} description={"Mẫu tham khảo: " + model.meta + ". Hãy mô tả khu đất và thay đổi bạn mong muốn."} className="flex items-center gap-1.5 rounded-lg bg-[#eef9fd] px-3 py-2 text-sm font-bold text-[#147aa8]"/></div></div>
          </article>)}
        </section>
                <EditorialContent
          eyebrow="CHỌN MẪU NHÀ PHÙ HỢP"
          title="Đừng chọn mẫu nhà chỉ vì mặt tiền đẹp"
          intro="Một mẫu tham khảo chỉ thực sự phù hợp khi đáp ứng kích thước đất, nhu cầu sinh hoạt, điều kiện khí hậu và ngân sách của gia đình. Hãy dùng hình ảnh để định hướng phong cách, sau đó kiểm tra kỹ công năng và khả năng thi công."
          sections={[
            { title: "Bắt đầu từ khu đất và quy định xây dựng", paragraphs: ["Đo chính xác chiều ngang, chiều dài, cao độ và vị trí tiếp cận của khu đất. Kiểm tra chỉ giới, khoảng lùi, mật độ xây dựng và chiều cao cho phép trước khi phát triển phương án. Một mẫu đẹp trên khu đất khác có thể không phù hợp với quy định tại nơi bạn xây."], bullets: ["Kích thước và hình dạng khu đất", "Hướng nắng, hướng gió", "Lối tiếp cận thi công", "Khoảng lùi và mật độ xây dựng"] },
            { title: "Ưu tiên công năng trước phong cách", paragraphs: ["Liệt kê số phòng, nhu cầu riêng tư, vị trí để xe, không gian làm việc và khả năng thay đổi của gia đình. Sau khi mặt bằng vận hành hợp lý, kiến trúc sư mới phát triển hình thức mặt tiền và vật liệu theo phong cách bạn yêu thích."] },
            { title: "Đánh giá chi phí vận hành lâu dài", paragraphs: ["Mặt kính lớn, lam trang trí, mái phức tạp hoặc nhiều khoảng thông tầng có thể làm tăng chi phí thi công và bảo trì. Hãy cân nhắc khả năng vệ sinh, chống thấm, thay thế vật liệu và mức tiêu thụ điện trong suốt quá trình sử dụng."] }
          ]}
          checklist={["Không sao chép nguyên mẫu khi chưa khảo sát đất", "Chốt nhu cầu của tất cả thành viên", "Dự trù chi phí hoàn thiện và nội thất", "Nhờ kiến trúc sư điều chỉnh theo địa phương"]}
        />
        <section className="mt-9 flex flex-col items-start justify-between gap-5 rounded-[24px] bg-[#073b74] p-7 text-white sm:flex-row sm:items-center sm:p-9"><div><h2 className="text-2xl font-extrabold">Chưa tìm thấy mẫu phù hợp với đất của bạn?</h2><p className="mt-2 text-white/85">Gửi kích thước đất và nhu cầu, kiến trúc sư sẽ gợi ý phương án phù hợp.</p></div><RequestActionButton requestType="design-consultation" targetType="catalog" targetId="custom-house-design" label="Nhận tư vấn thiết kế" title="Nhận tư vấn thiết kế riêng" description="Gửi thông tin khu đất, nhu cầu sử dụng và ngân sách dự kiến." className="flex shrink-0 items-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold"/></section>
      </main>
    </div>
  );
}
