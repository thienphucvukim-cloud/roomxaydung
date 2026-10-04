const SAFE_INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// This read path must stay independent of React, identity and database modules.
// Public previews are requested in parallel; private drawings stay behind the
// separate purchase/download flow, even when their object key is known.
async function publicFileResponse(request: Request, bucket?: R2Bucket) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(key)) return Response.json({ error: "Tệp không hợp lệ." }, { status: 400 });
    if (!bucket) throw new Error("Kho lưu trữ tệp chưa được cấu hình.");
    let object: R2Object | null;
    let body: ReadableStream | null = null;
    if (request.method === "HEAD") object = await bucket.head(key);
    else {
      const download = await bucket.get(key);
      object = download;
      body = download?.body ?? null;
    }
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
    return new Response(body, { headers });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Không thể đọc tệp.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function readPublicFile(request: Request, bucket?: R2Bucket) {
  const response = await publicFileResponse(request, bucket);
  return request.method === "HEAD"
    ? new Response(null, { status: response.status, headers: response.headers })
    : response;
}
