# Website của bạn: đăng nhập và chỉnh sửa trực tiếp

## Sử dụng

1. Nhấn **Đăng nhập** trên website hoặc mở `/dang-nhap`.
2. Đăng nhập với email và mật khẩu chủ website.
   Nhập tiếp mã 6 chữ số gửi tới email quản lý để xác nhận đăng nhập.
3. Thanh công cụ **Website của bạn** xuất hiện phía trên giao diện.
4. Nhấn **Chỉnh sửa**, sau đó nhấn vào chữ hoặc ảnh có viền để thay đổi.
5. Nhấn **Áp dụng** để xem trước, rồi **Lưu website** để cập nhật cho mọi người.

Bạn có thể sửa tiêu đề, mô tả, nội dung hướng dẫn, ảnh mẫu mặt tiền, mặt bằng,
tên và ảnh mẫu bản vẽ. Mục **Cài đặt** cho phép đổi tên website, logo, màu chủ đạo
và mật khẩu của chủ website. Bản xem trước giữ thay đổi khi chuyển trang bằng menu.
Khi rời website hoặc tải lại mà chưa lưu, trình duyệt nhắc về thay đổi chưa lưu.

**Khôi phục mặc định** bỏ phần tùy chỉnh của mục đang sửa khi bạn nhấn Lưu website.
Nút bỏ thay đổi trên thanh công cụ hủy toàn bộ phần chưa lưu. Việc khôi phục nội dung
không xóa bài đăng hoặc dữ liệu thành viên.

Mục **Quản lý** mở ngay trong trang, gồm:

- Nội dung: tìm kiếm, sửa bài đăng và ẩn/hiện bài cộng đồng.
- Yêu cầu: đọc nội dung và liên hệ, cập nhật trạng thái tư vấn gửi tới bạn.
- Thành viên: tra cứu tài khoản và hồ sơ.
- Giao dịch: duyệt nạp tiền sau khi kiểm tra sao kê và đối soát bản vẽ đã bán.
- Cài đặt: diện mạo website, mật khẩu và trạng thái kết nối dữ liệu.

Các mục ẩn bởi chủ website không xuất hiện trong danh sách công khai và không thể
được mua mới. Người đã mua vẫn có lịch sử giao dịch của họ.

## Khởi tạo local

Đặt email của bạn vào `TIPOOK_ADMIN_EMAIL` trong `.dev.vars`, hoặc chạy:

```bash
node scripts/setup-owner.mjs --email=ban@example.com
```

Script giữ các biến môi trường khác và tạo mật khẩu ngẫu nhiên khi chưa có
`TIPOOK_ADMIN_PASSWORD`. Mật khẩu mới chỉ được in khi script vừa tạo nó.
Khởi động lại server rồi đăng nhập. Tài khoản chủ website được tạo ở lần đăng nhập
đầu tiên khi email và mật khẩu khởi tạo đúng. Sau đó dùng **Cài đặt → Đổi mật khẩu**.
Thay đổi mật khẩu khởi tạo trong biến môi trường không ghi đè mật khẩu tài khoản đã tạo.
Đăng nhập và đổi mật khẩu chủ website cần dịch vụ gửi mã email theo
[AUTH_EMAIL.md](AUTH_EMAIL.md); mật khẩu chỉ đổi sau khi xác nhận mã.

Email chủ website không được đăng ký qua form đăng ký thành viên. Các tài khoản
thành viên được tạo tại `/dang-ky` và không có quyền sửa website.

## Cloudflare production

Áp dụng các migration trước khi đưa chức năng này vào sử dụng:

```bash
pnpm run db:migrate:cloudflare
```

Đặt hai secret trên Worker `tipook-web`:

```bash
pnpm exec wrangler secret put TIPOOK_ADMIN_EMAIL --config wrangler.jsonc
pnpm exec wrangler secret put TIPOOK_ADMIN_PASSWORD --config wrangler.jsonc
```

Mật khẩu khởi tạo cần tối thiểu 10 ký tự. D1 dùng binding `DB`; ảnh tải lên dùng
R2 binding `BUCKET`. `.dev.vars` chỉ dùng local và không được gửi lên repository.
Build/deploy theo [CLOUDFLARE.md](CLOUDFLARE.md).

## Lưu trữ và quyền truy cập

Mật khẩu được băm bằng scrypt với salt riêng. Phiên đăng nhập dùng cookie HttpOnly,
SameSite=Lax, Secure trên HTTPS; token được băm trước khi lưu trong D1, hết hạn sau
7 ngày. Đăng xuất thu hồi phiên hiện tại; đổi mật khẩu thu hồi các phiên khác.
Yêu cầu đăng nhập có giới hạn số lần thử, được lưu trong D1. API sửa website và
API quản lý đều kiểm tra tài khoản chủ website ở máy chủ, cùng nguồn yêu cầu.

Nội dung tùy chỉnh lưu trong bảng `website_content`; thay đổi nhiều mục được ghi
cùng một batch D1. Nội dung chữ được hiển thị dạng văn bản, không chạy HTML tùy ý.
Ảnh dùng đường dẫn công khai trên website hoặc URL HTTPS. Giá, công thức tính
vật tư, số dư và quyền tài khoản được xử lý bằng nghiệp vụ riêng.

Tài khoản quản lý xác nhận email khi đăng nhập và đổi mật khẩu. Khi quên mật khẩu,
khôi phục qua mã email tại `/quen-mat-khau`; chức năng này thu hồi mọi phiên cũ
và yêu cầu đăng nhập lại. Xem [AUTH_EMAIL.md](AUTH_EMAIL.md). Đăng ký thành viên
không xác minh quyền sở hữu email; riêng email chủ website được giữ để khởi tạo bằng
mật khẩu bí mật phía máy chủ. Tài khoản thành viên có sẵn chỉ trở thành chủ website
khi nhập đúng mật khẩu khởi tạo được cấu hình trên máy chủ; các phiên cũ của tài khoản
đó bị thu hồi khi kích hoạt quyền chủ website.

## Kiểm tra

Khởi động server kiểm tra với chế độ outbox local theo [AUTH_EMAIL.md](AUTH_EMAIL.md):

```bash
node scripts/check-website-auth.mjs
node scripts/check-auth-email.mjs
node scripts/check-password-recovery.mjs
node scripts/check-functional-flows.mjs
node scripts/check-facade-pagination.mjs
```

Các kiểm tra tạo fixture trên database local và dọn dữ liệu thử, không gọi giao dịch
ngân hàng thật.
