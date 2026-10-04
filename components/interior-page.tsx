import { EditableText } from "@/components/site-editor";
import { FileCatalog } from "@/components/file-catalog";
import { EditorialContent } from "@/components/editorial-content";
import type { FileCatalogSort } from "@/lib/file-catalog-sort";



export function InteriorPage({ page = 1, query = "", targetPostId, sort = "latest" }: { page?: number; query?: string; targetPostId?: string; sort?: FileCatalogSort }) {
  return <main className="mx-auto max-w-[1320px] px-4 py-5 lg:px-8">
    <FileCatalog key={`${page}:${query}:${targetPostId ?? ""}:${sort}`} variant="interior" page={page} searchQuery={query} targetPostId={targetPostId} sort={sort} />
    <section className="mt-9">
      <p className="text-sm font-extrabold uppercase tracking-[.13em] text-[#229ed9]"><EditableText contentKey="interior.text.0">Thư viện nội thất</EditableText></p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] text-[#0b2e59] sm:text-4xl"><EditableText contentKey="interior.text.1">Kho thiết kế nội thất từ cộng đồng</EditableText></h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-[#3f5064]"><EditableText contentKey="interior.text.2">Khám phá, mua và tải hồ sơ nội thất phòng khách, phòng ngủ, bếp cùng bản vẽ CAD và file 3D phục vụ thi công.</EditableText></p>
    </section>
    <EditorialContent
      eyebrow="KIỂM TRA HỒ SƠ NỘI THẤT"
      title="Chuẩn bị gì trước khi chọn hồ sơ thiết kế nội thất?"
      intro="Đối chiếu thiết kế với không gian thực tế và kiểm tra các file đi kèm để lựa chọn hồ sơ phù hợp với nhu cầu của bạn."
      sections={[
        { title: "Kích thước và công năng", paragraphs: ["Kiểm tra diện tích phòng, vị trí cửa, chiều cao trần và lối đi. Bố trí đồ nội thất cần phù hợp với số người sử dụng và thói quen sinh hoạt."] },
        { title: "Vật liệu và chi tiết thi công", paragraphs: ["Xem danh mục vật liệu, kích thước đồ nội thất, chi tiết lắp đặt và bố trí điện, chiếu sáng. Trao đổi với người đăng về các phần hồ sơ chưa rõ trước khi mua."] },
        { title: "Định dạng và quyền sử dụng", paragraphs: ["Xác nhận phiên bản CAD, SketchUp hoặc phần mềm 3D, thư viện và texture đi kèm. Kiểm tra quyền chỉnh sửa và điều kiện sử dụng của hồ sơ."] },
      ]}
      checklist={["Đo lại kích thước không gian", "Xem danh mục file trước khi mua", "Kiểm tra vật liệu và ngân sách", "Xác nhận phiên bản phần mềm"]}
    />
  </main>;
}
