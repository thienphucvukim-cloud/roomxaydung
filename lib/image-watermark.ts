import { POST_CATEGORIES } from "./legacy-contracts";

export function shouldWatermarkPostImages(category: string) {
  return category === POST_CATEGORIES.houseModels || category === POST_CATEGORIES.drawings || category === POST_CATEGORIES.interiors;
}

let logoPromise: Promise<HTMLImageElement> | undefined;

export function loadWatermarkLogo(): Promise<HTMLImageElement> {
  if (!logoPromise) {
    const logo = new Image();
    logo.src = "/nhadepchat-symbol.png?v=4";
    logoPromise = logo.decode().then(() => {
      if (!logo.naturalWidth || !logo.naturalHeight) throw new Error("Empty watermark logo");
      return logo;
    }).catch(() => {
      logoPromise = undefined;
      throw new Error("Chưa thể tải logo để đóng dấu ảnh. Vui lòng thử tải ảnh lại.");
    });
  }
  return logoPromise;
}

/** Burn the brand into the saved pixels, including after any size reduction. */
export function drawImageWatermark(context: CanvasRenderingContext2D, logo: HTMLImageElement) {
  const { width, height } = context.canvas;
  const ratio = logo.naturalWidth / logo.naturalHeight;
  const fontSize = Math.min(width * 0.018, 24, height * 0.055);
  const logoHeight = fontSize * 1.5;
  const logoWidth = logoHeight * ratio;
  const gap = fontSize * 0.5;
  const margin = Math.min(width, height) * 0.025;
  const domain = "nhadepchat.top";

  context.save();
  context.font = `600 ${fontSize}px Arial, sans-serif`;
  const stampWidth = logoWidth + gap + context.measureText(domain).width;
  const x = (width - stampWidth) / 2;
  const y = height - margin - logoHeight;
  context.globalAlpha = 0.8;
  // Only the logo and text are painted; their surrounding pixels stay transparent.
  // A light edge keeps the dark mark readable over both photos and drawings.
  context.shadowColor = "rgba(255, 255, 255, 0.85)";
  context.shadowBlur = fontSize * 0.12;
  context.drawImage(logo, x, y, logoWidth, logoHeight);
  context.fillStyle = "#111827";
  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = fontSize * 0.08;
  context.lineJoin = "round";
  context.textAlign = "left";
  context.textBaseline = "middle";
  const textX = x + logoWidth + gap;
  const textY = y + logoHeight / 2;
  context.strokeText(domain, textX, textY);
  context.fillText(domain, textX, textY);
  context.restore();
}
