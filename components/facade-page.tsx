import { EditableImage, EditableText } from "@/components/site-editor";
import { DemoPostBadge } from "@/components/demo-post-badge";
import { DemoPostControls } from "@/components/demo-post-controls";
import { Maximize2 } from "lucide-react";
import { ProjectGallery } from "@/components/project-gallery";
import { EditorialContent } from "@/components/editorial-content";
import { CommunityGallery } from "@/components/community-gallery";
import { ModelCardActions } from "@/components/model-card-actions";
import { RequestActionButton, ToggleActionButton } from "@/components/interactive-actions";
import { facadeModels as models } from "@/lib/facade-catalog";
import type { FacadeSort } from "@/lib/facade-feed";


export function FacadePage({ query = "", sort = "random" }: { query?: string; sort?: FacadeSort }) {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#0b2e59]">
      <main className="mx-auto max-w-[1320px] px-4 py-5 lg:px-8">
        <div className="flex flex-col">
          <div>
            <CommunityGallery key={`${query}:${sort}`} searchQuery={query} sort={sort} modelCards={models.map((model, index) => ({ key: model.title, contentPrefix: `facade.${index}`, search: `${model.title} ${model.meta} ${model.style} ${model.tags} ${model.authorName} ${model.isDemo ? "demo bài demo" : ""}`, card: (
            <article key={model.title} data-model-search={`${model.title} ${model.meta} ${model.style} ${model.tags}`} className="group motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-[3px] flex flex-col overflow-hidden rounded-[22px] border border-[#e3eaf2] bg-white shadow-[0_5px_20px_rgba(24,49,39,.045)]">
              <div className="relative aspect-[5/4] shrink-0 overflow-hidden"><EditableImage contentKey={`facade.${index}.image`} src={model.image} alt={model.title} className={`h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.02] ${index%2 ? "object-center" : ""}`}/><span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-bold text-[#0b2e59] backdrop-blur"><EditableText contentKey={`facade.${index}.style`}>{model.style}</EditableText></span><ToggleActionButton actionType="save" targetType="house-model" targetId={model.title} label="Lưu mẫu" activeLabel="Đã lưu" icon="heart" className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full bg-white/90 text-[#3f5064] backdrop-blur [&>span]:sr-only"/><ProjectGallery model={{ ...model, editableKey: `facade.${index}` }} trigger="overlay" engagementTarget={{targetType:"house-model",targetId:model.title}}/></div>
              <div className="flex flex-1 flex-col px-3 py-2.5"><div className="mb-2"><DemoPostBadge isDemo={model.isDemo}/></div><h2 className="catalog-card-title text-base font-extrabold tracking-[-.02em]"><EditableText contentKey={`facade.${index}.title`}>{model.title}</EditableText></h2><p className="mt-1 flex items-center gap-2 text-sm font-medium text-[#3f5064]"><Maximize2 size={15}/><EditableText contentKey={`facade.${index}.meta`}>{model.meta}</EditableText></p><p className="catalog-card-author mt-1 text-xs text-[#66778a]">Đăng bởi <a href={`/nguoi-dung/${model.authorId}`} className="font-semibold text-[#0b2e59] hover:text-[#229ed9] hover:underline">{model.authorName}</a></p><DemoPostControls prefix={`facade.${index}`} title={model.title} style={model.style} meta={model.meta} image={model.image}/><div className="mt-auto"><ModelCardActions title={model.title} meta={model.meta} image={model.image} recipientUserId={model.authorId}/></div></div>
            </article>
            ) }))} />
          </div>
          <div className="mt-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><p className="text-sm font-extrabold uppercase tracking-[.13em] text-[#229ed9]"><EditableText contentKey="facade.text.0">Thư viện tham khảo</EditableText></p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl"><EditableText contentKey="facade.text.1">Bộ sưu tập mặt tiền đẹp</EditableText></h1><p className="mt-3 max-w-2xl text-base leading-7 text-[#3f5064]"><EditableText contentKey="facade.text.2">Khám phá ý tưởng theo đúng kích thước đất và nhu cầu gia đình. Mỗi mẫu đều có thể trao đổi với kiến trúc sư để điều chỉnh thành thiết kế riêng.</EditableText></p></div>
          </div>
        </div>
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
        <section className="mt-9 flex flex-col items-start justify-between gap-5 rounded-[24px] bg-[#073b74] p-7 text-white sm:flex-row sm:items-center sm:p-9"><div><h2 className="text-2xl font-extrabold"><EditableText contentKey="facade.text.3">Chưa tìm thấy mẫu phù hợp với đất của bạn?</EditableText></h2><p className="mt-2 text-white/85"><EditableText contentKey="facade.text.4">Gửi kích thước đất và nhu cầu, kiến trúc sư sẽ gợi ý phương án phù hợp.</EditableText></p></div><RequestActionButton requestType="design-consultation" targetType="catalog" targetId="custom-house-design" label="Nhận tư vấn thiết kế" title="Nhận tư vấn thiết kế riêng" description="Gửi thông tin khu đất, nhu cầu sử dụng và ngân sách dự kiến." className="flex shrink-0 items-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold"/></section>
      </main>
    </div>
  );
}
