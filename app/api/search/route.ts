import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { posts } from "../../../db/schema";
import { facadeModels } from "../../../lib/facade-catalog";
import { drawings } from "../../../lib/drawing-catalog";
import { catalogPageHref } from "../../../lib/catalog-pagination";

const resources = [
  { title: "Mẫu nhà đẹp", copy: "Thư viện mẫu nhà phố, nhà vườn và thiết kế hiện đại.", href: "/kho-mau-nha-dep-tipook", type: "Danh mục" },
  { title: "Mặt bằng công năng", copy: "Mặt bằng tham khảo theo chiều ngang, số tầng và nhu cầu.", href: "/mat-bang-cong-nang", type: "Danh mục" },
  { title: "Kho bản vẽ", copy: "Bản vẽ CAD, hồ sơ thi công và tài liệu xây dựng.", href: "/file-ban-ve-nha-dep-tipook", type: "Danh mục" },
  { title: "Nội thất", copy: "Hồ sơ thiết kế nội thất, bản vẽ CAD và file 3D cho không gian sống.", href: "/noi-that", type: "Danh mục" },
  { title: "Tư vấn", copy: "Gửi câu hỏi về kiến trúc, kết cấu, dự toán và thi công.", href: "/hoi-chuyen-gia", type: "Dịch vụ" },
  { title: "Tính vật tư xây dựng", copy: "Tính khối lượng bê tông, xây tường, trát, lát gạch và sơn nước.", href: "/tinh-vat-tu-tipook", type: "Công cụ" },
  { title: "Cẩm nang xây nhà", copy: "Kiến thức chuẩn bị ngân sách, hợp đồng và nghiệm thu.", href: "/cam-nang", type: "Nội dung" },
];

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) || "";
  if (!query) return Response.json({ results: [] });
  const normalized = query.toLocaleLowerCase("vi");
  const catalog = [
    ...resources,
    ...facadeModels.map(model => ({ title: model.title, copy: `${model.meta} · ${model.style} · ${model.authorName}`, href: catalogPageHref("/kho-mau-nha-dep-tipook", 1, model.title), type: "Mặt tiền" })),
    ...drawings.map(drawing => ({ title: drawing.title, copy: `${drawing.category} · ${drawing.price} · ${drawing.authorName}`, href: catalogPageHref("/file-ban-ve-nha-dep-tipook", 1, drawing.title), type: "Bản vẽ" })),
  ].filter(item => `${item.title} ${item.copy}`.toLocaleLowerCase("vi").includes(normalized));
  try {
    const matchedPosts = await getDb().select().from(posts).where(and(
      ne(posts.category, "Thảo luận mẫu nhà"),
      eq(posts.audience, "Công khai"),
      or(...[posts.title, posts.content, posts.authorName, posts.feeling, posts.location].map(column => sql`instr(lower(coalesce(${column}, '')), lower(${query})) > 0`)),
    )).orderBy(desc(posts.createdAt), desc(posts.id)).limit(50);
    const community = matchedPosts.map(post => ({
      title: post.title, copy: `${post.authorName} · ${post.content}`, type: post.category,
      href: catalogPageHref(post.category === "Bản vẽ cộng đồng" ? "/file-ban-ve-nha-dep-tipook" : post.category === "Nội thất cộng đồng" ? "/noi-that" : "/kho-mau-nha-dep-tipook", 1, post.title),
    }));
    return Response.json({ results: [...community, ...catalog] });
  } catch {
    return Response.json({ results: catalog, warning: "Chưa thể tìm trong bài đăng cộng đồng. Vui lòng thử lại." });
  }
}
