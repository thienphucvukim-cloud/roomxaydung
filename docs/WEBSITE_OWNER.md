# Website của bạn: đăng nhập và chỉnh sửa trực tiếp

## Sử dụng

1. Mở trang đăng nhập quản trị tại `https://nhadepchat.top/admin` (local: `/admin`).
2. Đăng nhập với email và mật khẩu chủ website.
   Nhập tiếp mã 6 chữ số từ ứng dụng xác thực. Lần đầu quét QR và lưu mã khôi phục.
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

- Nội dung: tìm kiếm, sửa, ẩn/hiện và xóa bài cộng đồng.
- Yêu cầu: đọc nội dung và liên hệ, cập nhật trạng thái tư vấn gửi tới bạn.
- Thành viên: tra cứu tài khoản và hồ sơ.
- Giao dịch: duyệt nạp tiền sau khi kiểm tra sao kê và đối soát bản vẽ đã bán.
- Cài đặt: diện mạo website, mật khẩu và trạng thái kết nối dữ liệu.

Các mục ẩn bởi chủ website không xuất hiện trong danh sách công khai và không thể
được mua mới. Người đã mua vẫn có lịch sử giao dịch của họ.

Để xóa bài đăng, mở **Quản lý → Nội dung**, nhấn **Xóa** ở dòng bài đăng hoặc
trong khung chỉnh sửa và xác nhận. Bài được chuyển vào **Thùng rác**, không còn
xuất hiện trong danh sách công khai hoặc tìm kiếm. File và lịch sử mua được giữ
để người đã mua tiếp tục tải bản vẽ của họ.
Chọn bộ lọc **Thùng rác → Khôi phục** để lấy lại bài ở trạng thái ẩn;
chọn **Đã ẩn → Hiện** khi muốn đăng lại.

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
Đăng nhập và đổi mật khẩu chủ website dùng TOTP theo [ADMIN_TOTP.md](ADMIN_TOTP.md),
không cần dịch vụ gửi email. Chạy `node scripts/setup-admin-mfa.mjs` để tạo khóa local.

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

Chạy `node scripts/setup-admin-mfa.mjs --cloudflare` để tạo secret `TIPOOK_MFA_KEY`.
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

Tài khoản quản lý xác nhận TOTP khi đăng nhập và đổi mật khẩu. Khi quên mật khẩu,
khôi phục bằng mã dự phòng tại `/quen-mat-khau?role=admin`; chức năng này thu hồi
mọi phiên cũ và vẫn giữ TOTP. Xem [ADMIN_TOTP.md](ADMIN_TOTP.md). Đăng ký thành viên
không xác minh quyền sở hữu email; riêng email chủ website được giữ để khởi tạo bằng
mật khẩu bí mật phía máy chủ. Tài khoản thành viên có sẵn chỉ trở thành chủ website
khi nhập đúng mật khẩu khởi tạo được cấu hình trên máy chủ; các phiên cũ của tài khoản
đó bị thu hồi khi kích hoạt quyền chủ website.

## Hỗ trợ thành viên quên mật khẩu

Trong **Quản trị → Thành viên**, tìm theo tên, email hoặc tên đăng nhập, kiểm tra
mã tài khoản rồi chọn **Đặt lại mật khẩu**. Chỉ hỗ trợ sau khi xác minh chủ tài
khoản qua kênh liên hệ hoặc thông tin đã có từ trước; tên hiển thị đơn thuần
không đủ để xác minh. Hệ thống yêu cầu ghi cách xác minh (10–500 ký tự), xác nhận
đã xác minh, nhập mật khẩu mới (10–128 ký tự) hai lần và mật khẩu quản trị hiện tại.
Việc xác minh do người quản trị thực hiện; hệ thống lưu xác nhận này để đối soát.

Sau khi đặt lại, mọi phiên đăng nhập và mã xác nhận/khôi phục cũ của thành viên
bị thu hồi. Chuyển mật khẩu mới qua kênh đã xác minh và hướng dẫn thành viên
đổi mật khẩu sau khi đăng nhập. Không ghi mật khẩu hay giấy tờ nhạy cảm vào nội
dung xác minh. Lịch sử ghi admin thực hiện, thời gian và cách xác minh; không
lưu mật khẩu. Thao tác đổi mật khẩu, ghi lịch sử và thu hồi phiên chạy trong
một giao dịch; lỗi ghi lịch sử sẽ hủy toàn bộ thay đổi.

Chức năng hỗ trợ cả tài khoản không có email, chỉ áp dụng cho tài khoản đăng
nhập của thành viên. Tài khoản quản trị dùng quy trình khôi phục riêng. API
`/api/admin/member-password` kiểm tra quyền admin, nguồn yêu cầu, mật khẩu quản trị
và giới hạn số lần thử. Cần áp dụng migration
`drizzle/0022_admin_member_password_resets.sql` trước khi sử dụng trên máy chủ.

## Kiểm tra

Khởi động server kiểm tra với state riêng theo [ADMIN_TOTP.md](ADMIN_TOTP.md):

```bash
node scripts/test-totp-crypto.mjs
node scripts/check-admin-totp.mjs
node scripts/check-website-auth.mjs
node scripts/check-password-recovery.mjs
node --experimental-vm-modules scripts/test-admin-member-password-reset.mjs
node scripts/check-functional-flows.mjs
node scripts/check-facade-pagination.mjs
```

Các kiểm tra tạo fixture trên database local và dọn dữ liệu thử, không gọi giao dịch
ngân hàng thật.
