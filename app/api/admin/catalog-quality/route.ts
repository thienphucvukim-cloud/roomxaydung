import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { catalogQualityFlags, posts } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { validOrigin } from "@/lib/website-auth";
import { QUALITY_CATEGORIES } from "@/lib/catalog-quality";
import { houseModels } from "@/lib/house-models";
import { drawings } from "@/lib/drawing-catalog";
import { getSiteContent } from "@/lib/site-content";

const headers = { "Cache-Control": "private, no-store" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  try {
    const flags = await getDb().select({ targetType: catalogQualityFlags.targetType, targetId: catalogQualityFlags.targetId }).from(catalogQualityFlags);
    return reply({ flags });
  } catch { return reply({ error: "Chưa thể tải đánh giá ngầm." }, 500); }
}
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  if (!validOrigin(request)) return reply({ error: "Nguồn yêu cầu không hợp lệ." }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return reply({ error: "Dữ liệu đánh giá không hợp lệ." }, 400); }
  try {
    if (!body || Array.isArray(body) || Object.keys(body).some(key => !["targetType", "targetId", "lowQuality"].includes(key)) ||
      (body.targetType !== "post" && body.targetType !== "demo") || typeof body.targetId !== "string" || typeof body.lowQuality !== "boolean") return reply({ error: "Đánh giá không hợp lệ." }, 400);
    const db = getDb(), targetType = body.targetType as "post" | "demo", targetId = body.targetId;
    if (targetType === "post") {
      if (!/^[1-9]\d*$/.test(targetId) || !Number.isSafeInteger(Number(targetId))) return reply({ error: "Mã bài đăng không hợp lệ." }, 400);
      const [post] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, Number(targetId)), inArray(posts.category, QUALITY_CATEGORIES), inArray(posts.audience, ["Công khai", "Ẩn bởi quản trị", "Chỉ mình tôi"]))).limit(1);
      if (!post) return reply({ error: "Không tìm thấy bài có thể đánh giá." }, 404);
    } else {
      const match = /^(facade|drawing)\.(\d+)$/.exec(targetId);
      if (!match || Number(match[2]) >= (match[1] === "facade" ? houseModels.length : drawings.length) || targetId !== `${match[1]}.${Number(match[2])}`) return reply({ error: "Mã bài demo không hợp lệ." }, 400);
      const content = await getSiteContent();
      if (content[`${targetId}.visibility`]?.value === "deleted") return reply({ error: "Bài demo đã bị xóa." }, 404);
    }
    const condition = and(eq(catalogQualityFlags.targetType, targetType), eq(catalogQualityFlags.targetId, targetId));
    if (body.lowQuality) await db.insert(catalogQualityFlags).values({ targetType, targetId, reviewedBy: admin.userId!, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: [catalogQualityFlags.targetType, catalogQualityFlags.targetId], set: { reviewedBy: admin.userId!, updatedAt: new Date().toISOString() } });
    else await db.delete(catalogQualityFlags).where(condition);
    return reply({ ok: true });
  } catch { return reply({ error: "Chưa thể lưu đánh giá ngầm. Vui lòng thử lại." }, 500); }
}
