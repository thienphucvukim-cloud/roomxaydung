import assert from "node:assert/strict";
import { formatFeedPrice, formatPriceDescription } from "../lib/price-description.ts";

for (const [input, expected] of [
  ["Giá: 150000", "Giá: 150.000"],
  ["Giá bán 150000đ", "Giá bán 150.000đ"],
  ["Chi phí 125000000 VND", "Chi phí 125.000.000 VND"],
  ["Giá: 150,000 VNĐ", "Giá: 150.000 VNĐ"],
  ["150 000 đồng/m²", "150.000 đồng/m²"],
  ["150.000đ và 250000₫", "150.000đ và 250.000₫"],
  ["Giá 1200000 - 1500000 đồng", "Giá 1.200.000 - 1.500.000 đồng"],
  ["Nhà 5 × 20m, 150m², gọi 0912345678, ngày 03/10/2026", "Nhà 5 × 20m, 150m², gọi 0912345678, ngày 03/10/2026"],
  ["Giá: 1,5 triệu, 2.5 tỷ", "Giá: 1,5 triệu, 2.5 tỷ"],
  ["Giá 15000m²", "Giá 15000m²"],
]) assert.equal(formatPriceDescription(input), expected);
assert.equal(formatFeedPrice("150000"), "150.000đ");
assert.equal(formatFeedPrice("150.000đ"), "150.000đ");
assert.equal(formatFeedPrice("Miễn phí"), "Miễn phí");
console.log("PASS: monetary grouping with dots; dimensions, phones, dates and decimal units stay intact.");
