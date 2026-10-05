import decodeWebp, { init } from "@jsquash/webp/decode.js";
import wasm from "@jsquash/webp/codec/dec/webp_dec.wasm?module";
import jpeg from "jpeg-js";
import { decode as decodePng, convertIndexedToRgb } from "fast-png";
import { GifReader } from "omggif";
import { inspectWebp } from "./image-upload-policy";
import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from "./post-url";

type Pixels = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
let initialized: Promise<void> | undefined;
function checkSize(width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > 16_000_000) throw new Error("Unsupported preview dimensions");
}
async function decode(bytes: Uint8Array, type: string): Promise<Pixels> {
  if (type === "image/webp") {
    const info = inspectWebp(bytes);
    if (!info) throw new Error("Invalid WebP");
    checkSize(info.width, info.height);
    initialized ??= init(wasm);
    await initialized;
    return decodeWebp(Uint8Array.from(bytes).buffer);
  }
  if (type === "image/jpeg") return jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 16, maxMemoryUsageInMB: 96 });
  if (type === "image/gif") {
    const gif = new GifReader(bytes);
    checkSize(gif.width, gif.height);
    const data = new Uint8Array(gif.width * gif.height * 4);
    gif.decodeAndBlitFrameRGBA(0, data);
    return { width: gif.width, height: gif.height, data };
  }
  if (type === "image/png") {
    if (bytes.length < 24) throw new Error("Invalid PNG");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    checkSize(view.getUint32(16), view.getUint32(20));
    const png = decodePng(bytes);
    const input = png.palette ? convertIndexedToRgb(png) : png.data;
    const channels = png.palette ? png.palette[0].length : png.channels;
    const data = new Uint8Array(png.width * png.height * 4);
    const sample = (index: number) => input[index] / (!png.palette && png.depth === 16 ? 257 : 1);
    for (let i = 0; i < png.width * png.height; i++) {
      const p = i * channels, out = i * 4;
      data[out] = sample(p); data[out + 1] = sample(p + (channels >= 3 ? 1 : 0)); data[out + 2] = sample(p + (channels >= 3 ? 2 : 0));
      data[out + 3] = channels === 2 || channels === 4 ? sample(p + channels - 1) : 255;
    }
    return { width: png.width, height: png.height, data };
  }
  throw new Error("Unsupported preview format");
}
export async function createShareJpeg(bytes: Uint8Array, type: string) {
  const source = await decode(bytes, type);
  checkSize(source.width, source.height);
  const width = SHARE_IMAGE_WIDTH, height = SHARE_IMAGE_HEIGHT;
  // Fit the whole photo, including its watermark, inside the sharing frame.
  const scale = Math.min(width / source.width, height / source.height);
  const w = Math.max(1, Math.round(source.width * scale)), h = Math.max(1, Math.round(source.height * scale));
  const left = Math.floor((width - w) / 2), top = Math.floor((height - h) / 2);
  const data = new Uint8Array(width * height * 4); data.fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(source.width - 1, (x + 0.5) / scale - 0.5), sy = Math.min(source.height - 1, (y + 0.5) / scale - 0.5);
    const x0 = Math.max(0, Math.floor(sx)), y0 = Math.max(0, Math.floor(sy));
    const x1 = Math.min(source.width - 1, x0 + 1), y1 = Math.min(source.height - 1, y0 + 1);
    const dx = Math.max(0, sx - x0), dy = Math.max(0, sy - y0);
    const positions = [(y0 * source.width + x0) * 4, (y0 * source.width + x1) * 4, (y1 * source.width + x0) * 4, (y1 * source.width + x1) * 4];
    const weights = [(1 - dx) * (1 - dy), dx * (1 - dy), (1 - dx) * dy, dx * dy];
    const out = ((top + y) * width + left + x) * 4;
    for (let c = 0; c < 3; c++) {
      let value = 0;
      for (let i = 0; i < 4; i++) { const alpha = source.data[positions[i] + 3] / 255; value += (source.data[positions[i] + c] * alpha + 255 * (1 - alpha)) * weights[i]; }
      data[out + c] = Math.round(value);
    }
  }
  return new Uint8Array(jpeg.encode({ width, height, data }, 80).data);
}
