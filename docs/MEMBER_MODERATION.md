# Quản lý tài khoản thành viên

Trong Quản trị → Thành viên, quản trị có thể đặt lại mật khẩu, vô hiệu hóa,
mở lại tài khoản bị vô hiệu hóa hoặc xóa tài khoản vi phạm. Form xử lý hiển thị
tên đăng nhập, họ tên và mã tài khoản; yêu cầu lý do và xác nhận đúng thành viên.

- Vô hiệu hóa: chặn đăng nhập bằng mật khẩu, Google và tài khoản Sites;
  thu hồi các phiên và mã khôi phục, ẩn hồ sơ và bài đăng công khai.
- Mở lại: cho phép đăng nhập, giữ bài đăng đã ẩn để quản trị duyệt riêng.
- Xóa: đánh dấu tài khoản đã xóa, chặn truy cập và ẩn khỏi danh sách mặc định.
  Không có nút mở lại tài khoản đã xóa. Danh tính đăng nhập, lịch sử giao dịch
  và bằng chứng xử lý được giữ, tránh mất dữ liệu đối soát và tái sử dụng danh tính.
- Bộ lọc Đã vô hiệu hóa / Đã xóa giúp xem các tài khoản đã xử lý và lý do gần nhất.
- Tài khoản quản trị, tài khoản đang thao tác và danh tính quản trị cấu hình
  qua biến môi trường được bảo vệ ở cả giao diện và API.

Mỗi thao tác ghi người thực hiện, lý do, thời gian và phiên bản vào
`admin_member_moderation`. Cập nhật trạng thái, ghi lịch sử, thu hồi phiên và
ẩn bài đăng chạy trong một D1 batch. Phiên bản cũ bị từ chối để tránh xử lý
dựa trên danh sách chưa cập nhật.

Áp dụng migration `0023_member_account_moderation.sql` trước khi chạy phiên bản
mới. Khởi động local tự áp dụng migration qua `scripts/prepare-local-db.mjs`.
Quy trình triển khai Cloudflare cũng cần áp dụng migration D1.

Kiểm thử:

```sh
node --experimental-vm-modules scripts/test-member-moderation.mjs
node --experimental-vm-modules scripts/test-google-login-flow.mjs
node --experimental-vm-modules scripts/test-admin-member-password-reset.mjs
```
