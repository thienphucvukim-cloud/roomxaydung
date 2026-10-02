# Bảo mật quản trị bằng ứng dụng xác thực

Quản trị dùng mật khẩu + TOTP. Website tự kiểm tra mã; không gọi Resend, dịch vụ
SMS hay nhà cung cấp xác thực. QR được tạo ngay trong giao diện website.

## Lần đăng nhập đầu tiên

1. Mở `/dang-nhap?role=admin`, nhập email và mật khẩu quản trị.
2. Dùng ứng dụng hỗ trợ TOTP trên điện thoại để quét QR. Có thể nhập khóa thủ công.
3. Nhập mã 6 chữ số hiện trên điện thoại. Chưa có quyền quản trị trước bước này.
4. Tải/lưu 10 mã khôi phục ở nơi riêng, đánh dấu đã lưu rồi tiếp tục.

QR chỉ xuất hiện khi chưa thiết lập thiết bị, hoặc sau khi xác nhận đổi thiết bị.
Đừng chia sẻ QR hoặc khóa thủ công. Điện thoại tạo mã offline; bật giờ tự động
để khớp với thời gian trên máy chủ. Mã đổi mỗi 30 giây và không được dùng lại.

## Khi mất điện thoại hoặc quên mật khẩu

- Còn mật khẩu: đăng nhập, chọn **Mất điện thoại? Dùng mã khôi phục**.
- Quên mật khẩu: mở `/quen-mat-khau?role=admin`, dùng email + một mã khôi phục
  để đặt mật khẩu mới. Mọi phiên cũ bị thu hồi; TOTP vẫn bật.
- Đổi điện thoại: vào **Quản lý → Cài đặt → Ứng dụng xác thực**, nhập mật khẩu
  hiện tại và mã ứng dụng hoặc mã dự phòng, rồi quét QR mới và xác nhận.
  Thiết bị, mã dự phòng cũ và các phiên khác chỉ bị vô hiệu sau khi xác nhận thành công.
- Mỗi mã dự phòng chỉ dùng một lần. Mỗi lần đổi thiết bị tạo 10 mã mới và chỉ
  hiển thị bộ mã mới một lần; cần lưu trước khi tiếp tục.
- Mất cả ứng dụng và mã dự phòng: cần người vận hành xác minh và khôi phục trực tiếp.
  Mật khẩu khởi tạo và chức năng khôi phục email không bỏ qua được TOTP đã bật.

Khôi phục mật khẩu thành viên qua email vẫn cấu hình riêng theo [AUTH_EMAIL.md](AUTH_EMAIL.md).

## Khóa mã hóa và triển khai

Giữ nguyên `TIPOOK_ADMIN_EMAIL` và `TIPOOK_ADMIN_PASSWORD` để khởi tạo tài khoản.
Thêm `TIPOOK_MFA_KEY`: 32 byte ngẫu nhiên, biểu diễn bằng 64 ký tự hex.
Khóa này dùng để mã hóa seed TOTP bằng AES-256-GCM, gắn với ID tài khoản.
Không dùng mật khẩu người dùng làm khóa mã hóa và không commit khóa vào Git.

```bash
node scripts/setup-admin-mfa.mjs
node scripts/setup-admin-mfa.mjs --cloudflare
pnpm run db:migrate:cloudflare
pnpm run build:cloudflare
pnpm run deploy:cloudflare
```

Hai lệnh đầu tạo khóa riêng cho local và production nếu chưa có; giữ khóa hiện có.
Migration `0017_admin_totp.sql` tạo bảng TOTP, mã dự phòng và yêu cầu xác nhận;
thu hồi các phiên quản trị đã xác nhận bằng email để yêu cầu thiết lập/đăng nhập lại.
Migration không thay đổi mật khẩu hay nội dung website.

**Sao lưu khóa mã hóa qua cơ chế lưu secret của người vận hành.** Không xoay khóa
trực tiếp khi đã có seed: seed đang lưu sẽ không giải mã được. Đổi khóa cần kế hoạch
mã hóa lại dữ liệu bằng khóa cũ hoặc xác minh và thiết lập lại thiết bị.

## Kiểm tra

Các fixture quản trị chỉ chạy trên state thử riêng. Trên PowerShell:

```powershell
node scripts/setup-admin-mfa.mjs
$env:TIPOOK_LOCAL_STATE_PATH = '.sites-runtime/totp-check-new-run'
$env:TIPOOK_AUTH_EMAIL_TEST = '1'
node scripts/prepare-local-db.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5184
```

Mở terminal thứ hai với cùng `TIPOOK_LOCAL_STATE_PATH`:

```powershell
$env:TIPOOK_LOCAL_STATE_PATH = '.sites-runtime/totp-check-new-run'
$env:TIPOOK_TEST_ORIGIN = 'http://127.0.0.1:5184'
node scripts/test-totp-crypto.mjs
node scripts/check-admin-totp.mjs
node scripts/check-website-auth.mjs
node scripts/check-password-recovery.mjs
node scripts/check-functional-flows.mjs
```

Chọn tên state mới cho mỗi đợt kiểm tra và chạy theo thứ tự trên. Kiểm tra thuật toán
dùng vector RFC 6238 độc lập; tích hợp kiểm tra giới hạn thử, CSRF, ràng buộc trình
duyệt/phiên, chống dùng lại mã, mã dự phòng đồng thời, đổi mật khẩu và đổi thiết bị.
Test helper có thể chỉnh bộ đếm TOTP của fixture để chạy nhanh; không dùng với state
đang phục vụ người dùng và không dùng với production.

Tham khảo [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238) và
[OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).
