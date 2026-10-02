# Quảng cáo nổi bật trong kho bản vẽ và nội thất

Mỗi kho có 16 mục mỗi trang và 16 vị trí quảng cáo độc lập trên trang đầu.

| Vị trí | Giá mỗi tháng |
| --- | --- |
| 1 | 50.000đ |
| 2 | 40.000đ |
| 3 | 30.000đ |
| 4 | 20.000đ |
| 5–16 | 10.000đ |

Trong form Đăng bản vẽ / Đăng nội thất, quảng cáo mặc định tắt. Chỉ khi gạt bật nổi bật, người đăng mới chọn vị trí còn trống và 1–12 tháng. Vị trí đã có người trả phí ẩn giá, hiện “Đã đặt” và không thể chọn. Form hiển thị tổng tiền trước khi đăng và thanh toán bằng ví; gạt công tắc chưa trừ tiền. Đăng thường không phát sinh phí quảng cáo. Một hồ sơ chỉ được chạy một vị trí tại một thời điểm. Thời gian bắt đầu ngay sau thanh toán, tính theo tháng lịch và tự hết hạn; không tự gia hạn. Ngày cuối tháng được giới hạn về ngày cuối tháng đích khi cần.

Nếu hồ sơ đã đăng nhưng thanh toán quảng cáo thất bại, form giữ mã bài đã đăng. Người dùng có thể thử thanh toán lại hoặc tắt quảng cáo rồi hoàn tất, không tạo bài đăng trùng.

Ở trang 1 không tìm kiếm, bài quảng cáo giữ đúng ô đã mua. Các mục thông thường lấp những ô còn lại. Nếu kho chưa đủ bài để lấp các ô trước vị trí đã mua, giao diện giữ ô trống để không thay đổi vị trí quảng cáo. Khi tìm kiếm, chỉ các bài phù hợp được trả về, ưu tiên bài đang chạy quảng cáo.

API kiểm tra quyền sở hữu, số dư, vị trí và thời hạn. Ghi giao dịch ví và quảng cáo trong cùng D1 batch để tránh trừ tiền khi đặt chỗ thất bại; mã yêu cầu giúp thử lại không trừ tiền hai lần. Lịch sử ví hiển thị giao dịch quảng cáo.

Trước khi chạy phiên bản mới, áp dụng migration `drizzle/0020_catalog_promotions.sql` bằng quy trình migration hiện có. Chạy local:

```sh
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.jsonc
```

Kiểm tra:

```sh
node --experimental-vm-modules scripts/test-catalog-promotions.mjs
node --experimental-vm-modules scripts/test-catalog-promotion-form.mjs
```
