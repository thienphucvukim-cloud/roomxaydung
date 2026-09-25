import { env } from "cloudflare:workers";

const MAX_PUBLIC_FILE_SIZE = 25 * 1024 * 1024;
const MAX_PRIVATE_FILE_SIZE = 100 * 1024 * 1024;

function getBucket() {
  if (!env.BUCKET) throw new Error("Kho lưu trữ tệp chưa được cấu hình.");
  return env.BUCKET;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const uploadPurpose = formData.get("purpose");
    const purpose = uploadPurpose === "drawing-file" ? "private" : "public";
    if (!(file instanceof File)) return Response.json({ error: "Vui lòng chọn một tệp." }, { status: 400 });
    if (!file.size) return Response.json({ error: "Không thể tải tệp rỗng." }, { status: 400 });
    if (uploadPurpose === "drawing-preview" && !file.type.startsWith("image/")) return Response.json({ error: "Ảnh đại diện phải là tệp hình ảnh." }, { status: 400 });
    const maxSize = purpose === "private" ? MAX_PRIVATE_FILE_SIZE : MAX_PUBLIC_FILE_SIZE;
    if (file.size > maxSize) return Response.json({ error: `Mỗi tệp không được vượt quá ${maxSize / 1024 / 1024} MB.` }, { status: 413 });

    const key = crypto.randomUUID();
    const type = file.type || "application/octet-stream";
    await getBucket().put(key, file.stream(), {
      httpMetadata: { contentType: type },
      customMetadata: { fileName: encodeURIComponent(file.name), accessType: purpose },
    });

    return Response.json({
      attachment: {
        key,
        name: file.name,
        type,
        size: file.size,
        accessType: purpose,
        ...(purpose === "public" ? { url: "/api/files?key=" + encodeURIComponent(key) } : {}),
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tải tệp lên.";
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
    if (object.customMetadata?.accessType === "private") return Response.json({ error: "File bản vẽ chỉ được tải bằng liên kết được cấp sau thanh toán." }, { status: 403 });

    const name = decodeURIComponent(object.customMetadata?.fileName || "tep-dinh-kem");
    const safeName = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("content-length", String(object.size));
    headers.set("cache-control", "private, max-age=3600");
    headers.set("content-disposition", (url.searchParams.has("download") ? "attachment" : "inline") + "; filename=\"" + safeName + "\"; filename*=UTF-8''" + encodeURIComponent(name));
    return new Response(object.body, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể đọc tệp.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(key)) return Response.json({ error: "Tệp không hợp lệ." }, { status: 400 });
    const object = await getBucket().head(key);
    if (object?.customMetadata?.accessType === "private") return Response.json({ error: "Không thể xóa file bản vẽ qua API công khai." }, { status: 403 });
    await getBucket().delete(key);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể xóa tệp.";
    return Response.json({ error: message }, { status: 500 });
  }
}