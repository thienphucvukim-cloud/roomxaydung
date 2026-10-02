export type FileCatalogSort = "latest" | "downloads" | "views" | "rating" | "featured";

export const FILE_CATALOG_SORT_OPTIONS = [
  { value: "latest", label: "Mặc định" },
  { value: "downloads", label: "Tải nhiều", description: "Ưu tiên hồ sơ được nhiều tài khoản tải file" },
  { value: "views", label: "Xem nhiều", description: "Ưu tiên hồ sơ có nhiều lượt xem" },
  { value: "rating", label: "Đánh giá", description: "Ưu tiên điểm đánh giá cao, sau đó số đánh giá" },
  { value: "featured", label: "Nổi bật", description: "Ưu tiên vị trí quảng cáo đang hoạt động, sau đó lượt yêu thích" },
];

export function parseFileCatalogSort(value: unknown): FileCatalogSort {
  return typeof value === "string" && FILE_CATALOG_SORT_OPTIONS.some(option => option.value === value) ? value as FileCatalogSort : "latest";
}
