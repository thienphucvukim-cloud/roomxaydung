import { POST_CATEGORIES } from "./legacy-contracts";

export const CATALOG_PRICE_ERROR = "Giá bán phải là số tiền từ 2.000đ; nhập 0 hoặc để trống nếu miễn phí.";

export function isPricedCatalog(category: string) {
  return category === POST_CATEGORIES.drawings || category === POST_CATEGORIES.interiors;
}

// Accept whole VND amounts with optional thousands separators and currency.
export function normalizeCatalogPrice(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 240) return null;
  const text = value.trim();
  if (!text || /^miễn phí$/i.test(text)) return "0đ";
  const number = text.replace(/\s*(?:đ|₫|vnd)$/i, "").trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+)$/.test(number)) return null;
  const amount = Number(number.replace(/[.,]/g, ""));
  if (!Number.isSafeInteger(amount) || (amount !== 0 && amount < 2000)) return null;
  return `${amount.toLocaleString("vi-VN")}đ`;
}
