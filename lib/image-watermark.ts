import { POST_CATEGORIES } from "./legacy-contracts";

export function shouldWatermarkPostImages(category: string) {
  return category === POST_CATEGORIES.houseModels || category === POST_CATEGORIES.drawings || category === POST_CATEGORIES.interiors;
}

let logoPromise: Promise<HTMLImageElement> | undefined;

export function loadWatermarkLogo(): Promise<HTMLImageElement> {
  if (!logoPromise) {
    const logo = new Image();
    logo.src = "/nhadepchat-logo.png";
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
  const logoWidth = Math.min(width * 0.2, 240, height * 0.09 * ratio);
  const logoHeight = logoWidth / ratio;
  const padding = logoHeight * 0.16;
  const margin = Math.min(width, height) * 0.02;
  const badgeWidth = logoWidth + padding * 2;
  const badgeHeight = logoHeight + padding * 2;
  const x = (width - badgeWidth) / 2;
  const y = height - margin - badgeHeight;

  context.save();
  // A small translucent backing keeps the dark logo legible on photos and drawings.
  context.fillStyle = "rgba(255, 255, 255, 0.58)";
  context.beginPath();
  context.roundRect(x, y, badgeWidth, badgeHeight, logoHeight * 0.18);
  context.fill();
  context.globalAlpha = 0.72;
  context.drawImage(logo, x + padding, y + padding, logoWidth, logoHeight);
  context.restore();
}
