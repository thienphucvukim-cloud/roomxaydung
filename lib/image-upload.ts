import { IMAGE_UPLOAD_LIMITS, webpFileName, type ImageUploadKind } from "./image-upload-policy";

const MAX_SOURCE_SIZE = 25 * 1024 * 1024;

function encodeWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/webp") {
        reject(new Error("Trình duyệt chưa hỗ trợ chuyển ảnh sang WebP. Vui lòng dùng trình duyệt mới hơn."));
        return;
      }
      resolve(blob);
    }, "image/webp", quality);
  });
}

/** Optimize images locally before uploading; documents pass through unchanged. */
export async function optimizeImageForUpload(file: File, kind: ImageUploadKind = "post"): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (!file.size) throw new Error("Không thể tải ảnh rỗng.");
  if (file.size > MAX_SOURCE_SIZE) throw new Error("Ảnh gốc không được vượt quá 25 MB.");
  const { maxEdge, maxBytes } = IMAGE_UPLOAD_LIMITS[kind];

  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement("canvas");
  try {
    image.src = sourceUrl;
    try {
      await image.decode();
    } catch {
      throw new Error("Không thể đọc ảnh. Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF hợp lệ.");
    }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Ảnh không có kích thước hợp lệ.");

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không thể xử lý ảnh trên trình duyệt này.");
    let scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const draw = () => {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      // The browser applies EXIF orientation. Animated images become a still image.
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    draw();

    let result = await encodeWebp(canvas, 0.7);
    for (const quality of [0.6, 0.5]) {
      if (result.size <= maxBytes) break;
      const smaller = await encodeWebp(canvas, quality);
      if (smaller.size < result.size) result = smaller;
    }
    while (result.size > maxBytes) {
      if (canvas.width === 1 && canvas.height === 1) throw new Error("Không thể giảm dung lượng ảnh. Vui lòng chọn ảnh khác.");
      scale *= 0.8;
      draw();
      result = await encodeWebp(canvas, 0.5);
    }

    return new File([result], webpFileName(file.name), { type: "image/webp", lastModified: file.lastModified });
  } finally {
    URL.revokeObjectURL(sourceUrl);
    image.src = "";
    canvas.width = 0;
    canvas.height = 0;
  }
}
