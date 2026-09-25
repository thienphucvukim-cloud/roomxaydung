export type DrawingCatalogItem = {
  category: string;
  title: string;
  price: string;
  amount: number;
  views: number;
  downloads: number;
  rating: string;
  image: string;
  authorId: string;
  authorName: string;
};

const drawingItems: Omit<DrawingCatalogItem, "authorId" | "authorName">[] = [
  { category: "BẢN VẼ NHÀ PHỐ 1 TẦNG", title: "Nhà cấp 4 mái Thái 1 tầng 11 × 13m, diện tích 130m²", price: "150.000đ", amount: 150000, views: 17, downloads: 8, rating: "4.9", image: "/mau-nha-pho-xanh.png" },
  { category: "FILE CAD VĂN PHÒNG", title: "File CAD thiết kế văn phòng 300m² đầy đủ hạng mục", price: "150.000đ", amount: 150000, views: 31, downloads: 14, rating: "4.8", image: "/mat-bang-5x20.png" },
  { category: "BẢN VẼ NHÀ PHỐ 3 TẦNG", title: "Nhà phố 2 tầng + 1 tum, kích thước 7 × 16m", price: "95.000đ", amount: 95000, views: 24, downloads: 11, rating: "4.7", image: "/community-house.png" },
  { category: "BẢN VẼ NHÀ PHỐ 3 TẦNG", title: "Bản vẽ nhà phố 3 tầng phong cách hiện đại 5 × 12m", price: "80.000đ", amount: 80000, views: 22, downloads: 9, rating: "4.8", image: "/mau-nha-pho-xanh.png" },
  { category: "BẢN VẼ CÔNG TRÌNH XÃ HỘI", title: "Khối trường mầm non 58 × 36m, quy mô 20 lớp học", price: "150.000đ", amount: 150000, views: 26, downloads: 12, rating: "4.9", image: "/community-house.png" },
  { category: "BẢN VẼ BIỆT THỰ 1 TẦNG", title: "Full bản vẽ nhà vườn cấp 4 bằng CAD, SketchUp", price: "70.000đ", amount: 70000, views: 32, downloads: 16, rating: "4.8", image: "/mau-nha-pho-xanh.png" },
  { category: "BẢN VẼ NHÀ PHỐ 2 TẦNG", title: "Nhà phố 2 tầng hiện đại, kích thước 5 × 15m", price: "100.000đ", amount: 100000, views: 84, downloads: 37, rating: "5.0", image: "/mat-bang-5x20.png" },
  { category: "HỒ SƠ THIẾT KẾ THI CÔNG", title: "Hồ sơ nhà phố 3 tầng + 1 tum phong cách hiện đại", price: "100.000đ", amount: 100000, views: 31, downloads: 14, rating: "4.8", image: "/mat-bang-5x20.png" },
  { category: "BẢN VẼ NHÀ PHỐ 2 TẦNG", title: "Nhà phố 2 tầng hiện đại, diện tích xây dựng 8,2 × 14m", price: "80.000đ", amount: 80000, views: 70, downloads: 28, rating: "4.9", image: "/community-house.png" },
  { category: "BẢN VẼ NHÀ CẤP 4", title: "Bản vẽ nhà cấp 4 mái Thái kích thước 7,3 × 14m", price: "50.000đ", amount: 50000, views: 59, downloads: 21, rating: "4.7", image: "/mat-bang-5x20.png" },
];

const drawingAuthors = [
  ["virtual-engineer-001", "KS. Nguyễn Trọng Hiếu"],
  ["virtual-engineer-002", "KS. Trần Văn Hùng"],
  ["virtual-engineer-003", "KS. Lê Quốc Đạt"],
  ["virtual-engineer-004", "KS. Phạm Minh Tâm"],
  ["virtual-engineer-005", "KS. Võ Đức Thịnh"],
  ["virtual-engineer-006", "KS. Đặng Hoàng Sơn"],
  ["virtual-engineer-007", "KS. Bùi Tuấn Anh"],
  ["virtual-engineer-008", "KS. Đỗ Thanh Bình"],
  ["virtual-engineer-009", "KS. Nguyễn Quang Hào"],
  ["virtual-engineer-010", "KS. Trần Ngọc Phúc"],
] as const;

export const drawings: DrawingCatalogItem[] = drawingItems.map((drawing, index) => {
  const [authorId, authorName] = drawingAuthors[index];
  return { ...drawing, authorId, authorName };
});

export function parseVndPrice(value: string | null | undefined) {
  if (!value) return 0;
  const digits = value.replace(/\D/g, "");
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount >= 2000 ? amount : 0;
}