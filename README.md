# Tipook

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
http://localhost:5173/kho-mau-nha-dep-tipook
```

Log local nằm tại `.sites-runtime/local/dev-server.log`.

## Lệnh phát triển

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm lint
corepack pnpm build
```

`pnpm dev` có hot reload. `pnpm build` tạo thư mục `dist/`; thư mục này có
thể xóa và tạo lại bất kỳ lúc nào.

Dev server tự áp dụng các migration chưa chạy vào D1 local trước khi mở web.
Các phiên khách được tách bằng cookie riêng; lưu mẫu, hồ sơ, tin nhắn và ví
được giữ lại sau khi tải lại trang trong cùng phiên trình duyệt.

Đăng nhập local mô phỏng tài khoản quản trị theo `TIPOOK_ADMIN_EMAIL` trong
`.dev.vars`. Chi tiết nạp tiền và cấu hình production nằm trong
[docs/PAYMENTS.md](docs/PAYMENTS.md).

## Biến môi trường và dữ liệu

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
```

```bash
corepack pnpm lint
corepack pnpm build
```
