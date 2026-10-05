// Persisted identifiers retain their original bytes. Application code uses
// current domain names; changing these values requires a data migration.
export const POST_STORAGE_COLUMNS = { specifications: "location", listingType: "feeling", priceLabel: "poll_question" } as const;
export const POST_CATEGORIES = {
  news: "Bảng tin", houseModels: "Bộ sưu tập ảnh", drawings: "Bản vẽ cộng đồng",
  interiors: "Nội thất cộng đồng", modelDiscussion: "Thảo luận mẫu nhà",
};
export function houseModelContentKey(index: number | string, field?: string) {
  return `facade.${index}${field ? "." + field : ""}`;
}
export function catalogImageCategory(contentKey: string) {
  const match = /^(facade|drawing|interior)\.\d+\.(?:image|photo\.\d+)$/.exec(contentKey);
  if (!match) return undefined;
  return { facade: POST_CATEGORIES.houseModels, drawing: POST_CATEGORIES.drawings, interior: POST_CATEGORIES.interiors }[match[1] as "facade" | "drawing" | "interior"];
}
export const PENDING_WALLET_STORAGE = {
  manualCredit: "tipook:pending-manual-credit", sellerOperation: "tipook:pending-sales-wallet",
} as const;
export function isSystemMessageSender(userId: string) { return userId.startsWith("nhadepchat-") || userId.startsWith("tipook-"); }
// Existing signed download URLs must continue to verify after a rename.
export const DOWNLOAD_SIGNATURE_NAMESPACE = "tipook-download";
