# Thanh toán bản vẽ bằng payOS

## Biến môi trường bắt buộc

Cấu hình ba secret phía máy chủ, không đặt trong mã nguồn hoặc biến `NEXT_PUBLIC_*`:

- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`
- `DOWNLOAD_LINK_SECRET`: chuỗi bí mật ngẫu nhiên dùng để ký link tải 24 giờ (nếu bỏ trống, hệ thống dùng `PAYOS_CHECKSUM_KEY`).

Tùy chọn:

- `PAYOS_RETURN_URL_BASE`: domain công khai của website, ví dụ `https://tipook.vn`. Nếu bỏ trống, hệ thống dùng origin của request hiện tại.

## Webhook

Trong kênh thanh toán trên my.payos.vn, đặt webhook URL thành:

`https://<domain>/api/payments/webhook`

Webhook xác minh HMAC-SHA256, đối chiếu mã đơn và số tiền trước khi cập nhật trạng thái `paid`.

## Cơ sở dữ liệu

Áp dụng các migration `drizzle/0008_payment_orders.sql`, `drizzle/0009_member_profiles.sql` và `drizzle/0010_private_drawing_files.sql` trước khi bật thanh toán.

## Luồng người dùng

1. Người mua bấm icon Đặt mua và xác nhận.
2. Máy chủ lấy giá từ danh mục hoặc bài đăng, tạo đơn `pending`, ký dữ liệu rồi gọi payOS.
3. Trình duyệt chuyển đến checkout payOS để quét VietQR/thanh toán.
4. payOS gọi webhook; Tipook chỉ xác nhận đơn sau khi chữ ký và số tiền hợp lệ.
5. Với bản vẽ cộng đồng, người mua nhận link tải có chữ ký trong tin nhắn nội bộ. Link chỉ dùng đúng tài khoản mua và hết hạn sau 24 giờ.
6. Ảnh đại diện được lưu công khai; file bán được đánh dấu `private` trong Cloudflare R2 và không thể đọc qua API tệp công khai.