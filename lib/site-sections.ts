import { POST_CATEGORIES } from "./legacy-contracts.ts";

export const SITE_SECTIONS = {
  news: { label: "Bảng tin", path: "/" },
  houseModels: { label: "Mẫu nhà đẹp", path: "/kho-mau-nha-dep-chat" },
  drawings: { label: "Kho bản vẽ", path: "/file-ban-ve-nha-dep-chat" },
  interiors: { label: "Nội thất", path: "/noi-that" },
  designMarketplace: { label: "Thuê thiết kế", path: "/thue-thiet-ke" },
  materials: { label: "Tính vật tư", path: "/tinh-vat-tu-nha-dep-chat" },
  about: { label: "Giới thiệu", path: "/gioi-thieu" },
} as const;

export function postCategoryLabel(category: string) {
  for (const key of ["news", "houseModels", "drawings", "interiors"] as const) {
    if (category === POST_CATEGORIES[key]) return SITE_SECTIONS[key].label;
  }
  return category;
}
