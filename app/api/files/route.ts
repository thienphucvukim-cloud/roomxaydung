import { env } from "cloudflare:workers";
import { currentUserId } from "../../../lib/member-identity";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { postAttachments, websiteContent } from "../../../db/schema";

const MAX_PUBLIC_FILE_SIZE = 25 * 1024 * 1024;
const MAX_PRIVATE_FILE_SIZE = 100 * 1024 * 1024;
const SAFE_INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DRAWING_EXTENSIONS = new Set(["dwg", "dxf", "skp", "rvt", "rfa", "pln", "zip", "rar", "7z", "pdf"]);
const BLOCKED_EXTENSIONS = new Set(["exe", "msi", "bat", "cmd", "com", "scr", "ps1", "js", "vbs", "jar", "dll"]);

function getBucket() {
  if (!env.BUCKET) throw new Error("Kho lưu trữ tệp chưa được cấu hình.");
  return env.BUCKET;
}

function extension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const uploadPurpose = formData.get("purpose");
    const purpose = uploadPurpose === "drawing-file" ? "private" : "public";
    if (!(file instanceof File)) return Response.json({ error: "Vui lòng chọn một tệp." }, { status: 400 });
    if (!file.size) return Response.json({ error: "Không thể tải tệp rỗng." }, { status: 400 });
    const ext = extension(file.name);
    if (BLOCKED_EXTENSIONS.has(ext)) return Response.json({ error: "Loại tệp này không được phép tải lên." }, { status: 415 });
    if (uploadPurpose === "drawing-preview" && !SAFE_INLINE_TYPES.has(file.type)) return Response.json({ error: "Ảnh đại diện phải là JPG, PNG, WebP hoặc GIF." }, { status: 400 });
    if (purpose === "private" && !DRAWING_EXTENSIONS.has(ext)) return Response.json({ error: "File bản vẽ phải là DWG, DXF, SKP, RVT, RFA, PLN, PDF, ZIP, RAR hoặc 7Z." }, { status: 415 });
    const maxSize = purpose === "private" ? MAX_PRIVATE_FILE_SIZE : MAX_PUBLIC_FILE_SIZE;
    if (file.size > maxSize) return Response.json({ error: `Mỗi tệp không được vượt quá ${maxSize / 1024 / 1024} MB.` }, { status: 413 });

    const key = crypto.randomUUID();
    const ownerUserId = await currentUserId();
    const type = file.type || "application/octet-stream";
    await getBucket().put(key, file.stream(), {
      httpMetadata: { contentType: type },
      customMetadata: { fileName: encodeURIComponent(file.name.slice(0, 240)), accessType: purpose, ownerUserId },
    });
    return Response.json({ attachment: { key, name: file.name, type, size: file.size, accessType: purpose, ...(purpose === "public" ? { url: "/api/files?key=" + encodeURIComponent(key) } : {}) } }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Không thể tải tệp lên.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(key)) return Response.json({ error: "Tệp không hợp lệ." }, { status: 400 });
    const object = await getBucket().get(key);
    if (!object) return Response.json({ error: "Không tìm thấy tệp." }, { status: 404 });
    if (object.customMetadata?.accessType === "private") return Response.json({ error: "File bản vẽ chỉ được tải bằng liên kết cấp sau khi mua." }, { status: 403 });

    const name = decodeURIComponent(object.customMetadata?.fileName || "tep-dinh-kem");
    const safeName = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    const contentType = headers.get("content-type") || "application/octet-stream";
    const inline = SAFE_INLINE_TYPES.has(contentType) && !url.searchParams.has("download");
    headers.set("etag", object.httpEtag);
    headers.set("content-length", String(object.size));
    headers.set("cache-control", "private, max-age=3600");
    headers.set("content-disposition", `${inline ? "inline" : "attachment"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    headers.set("x-content-type-options", "nosniff");
    headers.set("content-security-policy", "sandbox");
    return new Response(object.body, { headers });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Không thể đọc tệp.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(key)) return Response.json({ error: "Tệp không hợp lệ." }, { status: 400 });
    const object = await getBucket().head(key);
    if (!object) return Response.json({ error: "Không tìm thấy tệp." }, { status: 404 });
    if (object.customMetadata?.ownerUserId !== await currentUserId()) return Response.json({ error: "Bạn không có quyền xóa tệp này." }, { status: 403 });
    const [attached] = await getDb().select({ id: postAttachments.id }).from(postAttachments).where(eq(postAttachments.objectKey, key)).limit(1);
    if (attached) return Response.json({ error: "Tệp đang được sử dụng trong bài đăng." }, { status: 409 });
    const [usedOnWebsite] = await getDb().select({ key: websiteContent.key }).from(websiteContent).where(eq(websiteContent.value, "/api/files?key=" + key)).limit(1);
    if (usedOnWebsite) return Response.json({ error: "Ảnh đang được sử dụng trên website." }, { status: 409 });
    await getBucket().delete(key);
    return Response.json({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Không thể xóa tệp.";
    return Response.json({ error: message }, { status: 500 });
  }
}
