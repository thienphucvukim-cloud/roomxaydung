# NhàĐẹpChất

Website tham khảo mẫu nhà, bản vẽ xây dựng, tính vật tư và gửi yêu cầu tư vấn.

## Công nghệ

- Next.js App Router chạy qua Vinext/Vite
- React và TypeScript
- Tailwind CSS
- Cloudflare Workers, D1 và R2
- Drizzle ORM
- pnpm 11.25.0

## Cấu trúc

```text
app/          Trang, layout và API routes
components/   Thành phần giao diện dùng chung
components/ui Thành phần UI nền đang được sử dụng
db/           Kết nối và schema cơ sở dữ liệu
drizzle/      Migration D1
lib/          Nghiệp vụ dùng chung
public/       Ảnh và font
scripts/      Lệnh cài đặt, build và mở local
build/        Tích hợp môi trường Sites
```

Các thư mục `node_modules/`, `.sites-runtime/`, `.vinext/`, `.wrangler/`
và `dist/` là dữ liệu sinh tự động, không phải mã nguồn.

## Chạy local trên Windows

Nhấp đúp `MO-WEB-LOCAL.bat`. Script tái sử dụng server đang chạy hoặc khởi
động dev server nền tại:

```text
http://localhost:5173/
```

Log local nằm tại `.sites-runtime/local/dev-server.log`.

Trang chủ `/` (Bảng tin) tổng hợp bài công khai từ Mặt tiền, Kho bản vẽ và Nội thất,
xếp mới nhất trước, hỗ trợ tìm kiếm, lọc danh mục và phân trang. Bảng tin tự
cập nhật mỗi 30 giây và dẫn đến đúng bài ở trang gốc; bài bị ẩn hoặc xóa sẽ
không xuất hiện.

## Lệnh phát triển

Menu **Thuê thiết kế** tại `/thue-thiet-ke` là sàn freelancer thiết kế xây dựng được xây mới: hồ sơ chuyên môn, công trình tiêu biểu, tìm freelancer, đăng dự án, gửi đề xuất, chọn cộng sự, trao đổi và bàn giao. Dùng dữ liệu riêng trong các bảng `freelance_*`, không nhập dữ liệu thuê thiết kế cũ. Hướng dẫn: [docs/FREELANCE_MARKETPLACE.md](docs/FREELANCE_MARKETPLACE.md).

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm lint
corepack pnpm build
```

`pnpm dev` có hot reload. `pnpm build` tạo thư mục `dist/`; thư mục này có
thể xóa và tạo lại bất kỳ lúc nào.

Dev server tự áp dụng các migration chưa chạy vào D1 local trước khi mở web.
Khách có thể xem nội dung công khai, tìm kiếm và mở bộ ảnh. Đăng bài, bình luận,
lưu mẫu, chia sẻ, nhắn tin, đánh giá, tính vật tư và sử dụng ví yêu cầu tài khoản
đã đăng nhập. Cookie khách chỉ phục vụ thống kê lượt xem, không cấp quyền tài khoản.

Thành viên đăng ký không cần email, dùng tên đăng nhập và mật khẩu tối thiểu
6 ký tự. Đăng nhập bằng tên đăng nhập, email của tài khoản cũ hoặc Google tại
`/dang-nhap`; cấu hình Google theo [docs/GOOGLE_LOGIN.md](docs/GOOGLE_LOGIN.md).
Chủ website có thanh
công cụ Chỉnh sửa, Quản lý và Cài đặt ngay trên trang đang xem. Cấu hình tài
khoản chủ website theo [docs/WEBSITE_OWNER.md](docs/WEBSITE_OWNER.md).
Quản trị dùng mật khẩu + TOTP và mã khôi phục, không cần dịch vụ gửi email;
thiết lập theo [docs/ADMIN_TOTP.md](docs/ADMIN_TOTP.md).
Khôi phục mật khẩu thành viên qua email cấu hình riêng theo [docs/AUTH_EMAIL.md](docs/AUTH_EMAIL.md).
Chi tiết nạp tiền và cấu hình production nằm trong [docs/PAYMENTS.md](docs/PAYMENTS.md).

## Biến môi trường và dữ liệu

Hướng dẫn kết nối GitHub và triển khai Worker `tipook-web` nằm trong
[docs/CLOUDFLARE.md](docs/CLOUDFLARE.md).

- Sao chép `.dev.vars.example` thành `.dev.vars` nếu cần cấu hình local.
- Binding Cloudflare được khai báo trong `.openai/hosting.json`.
- Không chỉnh sửa migration đã được áp dụng; tạo migration mới bằng
  `corepack pnpm db:generate`.
- Không commit `.dev.vars`, cache, log hoặc dữ liệu runtime.

## Kiểm tra trước khi bàn giao

Khi dev server đang chạy, kiểm tra các luồng chức năng và phân trang:

```bash
node scripts/check-functional-flows.mjs
node scripts/check-facade-pagination.mjs
node scripts/check-website-auth.mjs
node --experimental-vm-modules scripts/test-news-feed.mjs
```

```bash
corepack pnpm lint
corepack pnpm build
```
