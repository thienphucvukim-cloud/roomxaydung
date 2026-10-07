import { env } from "cloudflare:workers";
import { getSiteContent, type ContentValue } from "@/lib/site-content";
import { requireAdmin } from "@/lib/admin-auth";
import { validOrigin } from "@/lib/website-auth";
import { CATALOG_PRICE_ERROR, normalizeCatalogPrice } from "@/lib/catalog-price";

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
    const current = await getSiteContent();
    for (const change of body.changes) {
      if (!change || typeof change.key !== "string" || !/^[a-zA-Z0-9._-]{1,200}$/.test(change.key) || seen.has(change.key)) return Response.json({ error: "Mục chỉnh sửa không hợp lệ." }, { status: 400 });
      seen.add(change.key);
      const prefix = change.key.match(/^(facade|house|drawing|interior)\.[\w-]+\./)?.[0];
      if (prefix && current[`${prefix}visibility`]?.value === "deleted") return Response.json({ error: "Bài demo đã xóa vĩnh viễn, không thể chỉnh sửa hoặc khôi phục." }, { status: 409 });
      if (change.content === null) continue;
      const content = change.content;
      if (!content || !["text", "image", "color"].includes(content.kind) || typeof content.value !== "string" || content.value.length > 5000) return Response.json({ error: "Nội dung không hợp lệ hoặc quá dài." }, { status: 400 });
      if (/^drawing\.\d+\.price$/.test(change.key)) {
        const price = normalizeCatalogPrice(content.value);
        if (content.kind !== "text" || price === null) return Response.json({ error: CATALOG_PRICE_ERROR }, { status: 400 });
        change.content = { kind: "text", value: price };
      }
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
    const deletedPrefixes = body.changes.filter(change => change.key.endsWith(".visibility") && change.content?.value === "deleted").map(change => change.key.slice(0, -10));
    const changes = body.changes.filter(change => !deletedPrefixes.some(prefix => change.key.startsWith(prefix) && change.key !== `${prefix}visibility`));
    await env.DB!.batch([...deletedPrefixes.map(prefix => env.DB!.prepare("DELETE FROM website_content WHERE substr(key, 1, ?) = ? AND key != ?").bind(prefix.length, prefix, `${prefix}visibility`)), ...changes.map(change => change.content === null
      ? env.DB!.prepare("DELETE FROM website_content WHERE key = ? AND NOT (key LIKE '%.visibility' AND value = 'deleted')").bind(change.key)
      : env.DB!.prepare("INSERT INTO website_content (key, kind, value, updated_by, updated_at) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM website_content marker WHERE marker.value = 'deleted' AND marker.key LIKE '%.visibility' AND substr(?, 1, length(marker.key) - 10) = substr(marker.key, 1, length(marker.key) - 10)) ON CONFLICT(key) DO UPDATE SET kind=excluded.kind, value=excluded.value, updated_by=excluded.updated_by, updated_at=excluded.updated_at").bind(change.key, change.content.kind, change.content.value, admin.userId!, now, change.key))]);
    return Response.json({ ok: true, content: await getSiteContent() }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Chưa thể lưu website. Vui lòng thử lại." }, { status: 500 }); }
}
