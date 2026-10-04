# Đăng ký thành viên và đăng nhập Google

Thành viên đăng ký tại `/dang-ky` bằng họ tên, tên đăng nhập và mật khẩu từ
6 đến 128 ký tự, không cần email. Tên đăng nhập có 3–32 ký tự, bắt đầu bằng
chữ hoặc số, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới và gạch ngang;
không phân biệt chữ hoa và chữ thường. Đăng nhập tại `/dang-nhap` bằng tên
đăng nhập hoặc email của tài khoản cũ. Quản trị đăng nhập tại `/admin`, dùng mật khẩu tối thiểu
10 ký tự và TOTP.

Tài khoản không có email không thể tự khôi phục mật khẩu bằng mã email.
Người dùng cần liên hệ người vận hành website để xác minh và được hỗ trợ.

## Cấu hình Google

1. Trong Google Cloud Console, cấu hình màn hình đồng ý OAuth và tạo OAuth
   client loại **Web application**. Nếu ứng dụng ở chế độ Testing, thêm
   tài khoản thử nghiệm vào danh sách Test users.
   Phần **Branding → App domain** điền:
   - **Application home page:** `https://nhadepchat.top`
   - **Application privacy policy link:** `https://nhadepchat.top/privacy`
   - **Application terms of service link:** để trống.
   - **Authorized domains:** `nhadepchat.top` (không có `https://` hoặc đường dẫn).

   Trang `/privacy` có liên kết ở chân website và trang đăng nhập/đăng ký,
   cho phép đọc mà không cần đăng nhập. Cần triển khai trang lên tên miền
   production trước khi dùng link này để gửi Google xác minh.
2. Thêm các **Authorized redirect URIs** ứng với nơi chạy website:
   - Local: `http://localhost:5173/api/auth/google/callback`
   - Production: `https://nhadepchat.top/api/auth/google/callback`
   - Nếu dùng www: `https://www.nhadepchat.top/api/auth/google/callback`
   - Nếu dùng tên miền Worker hoặc cổng local khác, đăng ký đúng origin đó
     với cùng đường dẫn `/api/auth/google/callback`.
3. Điền `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` vào `.dev.vars` cho local,
   rồi khởi động lại dev server. Không commit các giá trị này.
4. Production: lưu hai biến bằng:
   ```bash
   corepack pnpm exec wrangler secret put GOOGLE_CLIENT_ID --config wrangler.jsonc
   corepack pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.jsonc
   ```
   Nếu hai giá trị đã có trong `.dev.vars`, có thể kiểm tra rồi chuyển trực tiếp
   qua stdin vào Cloudflare Secrets bằng công cụ cấu hình:
   ```bash
   node scripts/configure-google-login.mjs
   node scripts/configure-google-login.mjs --apply
   ```
   Lệnh đầu chỉ kiểm tra cấu hình. Lệnh `--apply` gửi đúng hai giá trị Google
   tới Worker `tipook-web`; không in giá trị, không xuất file chứa secrets,
   không gửi các biến local khác và không đưa secrets vào GitHub.
   Chỉ chạy `--apply` khi người vận hành đã cho phép chuyển thông tin OAuth
   tới Cloudflare. Lưu trong `.dev.vars` không tự cấu hình Worker production.
5. Áp dụng migration `0018_member_username_google.sql` trước khi triển khai:
   `corepack pnpm db:migrate:cloudflare`. Dev server tự áp dụng migration local.

Nút Google có trên cả trang đăng ký và đăng nhập thành viên. Lần đầu đăng nhập
Google tạo tài khoản; những lần sau nhận diện bằng `sub` của Google. Luồng
OAuth dùng authorization code, PKCE, state gắn với cookie trình duyệt và nonce.
Máy chủ xác minh chữ ký RS256, issuer, audience, thời hạn và email đã xác minh
trước khi tạo phiên HttpOnly. Không lưu access token hoặc refresh token.

Khóa công khai của Google được dùng lại theo `Cache-Control` và `Age`, tối đa
6 giờ, tự tải mới khi xuất hiện `kid` chưa có. Khi chưa có khóa trong bộ nhớ,
việc đổi mã và tải khóa chạy đồng thời. Token, nonce và chữ ký vẫn được kiểm
tra cho từng lần đăng nhập. Hồ sơ, ảnh đại diện Google và phiên được ghi trong
một batch D1. Durable Object dọn các phiên và giới hạn đăng nhập đã hết hạn
bằng `waitUntil`, tối đa một lần mỗi 15 phút trên mỗi shard, sau khi có phản hồi.
Mọi lần đọc phiên vẫn kiểm tra hạn và trạng thái tài khoản.

Nếu email Google trùng một tài khoản đã đăng ký bằng mật khẩu, website yêu cầu
đăng nhập bằng mật khẩu của tài khoản đó; không tự ghép hai tài khoản theo email.
Google không cấp phiên quản trị. Email quản trị cần dùng mật khẩu và TOTP.
Tài khoản chỉ dùng Google không hiển thị form đổi mật khẩu địa phương; đăng nhập
bằng Google để truy cập lại tài khoản.

Migration giữ nguyên tài khoản, phiên, mã xác thực email, thiết lập TOTP, mã
khôi phục và các yêu cầu TOTP hiện có khi chuyển email sang trường tùy chọn.

## Kiểm tra

```bash
node scripts/test-member-auth-migration.mjs
node scripts/test-google-oauth.mjs
node scripts/test-google-key-cache.mjs
node --experimental-vm-modules scripts/test-auth-session-cleanup.mjs
node --experimental-vm-modules scripts/test-google-login-flow.mjs
```

Các bài kiểm tra này dùng SQLite trong bộ nhớ và phản hồi Google giả lập.
Kiểm tra API thực bằng `scripts/check-website-auth.mjs` và
`scripts/check-password-recovery.mjs` với state local riêng theo
[ADMIN_TOTP.md](ADMIN_TOTP.md). Sau khi cấu hình OAuth, cần đăng nhập bằng
tài khoản Google thật để kiểm tra consent và redirect URI của từng môi trường.

Tham khảo [Google OAuth cho ứng dụng web](https://developers.google.com/identity/protocols/oauth2/web-server)
và [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
