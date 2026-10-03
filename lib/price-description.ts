/** Group monetary amounts without changing dimensions, phone numbers or dates. */
export function formatPriceDescription(value: string) {
  const group = (amount: string) => amount.replace(/[.,\s]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const amount = String.raw`\d+(?:[.,\u00a0 ]\d{3})*`;
  const currency = new RegExp(String.raw`(^|[^\d.,])(${amount})(\s*(?:VNĐ|VND|đồng|₫|đ))(?![\p{L}])`, "giu");
  const labeled = new RegExp(String.raw`((?:giá(?:\s+(?:bán|file|trọn gói|thi công))?|chi phí|ngân sách)\s*[:=]?\s*)(${amount})(?![\d.,]|\s*(?:[%×x]|m\b|m²|cm\b|mm\b))`, "giu");
  return value.replace(currency, (_, before: string, digits: string, unit: string) => before + group(digits) + unit)
    .replace(labeled, (_, label: string, digits: string) => label + group(digits));
}

export function formatFeedPrice(value: string) {
  if (/^\d+(?:[.,\s]\d{3})*$/.test(value.trim())) {
    return value.trim().replace(/[.,\s]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
  }
  return formatPriceDescription(value);
}
