import { postCategoryLabel } from "@/lib/site-sections";
import { houseModelContentKey } from "@/lib/legacy-contracts";
import { POST_CATEGORIES } from "@/lib/legacy-contracts";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { posts } from "../../../db/schema";
import { houseModels } from "../../../lib/house-models";
import { drawings } from "../../../lib/drawing-catalog";
import { catalogPageHref } from "../../../lib/catalog-pagination";
import { getSiteContent } from "../../../lib/site-content";
import { demoPostVisible } from "../../../lib/demo-posts";

const resources = [
  { title: "Mẫu nhà đẹp", copy: "Thư viện mẫu nhà phố, nhà vườn và thiết kế hiện đại.", href: "/kho-mau-nha-dep-chat", type: "Danh mục" },
  { title: "Mặt bằng công năng", copy: "Mặt bằng tham khảo theo chiều ngang, số tầng và nhu cầu.", href: "/mat-bang-cong-nang", type: "Danh mục" },
  { title: "Kho bản vẽ", copy: "Bản vẽ CAD, hồ sơ thi công và tài liệu xây dựng.", href: "/file-ban-ve-nha-dep-chat", type: "Danh mục" },
  { title: "Nội thất", copy: "Hồ sơ thiết kế nội thất, bản vẽ CAD và file 3D cho không gian sống.", href: "/noi-that", type: "Danh mục" },
  { title: "Hỏi chuyên gia", copy: "Gửi câu hỏi về kiến trúc, kết cấu, dự toán và thi công.", href: "/hoi-chuyen-gia", type: "Dịch vụ" },
  { title: "Tính vật tư xây dựng", copy: "Tính khối lượng bê tông, xây tường, trát, lát gạch và sơn nước.", href: "/tinh-vat-tu-nha-dep-chat", type: "Công cụ" },
  { title: "Cẩm nang xây nhà", copy: "Kiến thức chuẩn bị ngân sách, hợp đồng và nghiệm thu.", href: "/cam-nang", type: "Nội dung" },
];

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) || "";
  if (!query) return Response.json({ results: [] });
  const normalized = query.toLocaleLowerCase("vi");
  const content = await getSiteContent();
  const catalog = [
    ...resources,
    ...houseModels.flatMap((model, index) => demoPostVisible(content, houseModelContentKey(index)) ? [{ title: content[houseModelContentKey(index, "title")]?.value ?? model.title, copy: `${content[houseModelContentKey(index, "meta")]?.value ?? model.meta} · ${content[houseModelContentKey(index, "style")]?.value ?? model.style} · ${model.authorName}`, href: catalogPageHref("/kho-mau-nha-dep-chat", 1, model.title), type: "Mẫu nhà đẹp" }] : []),
    ...drawings.flatMap((drawing, index) => demoPostVisible(content, `drawing.${index}`) ? [{ title: content[`drawing.${index}.title`]?.value ?? drawing.title, copy: `${content[`drawing.${index}.style`]?.value ?? drawing.category} · ${drawing.price} · ${drawing.authorName}`, href: catalogPageHref("/file-ban-ve-nha-dep-chat", 1, drawing.title), type: "Bản vẽ" }] : []),
  ].filter(item => `${item.title} ${item.copy}`.toLocaleLowerCase("vi").includes(normalized));
  try {
    const matchedPosts = await getDb().select().from(posts).where(and(
      ne(posts.category, POST_CATEGORIES.modelDiscussion),
      eq(posts.audience, "Công khai"),
      or(...[posts.title, posts.content, posts.authorName, posts.listingType, posts.specifications].map(column => sql`instr(lower(coalesce(${column}, '')), lower(${query})) > 0`)),
    )).orderBy(desc(posts.createdAt), desc(posts.id)).limit(50);
    const memberResults = matchedPosts.map(post => ({
      title: post.title, copy: `${post.authorName} · ${post.content}`, type: postCategoryLabel(post.category),
      href: catalogPageHref(post.category === POST_CATEGORIES.drawings ? "/file-ban-ve-nha-dep-chat" : post.category === POST_CATEGORIES.interiors ? "/noi-that" : "/kho-mau-nha-dep-chat", 1, post.title),
    }));
    return Response.json({ results: [...memberResults, ...catalog] });
  } catch {
    return Response.json({ results: catalog, warning: "Chưa thể tìm trong bài đăng cộng đồng. Vui lòng thử lại." });
  }
}
