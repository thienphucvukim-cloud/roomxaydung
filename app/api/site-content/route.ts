import { env } from "cloudflare:workers";
import { getSiteContent, type ContentValue } from "@/lib/site-content";
import { requireAdmin } from "@/lib/admin-auth";
import { validOrigin } from "@/lib/website-auth";

export async function GET() {
  return Response.json({ content: await getSiteContent() }, { headers: { "Cache-Control": "no-store" } });
}
export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;
  if (!validOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  try {
    const body = await request.json() as { changes?: { key: string; content: ContentValue | null }[] };
    if (!Array.isArray(body.changes) || !body.changes.length || body.changes.length > 100) return Response.json({ error: "Chọn từ 1 đến 100 mục để lưu." }, { status: 400 });
    const seen = new Set<string>();
    for (const change of body.changes) {
      if (!change || typeof change.key !== "string" || !/^[a-zA-Z0-9._-]{1,200}$/.test(change.key) || seen.has(change.key)) return Response.json({ error: "Mục chỉnh sửa không hợp lệ." }, { status: 400 });
      seen.add(change.key);
      if (change.content === null) continue;
      const content = change.content;
      if (!content || !["text", "image", "color"].includes(content.kind) || typeof content.value !== "string" || content.value.length > 5000) return Response.json({ error: "Nội dung không hợp lệ hoặc quá dài." }, { status: 400 });
      if (content.kind === "color" && !/^#[0-9a-f]{6}$/i.test(content.value)) return Response.json({ error: "Mã màu không hợp lệ." }, { status: 400 });
      if (content.kind === "image") {
        const url = new URL(content.value, request.url);
        if (url.username || url.password || content.value.length > 1024 || !(content.value.startsWith("/") && !content.value.startsWith("//") && !content.value.includes("\\") || url.protocol === "https:")) return Response.json({ error: "Ảnh cần là đường dẫn trên website hoặc URL HTTPS." }, { status: 400 });
        if (url.pathname === "/api/files") {
          const object = await env.BUCKET?.head(url.searchParams.get("key") || "");
          if (!object || object.customMetadata?.accessType !== "public" || !object.httpMetadata?.contentType?.startsWith("image/")) return Response.json({ error: "Ảnh không tồn tại hoặc không phải ảnh công khai." }, { status: 400 });
        }
      }
    }
    const now = new Date().toISOString();
    await env.DB!.batch(body.changes.map(change => change.content === null
      ? env.DB!.prepare("DELETE FROM website_content WHERE key = ?").bind(change.key)
      : env.DB!.prepare("INSERT INTO website_content (key, kind, value, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET kind=excluded.kind, value=excluded.value, updated_by=excluded.updated_by, updated_at=excluded.updated_at").bind(change.key, change.content.kind, change.content.value, admin.userId!, now)));
    return Response.json({ ok: true, content: await getSiteContent() }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Chưa thể lưu website. Vui lòng thử lại." }, { status: 500 }); }
}
