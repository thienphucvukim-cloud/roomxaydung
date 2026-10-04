export const IMAGE_UPLOAD_LIMITS = {
  post: { maxEdge: 1600, maxBytes: 512 * 1024 },
  comment: { maxEdge: 1280, maxBytes: 256 * 1024 },
  avatar: { maxEdge: 512, maxBytes: 96 * 1024 },
} as const;
export type ImageUploadKind = keyof typeof IMAGE_UPLOAD_LIMITS;

function fourCC(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

// Inspect RIFF chunks and dimensions without an image decoder in the Worker.
// The browser encoder supplies a single still frame, without source metadata.
export function inspectWebp(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 26 || fourCC(bytes, 0) !== "RIFF" || fourCC(bytes, 8) !== "WEBP") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) return null;
  let canvas: { width: number; height: number } | undefined;
  let frame: { width: number; height: number } | undefined;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) return null;
    const chunk = fourCC(bytes, offset), size = view.getUint32(offset + 4, true), start = offset + 8;
    const end = start + size + (size % 2);
    if (end > bytes.length || (size % 2 && bytes[end - 1] !== 0)) return null;
    if (chunk === "ANIM" || chunk === "ANMF") return null;
    if (chunk === "VP8X") {
      if (offset !== 12 || canvas || size !== 10 || (bytes[start] & 2)) return null;
      const uint24 = (at: number) => bytes[at] + bytes[at + 1] * 256 + bytes[at + 2] * 65536;
      canvas = { width: uint24(start + 4) + 1, height: uint24(start + 7) + 1 };
    } else if (chunk === "VP8 ") {
      if (frame || size < 10 || (bytes[start] & 1) || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) return null;
      frame = { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
    } else if (chunk === "VP8L") {
      if (frame || size < 5 || bytes[start] !== 0x2f) return null;
      const bits = view.getUint32(start + 1, true);
      if (bits >>> 29) return null;
      frame = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    offset = end;
  }
  if (!frame?.width || !frame.height || (canvas && (canvas.width !== frame.width || canvas.height !== frame.height))) return null;
  return frame;
}

export async function isImageUpload(file: File) {
  if (file.type.startsWith("image/") || /\.(?:jpe?g|jfif|png|webp|gif|bmp|svg|avif|heic|heif|tiff?|ico)$/i.test(file.name)) return true;
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return (bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (bytes[0] === 0x89 && fourCC(bytes, 1) === "PNG\r") ||
    fourCC(bytes, 0) === "GIF8" || (fourCC(bytes, 0) === "RIFF" && fourCC(bytes, 8) === "WEBP");
}

export async function validateOptimizedImage(file: File, kind: ImageUploadKind = "post") {
  const limits = IMAGE_UPLOAD_LIMITS[kind];
  if (file.type !== "image/webp") return { status: 415, error: "Ảnh phải được nén và chuyển sang WebP trước khi tải lên. Vui lòng tải lại trang rồi chọn ảnh." };
  if (!file.size || file.size > limits.maxBytes) return { status: 413, error: `Ảnh sau khi nén không được vượt quá ${limits.maxBytes / 1024} KB.` };
  const dimensions = inspectWebp(new Uint8Array(await file.arrayBuffer()));
  if (!dimensions) return { status: 400, error: "Tệp WebP không hợp lệ hoặc chưa được chuyển thành ảnh tĩnh." };
  if (Math.max(dimensions.width, dimensions.height) > limits.maxEdge) return { status: 413, error: `Cạnh dài nhất của ảnh không được vượt quá ${limits.maxEdge} px.` };
  return null;
}

export function webpFileName(name: string) {
  return `${name.replace(/\.[^.]+$/, "").slice(0, 230) || "anh"}.webp`;
}

export function optimizedImageMetadata(kind: ImageUploadKind) {
  return { imageOptimized: "webp-v1", imageMaxEdge: String(IMAGE_UPLOAD_LIMITS[kind].maxEdge) };
}

export function isOptimizedImageObject(object: { size: number; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }, kind: ImageUploadKind = "post") {
  const maxEdge = Number(object.customMetadata?.imageMaxEdge);
  return object.httpMetadata?.contentType === "image/webp" && object.customMetadata?.imageOptimized === "webp-v1" &&
    object.size > 0 && object.size <= IMAGE_UPLOAD_LIMITS[kind].maxBytes && Number.isSafeInteger(maxEdge) && maxEdge > 0 && maxEdge <= IMAGE_UPLOAD_LIMITS[kind].maxEdge;
}
