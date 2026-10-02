# Email khôi phục mật khẩu thành viên

Quản trị dùng TOTP và mã dự phòng theo [ADMIN_TOTP.md](ADMIN_TOTP.md), không phụ
thuộc dịch vụ gửi email. Mã email không đăng nhập, đổi mật khẩu hay khôi phục quản trị.

## Sử dụng

Tại `/quen-mat-khau`, thành viên nhập email đã đăng ký, nhận mã 6 chữ số rồi đặt
mật khẩu mới. Mã có hiệu lực 10 phút, dùng một lần, khóa sau 5 lần nhập sai; gửi lại
cần chờ 60 giây. Yêu cầu gửi và xác nhận có giới hạn theo tài khoản và IP.
Khôi phục thành công thu hồi mọi phiên cũ và yêu cầu đăng nhập lại.

Phản hồi yêu cầu mã giống nhau cho email có/không có tài khoản. Tra cứu tài khoản
và gửi email thực hiện sau phản hồi. Mã gắn với trình duyệt, yêu cầu khôi phục và
phiên bản mật khẩu. Mã cũ không ghi đè mật khẩu đã đổi ở phiên khác; gửi lại làm
mã trước trên cùng trình duyệt mất hiệu lực. Không tạo tài khoản mới qua khôi phục.

Nếu chưa cấu hình mail, khôi phục thành viên báo chưa có dịch vụ gửi mã. Đăng nhập
thành viên và các chức năng bảo mật quản trị vẫn hoạt động độc lập.

## Thiết lập gửi mail thật

Chọn Resend hoặc Cloudflare Email Service. API key chỉ lưu trong `.dev.vars` local
hoặc secret Worker; không dùng mật khẩu Gmail cá nhân để cấu hình gửi mail.

### Resend

Tạo tài khoản Resend, xác minh tên miền gửi và tạo API key có quyền gửi email.
Xem [hướng dẫn xác minh tên miền](https://resend.com/docs/dashboard/domains/introduction)
và [API gửi email](https://resend.com/docs/api-reference/emails/send-email).

Đặt các biến sau trong `.dev.vars` khi chạy local, hoặc **Worker tipook-web →
Settings → Variables and Secrets** khi chạy online:

```text
AUTH_EMAIL_PROVIDER=resend
AUTH_EMAIL_FROM=no-reply@ten-mien-da-xac-minh.vn
RESEND_API_KEY=<secret API key>
```

`AUTH_EMAIL_FROM` là địa chỉ gửi trên tên miền đã xác minh với Resend, không phải
địa chỉ Gmail nhận mã. Email nhận mã lấy từ tài khoản chủ website.

### Cloudflare Email Service

Thiết lập tên miền gửi và Email Service theo
[hướng dẫn Cloudflare](https://developers.cloudflare.com/email-service/get-started/send-emails/).
Đặt `AUTH_EMAIL_PROVIDER=cloudflare`, `AUTH_EMAIL_FROM` là địa chỉ gửi đã xác minh,
và bổ sung binding vào `wrangler.jsonc`:

```json
"send_email": [{ "name": "AUTH_EMAIL" }]
```

Không cần `RESEND_API_KEY` với cách này. Ứng dụng dùng
[Workers Email API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/).
Để dùng binding ở local, bổ sung tương ứng vào cấu hình local của Vite; không bật
gửi email remote trong kiểm tra tự động.

## Triển khai và kiểm tra

Áp dụng toàn bộ migration đến `0017_admin_totp.sql` rồi build/deploy theo
[CLOUDFLARE.md](CLOUDFLARE.md). Khóa TOTP và state kiểm tra thiết lập riêng theo
[ADMIN_TOTP.md](ADMIN_TOTP.md).

Chế độ `TIPOOK_AUTH_EMAIL_TEST=1` chỉ tạo outbox trên localhost dev; bị loại khỏi
bản production. Mã không được trả qua HTTP hoặc ghi vào log. Kiểm tra bằng:

```bash
node scripts/check-password-recovery.mjs
```

`check-auth-email.mjs` chạy cùng bộ kiểm tra khôi phục thành viên để tương thích
lệnh cũ. Các kiểm tra chỉ chạy local; không gửi mail hoặc sửa dữ liệu production.
