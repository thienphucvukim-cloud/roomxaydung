import { desc } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { posts } from "../../../db/schema";

export async function GET() {
  try {
    const rows = await getDb().select().from(posts).orderBy(desc(posts.createdAt), desc(posts.id)).limit(30);
    return Response.json({ posts: rows });
  } catch {
    return Response.json({ posts: [] });
  }
}

export async function POST(request: Request) {
  try {
    const h = await headers();
    const userId = h.get("oai-authenticated-user-id");
    const email = h.get("oai-authenticated-user-email");
    const encodedName = h.get("oai-authenticated-user-full-name");
    const authorName = encodedName && h.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8" ? decodeURIComponent(encodedName) : email?.split("@")[0] ?? "Thành viên mới";
    const body = await request.json() as { title?: string; content?: string; category?: string; location?: string };
    const title = body.title?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    if (!title || !content) return Response.json({ error: "Vui lòng nhập tiêu đề và nội dung." }, { status: 400 });
    if (title.length > 120 || content.length > 1200) return Response.json({ error: "Nội dung vượt quá độ dài cho phép." }, { status: 400 });
    const [post] = await getDb().insert(posts).values({ userId: userId ?? "private-member", authorName, category: body.category || "Chuẩn bị xây", title, content, location: body.location?.trim() || null }).returning();
    return Response.json({ post }, { status: 201 });
  } catch {
    return Response.json({ error: "Chưa thể đăng bài lúc này. Vui lòng thử lại." }, { status: 500 });
  }
}
