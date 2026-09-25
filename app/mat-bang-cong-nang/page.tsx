import type { Metadata } from "next";
import { Bath, BedDouble, Car, CheckCircle2, SlidersHorizontal, Sun } from "lucide-react";
import { EditorialContent } from "@/components/editorial-content";
import { DetailActionButton, FilterChips, RequestActionButton } from "@/components/interactive-actions";

export const metadata: Metadata = {
  title: "Mặt bằng công năng nhà ở theo kích thước đất | Tipook",
  description: "Tham khảo mặt bằng công năng nhà phố 4x20m, 5x20m và nhiều kích thước phổ biến. Nhận tư vấn bố trí từ kiến trúc sư.",
};

const plans = [
  { tags: "ngang-5m|2-tang", title: "Mặt bằng nhà phố 5×20m", subtitle: "Tầng trệt · Gia đình 4–5 người", bedrooms: "3 phòng ngủ", baths: "3 WC", feature: "Giếng trời giữa nhà" },
  { tags: "ngang-4m|3-tang", title: "Mặt bằng nhà phố 4×20m", subtitle: "3 tầng · Có phòng làm việc", bedrooms: "4 phòng ngủ", baths: "4 WC", feature: "Thông gió hai đầu" },
  { tags: "ngang-5m|2-tang", title: "Mặt bằng nhà 5×16m", subtitle: "2 tầng · Gia đình trẻ", bedrooms: "3 phòng ngủ", baths: "2 WC", feature: "Bếp nhìn ra sân sau" },
  { tags: "ngang-6m|3-tang|co-gara", title: "Mặt bằng nhà 6×18m", subtitle: "3 tầng · Có gara ô tô", bedrooms: "4 phòng ngủ", baths: "4 WC", feature: "Phòng ngủ tầng trệt" },
];

export default function FunctionalFloorPlans() {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#0b2e59]">
      <main className="mx-auto max-w-[1320px] px-4 py-7 lg:px-8 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end">
          <div><p className="text-sm font-extrabold uppercase tracking-[.13em] text-[#229ed9]">Bố trí không gian</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Mặt bằng công năng nhà ở</h1><p className="mt-3 max-w-2xl text-base leading-7 text-[#3f5064]">Tham khảo cách sắp xếp phòng khách, bếp, cầu thang, giếng trời và phòng ngủ theo từng kích thước đất phổ biến.</p></div>
          <div className="rounded-2xl bg-[#eef9fd] p-4"><p className="flex items-center gap-2 text-sm font-bold text-[#229ed9]"><CheckCircle2 size={17}/>Lưu ý khi tham khảo</p><p className="mt-1.5 text-sm leading-6 text-[#3f5064]">Mặt bằng cần được kiến trúc sư điều chỉnh theo hướng đất, hiện trạng và quy định xây dựng tại địa phương.</p></div>
        </div>
        <div className="mt-6 overflow-x-auto pb-2 scrollbar-none"><FilterChips scope="plans" items={[{label:"Tất cả",value:"all"},{label:"Ngang 4m",value:"ngang-4m"},{label:"Ngang 5m",value:"ngang-5m"},{label:"Ngang 6m",value:"ngang-6m"},{label:"2 tầng",value:"2-tang"},{label:"3 tầng",value:"3-tang"},{label:"Có gara",value:"co-gara"}]}/></div>
        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          {plans.map((plan,index)=><article key={plan.title} data-filter-scope="plans" data-filter-tags={plan.tags} className="overflow-hidden rounded-[24px] border border-[#e3eaf2] bg-white shadow-[0_5px_20px_rgba(24,49,39,.045)]">
            <div className="relative aspect-[16/10] overflow-hidden bg-[#f4f7fb]"><img src="/mat-bang-5x20.png" alt={plan.title} className={`h-full w-full object-cover ${index%2 ? "scale-[1.04]" : ""}`}/><span className="absolute bottom-3 left-3 rounded-lg bg-[#073b74]/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">Sơ đồ tham khảo</span></div>
            <div className="p-5 sm:p-6"><p className="text-sm font-bold text-[#168ac0]">{plan.subtitle}</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.02em]">{plan.title}</h2><div className="mt-4 grid grid-cols-2 gap-2 text-sm font-medium text-[#3f5064]"><span className="flex items-center gap-2 rounded-xl bg-[#f7f9fc] p-3"><BedDouble size={17} className="text-[#229ed9]"/>{plan.bedrooms}</span><span className="flex items-center gap-2 rounded-xl bg-[#f7f9fc] p-3"><Bath size={17} className="text-[#229ed9]"/>{plan.baths}</span><span className="col-span-2 flex items-center gap-2 rounded-xl bg-[#eef9fd] p-3"><Sun size={17} className="text-[#147aa8]"/>{plan.feature}</span></div><div className="mt-5 flex items-center justify-between border-t border-[#e8eef5] pt-4"><DetailActionButton label="Xem chi tiết" title={plan.title} className="flex items-center gap-2 text-sm font-bold text-[#3f5064]"><img src="/mat-bang-5x20.png" alt={plan.title} className="mb-4 w-full rounded-xl"/><p>{plan.subtitle}</p><p className="mt-2">{plan.bedrooms} · {plan.baths} · {plan.feature}</p></DetailActionButton><RequestActionButton requestType="floor-plan-adjustment" targetType="floor-plan" targetId={plan.title} label="Nhờ KTS điều chỉnh" title={"Điều chỉnh " + plan.title} description="Mô tả kích thước đất, số thành viên, số tầng và nhu cầu đặc biệt." className="flex items-center gap-1.5 rounded-lg bg-[#d9f1fb] px-3 py-2 text-sm font-bold text-[#229ed9]"/></div></div>
          </article>)}
        </section>
                <EditorialContent
          eyebrow="NGUYÊN TẮC BỐ TRÍ CÔNG NĂNG"
          title="Mặt bằng tốt giúp ngôi nhà dễ sống hơn mỗi ngày"
          intro="Công năng không chỉ là đặt đủ phòng vào diện tích có sẵn. Một phương án hợp lý phải tạo được luồng di chuyển ngắn, thông gió tự nhiên, sự riêng tư và khả năng thay đổi khi gia đình có thêm thành viên."
          sections={[
            { title: "Phân vùng chung, riêng và phục vụ", paragraphs: ["Không gian khách, bếp và sinh hoạt chung nên kết nối thuận tiện nhưng vẫn kiểm soát được mùi và tiếng ồn. Phòng ngủ cần tách khỏi lối đi đông người, còn khu giặt phơi và kỹ thuật nên có đường tiếp cận riêng để bảo trì."], bullets: ["Khu sinh hoạt chung", "Khu nghỉ ngơi riêng tư", "Khu bếp và kho", "Khu kỹ thuật, giặt phơi"] },
            { title: "Tổ chức giao thông và cầu thang", paragraphs: ["Hạn chế hành lang dài, cửa phòng đối đầu trực tiếp và lối đi cắt ngang khu sinh hoạt. Cầu thang nên ở vị trí dễ tiếp cận, có ánh sáng và khoảng nghỉ an toàn; đồng thời không làm chia vụn mặt bằng tầng trệt."] },
            { title: "Đưa ánh sáng và gió vào giữa nhà", paragraphs: ["Với nhà phố dài, mặt trước và mặt sau thường không đủ để thông thoáng toàn bộ không gian. Giếng trời, sân trong hoặc khe thoáng nên được tính từ đầu, có giải pháp thoát nước, che mưa và bảo trì phù hợp."] },
            { title: "Dự phòng thay đổi trong tương lai", paragraphs: ["Một phòng đa năng ở tầng trệt có thể trở thành phòng ngủ cho người lớn tuổi. Hệ kết cấu, vị trí thang và trục kỹ thuật cũng nên tính đến khả năng lắp thang máy hoặc thay đổi công năng sau này."] }
          ]}
          checklist={["Đường đi không xuyên qua phòng riêng", "Phòng chính có ánh sáng tự nhiên", "Trục kỹ thuật được gom gọn", "Có phương án cho người lớn tuổi"]}
        />
        <section className="mt-9 grid gap-6 rounded-[24px] bg-[#073b74] p-7 text-white sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center"><div><h2 className="text-2xl font-extrabold">Bạn có kích thước đất khác?</h2><p className="mt-2 max-w-2xl text-white/85">Gửi chiều ngang, chiều dài, số tầng và số phòng. Kiến trúc sư sẽ gợi ý mặt bằng phù hợp với gia đình bạn.</p><div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-white/90"><span className="flex items-center gap-2"><Car size={16}/>Nhu cầu để xe</span><span className="flex items-center gap-2"><Sun size={16}/>Hướng sáng</span><span className="flex items-center gap-2"><SlidersHorizontal size={16}/>Thói quen sinh hoạt</span></div></div><RequestActionButton requestType="floor-plan-consultation" targetType="catalog" targetId="custom-floor-plan" label="Nhận tư vấn mặt bằng" title="Tư vấn mặt bằng theo khu đất" description="Gửi chiều ngang, chiều dài, số tầng, số phòng và nhu cầu để xe." className="flex items-center justify-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold"/></section>
      </main>
    </div>
  );
}
