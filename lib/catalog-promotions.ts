import { POST_CATEGORIES } from "./legacy-contracts.ts";
export const FILE_CATALOG_PAGE_SIZE = 16;
export const PROMOTION_CATEGORIES = [POST_CATEGORIES.drawings, POST_CATEGORIES.interiors] as const;

export function promotionMonthlyPrice(position: number) {
  if (!Number.isInteger(position) || position < 1 || position > FILE_CATALOG_PAGE_SIZE) throw new Error("Vị trí không hợp lệ.");
  return Math.max(10_000, 60_000 - position * 10_000);
}

// Calendar months in Vietnam, preserving the time and clamping the target day.
export function promotionExpiry(start: Date, months: number) {
  if (!Number.isInteger(months) || months < 1 || months > 12) throw new Error("Số tháng không hợp lệ.");
  const vietnamOffset = 7 * 60 * 60 * 1000;
  const end = new Date(start.getTime() + vietnamOffset);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return new Date(end.getTime() - vietnamOffset).toISOString();
}

export function placePromotedItems<T>(items: T[], positionOf: (item: T) => number | null | undefined): (T | null)[] {
  const slots: (T | null)[] = Array.from({ length: Math.max(items.length, ...items.map(item => positionOf(item) || 0)) }, () => null);
  const ordinary: T[] = [];
  for (const item of items) {
    const position = positionOf(item);
    if (position) slots[position - 1] = item;
    else ordinary.push(item);
  }
  for (let index = 0; index < slots.length && ordinary.length; index++) {
    if (!slots[index]) slots[index] = ordinary.shift()!;
  }
  return slots;
}
