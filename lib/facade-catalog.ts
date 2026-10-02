const modelItems = [
  { tags: "nha-pho|mat-tien-5m|3-tang|nhieu-cay", title: "Nhà phố 3 tầng xanh mát", meta: "5 × 20m · 4 phòng ngủ", style: "Hiện đại nhiệt đới", image: "/mau-nha-pho-xanh.png" },
  { tags: "nha-pho|3-tang", title: "Nhà phố lệch tầng thoáng sáng", meta: "4,5 × 18m · 3 phòng ngủ", style: "Hiện đại tối giản", image: "/community-house.png" },
  { tags: "nha-pho|mat-tien-5m|3-tang", title: "Nhà 3 tầng có sân trước", meta: "5 × 16m · 4 phòng ngủ", style: "Ấm áp, gần gũi", image: "/mau-nha-pho-xanh.png" },
  { tags: "nha-pho|mat-tien-5m|nhieu-cay", title: "Nhà phố có khoảng xanh giữa nhà", meta: "5 × 22m · 3 phòng ngủ", style: "Không gian mở", image: "/community-house.png" },
  { tags: "nha-pho|3-tang", title: "Nhà ống 3 tầng mặt tiền lam gỗ", meta: "4 × 20m · 4 phòng ngủ", style: "Hiện đại", image: "/mau-nha-pho-xanh.png" },
  { tags: "nha-pho|co-gara", title: "Nhà phố kết hợp kinh doanh", meta: "6 × 18m · 3 phòng ngủ", style: "Linh hoạt công năng", image: "/community-house.png" },
];

const modelAuthors = [
  ["virtual-architect-001", "KTS. Nguyễn Khánh Linh"],
  ["virtual-architect-002", "KTS. Trần Minh Khoa"],
  ["virtual-architect-003", "KTS. Lê Hoài An"],
  ["virtual-architect-004", "KTS. Phạm Đức Long"],
  ["virtual-architect-005", "KTS. Võ Thanh Trúc"],
  ["virtual-architect-006", "KTS. Đặng Quang Vinh"],
] as const;

export const facadeModels = modelItems.map((model, index) => {
  const [authorId, authorName] = modelAuthors[index];
  return { ...model, authorId, authorName, isDemo: true };
});
