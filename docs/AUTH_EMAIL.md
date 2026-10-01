# Xác nhận email cho tài khoản quản lý

Tài khoản chủ website phải xác nhận mã email **mỗi lần đăng nhập** và **mỗi lần đổi
mật khẩu**. Thành viên có thể đổi mật khẩu tại **Tài khoản → Đổi mật khẩu và bảo mật**;
chủ website cũng có form này trong **Cài đặt** trên thanh công cụ quản lý.

## Cách sử dụng

1. Đăng nhập bằng email và mật khẩu.
2. Với chủ website, hệ thống gửi mã 6 chữ số tới email quản lý đã cấu hình.
3. Nhập mã trên chính trình duyệt đang đăng nhập để mở quyền quản lý.
4. Đổi mật khẩu: nhập mật khẩu hiện tại, mật khẩu mới và xác nhận; nhập tiếp mã email.
5. Mật khẩu chỉ thay đổi sau khi mã hợp lệ. Các phiên khác được đăng xuất.

### Khi quên mật khẩu

Nhấn **Quên mật khẩu? Khôi phục qua email** tại `/dang-nhap`, hoặc mở
`/quen-mat-khau`. Nhập email đã đăng ký, kiểm tra hộp thư rồi nhập mã cùng mật khẩu
mới. Không cần mật khẩu cũ hoặc phiên đăng nhập. Khôi phục thành công thu hồi **mọi
phiên cũ**, kể cả trình duyệt đang dùng; người dùng phải đăng nhập lại. Chủ website
vẫn cần mã email trong lần đăng nhập tiếp theo.

Thông báo yêu cầu mã giống nhau cho email có và không có tài khoản. Tra cứu và gửi
email chạy sau khi trả phản hồi để hạn chế dò tài khoản qua nội dung hoặc thời gian
gửi mail. Hệ thống chỉ gửi tới email của tài khoản đã tồn tại; không tạo tài khoản
mới hay cấp quyền chủ website qua chức năng khôi phục. Nếu tài khoản chủ website
online chưa được khởi tạo, cần hoàn tất cấu hình và khởi tạo trước.

Mã khôi phục gắn với trình duyệt và thao tác khôi phục; không dùng để đăng nhập
hoặc đổi mật khẩu thông thường. Không thay đổi mật khẩu trước khi mã hợp lệ. Mã
khôi phục đang chờ bị vô hiệu nếu mật khẩu đã đổi ở phiên khác. Khi gửi lại mã,
mã trước trên cùng trình duyệt không còn dùng được. Yêu cầu khôi phục có giới hạn
riêng để bảo vệ việc gửi mail mà không khóa đăng nhập thông thường.

Nếu mất quyền truy cập email, cần xác minh với người vận hành website để xử lý;
không có cách bỏ qua bằng mật khẩu khởi tạo hoặc câu hỏi bí mật.

Mã hết hạn sau 10 phút, dùng một lần và bị khóa sau 5 lần nhập sai. Gửi lại cần chờ
60 giây; trong mỗi khoảng 15 phút, một tài khoản được yêu cầu tối đa 5 email xác
nhận quản lý và 5 email khôi phục (giới hạn riêng). Mã mới vô hiệu
mã trước của cùng thao tác trên cùng trình duyệt. Phiên quản lý cũ chưa từng xác nhận
email phải đăng nhập lại sau khi triển khai chức năng này.

## Thiết lập gửi email thật

Chọn một trong hai cách dưới đây. Không dùng mật khẩu Gmail cá nhân, không ghi API
key vào mã nguồn hoặc GitHub. Khi chưa cấu hình hoặc gửi mail thất bại, đăng nhập
quản lý dừng ở bước xác nhận và thông báo lỗi rõ ràng; không có đường bỏ qua mã.

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

## Triển khai

Áp dụng migration `0015_auth_email_verification.sql`, `0016_password_recovery.sql`
cùng các migration trước đó:

```bash
pnpm run db:migrate:cloudflare
```

Cấu hình dịch vụ gửi mail và tài khoản chủ website **trước khi** triển khai bản yêu
cầu OTP, rồi build/deploy theo [CLOUDFLARE.md](CLOUDFLARE.md). Không đưa mật khẩu
khởi tạo local lên production khi chưa có sự cho phép của chủ website.

## Kiểm tra local, không gửi mail thật

Chế độ outbox chỉ hoạt động khi Vite chạy dev trên localhost. Bản build production
loại bỏ chế độ này. Không có API công khai để đọc mã và mã không xuất hiện trong log.

PowerShell:

```powershell
$env:TIPOOK_AUTH_EMAIL_TEST = '1'
node scripts/run-framework.mjs dev --port 5174
```

Mở terminal khác:

```powershell
$env:TIPOOK_TEST_ORIGIN = 'http://localhost:5174'
node scripts/check-website-auth.mjs
node scripts/check-auth-email.mjs
node scripts/check-password-recovery.mjs
node scripts/check-functional-flows.mjs
```

`check-auth-email.mjs` và `check-password-recovery.mjs` chỉ chạy localhost, tạm đổi
mật khẩu chủ website local để kiểm tra rồi khôi phục hash cũ và dọn phiên thử
trong `finally`. Các kiểm tra không
sử dụng dữ liệu production. Không chạy khi đang sử dụng tài khoản local trong một
phiên làm việc quan trọng vì ca thu hồi phiên sẽ đăng xuất các phiên local khác.

## Chi tiết bảo mật

Database production chỉ lưu hash mã gắn với challenge và bí mật cookie ngẫu nhiên,
không lưu mã rõ. Challenge gắn với tài khoản, loại thao tác, phiên bản mật khẩu và
trình duyệt; đổi mật khẩu còn gắn với phiên đăng nhập hiện tại. Tiêu thụ mã dùng
`DELETE ... RETURNING` để ngăn hai yêu cầu đồng thời sử dụng cùng mã. Mật khẩu mới
trong yêu cầu chờ được băm trước khi lưu. Đăng xuất hủy các yêu cầu chờ của trình duyệt.

Đây là xác nhận email, không thay thế việc bảo vệ hộp thư quản lý. Hiện chưa có
chức năng thay đổi email quản lý trong giao diện.
