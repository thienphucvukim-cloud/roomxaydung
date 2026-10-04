import { EditableImage, EditableText } from "@/components/site-editor";
import { DemoPostBadge } from "@/components/demo-post-badge";
import { DemoPostControls } from "@/components/demo-post-controls";
import { ArrowDownToLine, Eye, FileText } from "lucide-react";
import { CatalogEngagementStats } from "@/components/catalog-engagement";
import { EditorialContent } from "@/components/editorial-content";
import { ProjectGallery } from "@/components/project-gallery";
import { FileCatalog, type FileCatalogInitialData } from "@/components/file-catalog";
import { CatalogPublishButton, RequestActionButton, ShareActionButton, ToggleActionButton } from "@/components/interactive-actions";
import { PurchaseActionButton } from "@/components/purchase-action-button";
import { drawings } from "@/lib/drawing-catalog";
import { modelAuthAnchor } from "@/lib/action-auth-return";
import type { FileCatalogSort } from "@/lib/file-catalog-sort";
import { publicCatalog } from "@/lib/seo-data";
import { POST_CATEGORIES } from "@/lib/legacy-contracts";
import { getSiteContent } from "@/lib/site-content";
import { demoPostVisible } from "@/lib/demo-posts";




export async function DrawingFilesPage({ page = 1, query = "", targetPostId, sort = "latest" }: { page?: number; query?: string; targetPostId?: string; sort?: FileCatalogSort }) {
  const params = new URLSearchParams({ category: POST_CATEGORIES.drawings, page: String(page), q: query });
  if (targetPostId) params.set("postId", targetPostId);
  if (sort !== "latest") {
    const content = await getSiteContent(), normalized = query.toLocaleLowerCase("vi");
    const keys = targetPostId ? [] : drawings.filter((drawing, index) => {
      const prefix = `drawing.${index}`;
      const search = `${drawing.title} ${drawing.category} ${drawing.price} ${drawing.authorName} ${drawing.isDemo ? "demo bài demo" : ""}`;
      return demoPostVisible(content, prefix) && (!normalized || [search, ...Object.entries(content).filter(([key]) => key.startsWith(prefix + ".")).map(([, item]) => item.value)].join(" ").toLocaleLowerCase("vi").includes(normalized));
    }).map(drawing => drawing.title);
    params.set("sort", sort); params.set("modelKeys", JSON.stringify(keys));
  }
  const initialData = await publicCatalog<FileCatalogInitialData>(params);
  return <main className="drawing-files-page mx-auto max-w-[1320px] px-4 py-5 lg:px-8">
    <FileCatalog initialData={initialData} key={`${page}:${query}:${targetPostId ?? ""}:${sort}`} page={page} searchQuery={query} targetPostId={targetPostId} sort={sort} catalogCards={drawings.map((drawing, index) => ({
      key: drawing.title,
      contentPrefix: `drawing.${index}`,
      search: `${drawing.title} ${drawing.category} ${drawing.price} ${drawing.authorName} ${drawing.isDemo ? "demo bài demo" : ""}`,
      card: (<article key={drawing.title} id={modelAuthAnchor(drawing.title)} data-auth-model-query={drawing.title} data-drawing-search={`${drawing.title} ${drawing.category} ${drawing.price}`} className="group flex h-full min-w-0 scroll-mt-24 flex-col"><div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-lg bg-[#f7f9fc]"><EditableImage contentKey={`drawing.${index}.image`} src={drawing.image} alt={drawing.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/><ToggleActionButton actionType="save" targetType="drawing" targetId={drawing.title} label="Lưu bản vẽ" activeLabel="Đã lưu" icon="heart" className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full bg-white/90 text-[#3f5064] opacity-0 shadow-sm transition group-hover:opacity-100 [&>span]:sr-only"/><ProjectGallery model={{ title: drawing.title, meta: `${drawing.price} · ${drawing.downloads} lượt tải`, style: drawing.category, image: drawing.image, editableKey: `drawing.${index}`, isDemo: drawing.isDemo }} trigger="overlay" engagementTarget={{ targetType: "drawing", targetId: drawing.title }}/></div><div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#3f5064]"><span className="truncate text-[#147aa8]"><EditableText contentKey={`drawing.${index}.style`}>{drawing.category}</EditableText></span><span className="flex shrink-0 items-center gap-2"><span className="flex items-center gap-1"><Eye size={14}/>{drawing.views}</span><span className="flex items-center gap-1"><ArrowDownToLine size={14}/>{drawing.downloads}</span></span></div><div className="mt-2"><DemoPostBadge isDemo={drawing.isDemo}/></div><h2 className="catalog-card-title mt-2 line-clamp-2 min-h-12 text-base font-bold leading-6 text-[#1d3429]"><EditableText contentKey={`drawing.${index}.title`}>{drawing.title}</EditableText></h2><p className="catalog-card-author mt-1 text-xs text-[#66778a]">Đăng bởi <a href={`/nguoi-dung/${drawing.authorId}`} className="font-semibold text-[#0b2e59] hover:text-[#229ed9] hover:underline">{drawing.authorName}</a></p><DemoPostControls prefix={`drawing.${index}`} title={drawing.title} style={drawing.category} image={drawing.image}/><CatalogEngagementStats targetType="drawing" targetId={drawing.title} mode="rating"/><div className="mt-auto flex items-center justify-between pt-3"><strong className="text-base text-[#229ed9]">{drawing.price}</strong><span className="flex shrink-0 items-center gap-1.5"><ShareActionButton title={drawing.title} url={`/file-ban-ve-nha-dep-chat/page/1?q=${encodeURIComponent(drawing.title)}`} targetType="drawing" targetId={drawing.title} iconOnly className="grid size-9 place-items-center rounded-full border border-[#cfeaf5] bg-[#f1faff] text-[#168ac0] transition hover:border-[#229ed9] hover:bg-[#e2f5fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168ac0] disabled:opacity-50"/><RequestActionButton requestType="drawing-file-request" targetType="drawing" targetId={drawing.title} label="Yêu cầu file" title={"Yêu cầu file: " + drawing.title} description="Chúng tôi sẽ nhận yêu cầu và liên hệ để cung cấp thông tin về phạm vi, định dạng và phiên bản của file." recipientUserId={drawing.authorId} iconOnly="file" className="grid size-9 place-items-center rounded-full border border-[#cfeaf5] bg-[#f1faff] text-[#168ac0] transition hover:border-[#229ed9] hover:bg-[#e2f5fc]"/><PurchaseActionButton targetType="drawing" targetId={drawing.title} title={drawing.title} price={drawing.price} className="grid size-9 place-items-center rounded-full bg-[#229ed9] text-white transition hover:bg-[#168ac0]"/></span></div></article>),
    }))} />
    <section className="mt-9">
      <p className="text-sm font-extrabold uppercase tracking-[.13em] text-[#229ed9]"><EditableText contentKey="drawing.text.0">Thư viện bản vẽ</EditableText></p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] text-[#0b2e59] sm:text-4xl"><EditableText contentKey="drawing.text.1">Kho bản vẽ từ kỹ sư và kiến trúc sư</EditableText></h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-[#3f5064]"><EditableText contentKey="drawing.text.2">Khám phá, mua và tải file CAD, hồ sơ thiết kế, SketchUp cùng các tài liệu phục vụ thi công.</EditableText></p>
    </section>
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
        <section className="mt-10 grid gap-5 rounded-[24px] border border-[#e3eaf2] bg-white p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-8"><span className="grid size-12 place-items-center rounded-full bg-[#eef9fd] text-[#229ed9]"><FileText size={24}/></span><div><h2 className="text-xl font-extrabold"><EditableText contentKey="drawing.text.3">Bạn là kỹ sư hoặc kiến trúc sư?</EditableText></h2><p className="mt-1 text-[#3f5064]"><EditableText contentKey="drawing.text.4">Đăng file bản vẽ, thiết lập giá bán và tiếp cận cộng đồng đang chuẩn bị xây nhà.</EditableText></p></div><CatalogPublishButton className="flex items-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold text-white"/></section>
  </main>;
}
