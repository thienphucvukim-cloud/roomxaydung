# GitHub và Cloudflare Workers

Repository: `thienphucvukim-cloud/roomxaydung`, nhánh production: `main`.
Worker: `tipook-web`.

URL production: https://tipook-web.thienphuc-vukim.workers.dev

Ngày 01/10/2026, Worker đã được liên kết với repository trên Cloudflare Workers Builds.
Push vào `main` kích hoạt build và deploy tự động; preview builds đang tắt.

## Tài nguyên

- D1: `roomxaydung-db`, binding `DB`.
- R2: `tipook-files`, binding `BUCKET`. Chủ tài khoản phải kích hoạt R2 trên dashboard trước khi tạo bucket.
- Cấu hình production nằm trong `wrangler.jsonc`.
- `pnpm build:cloudflare` dùng binding production; `pnpm dev` và `pnpm build` giữ cấu hình local/Sites.
- `pnpm deploy:cloudflare` kiểm tra binding của bản build trước khi upload, từ chối bản build local.

## Kết nối GitHub

Trong Cloudflare, mở **Workers & Pages → tipook-web → Settings → Builds → Connect**.
Chọn GitHub, cấp quyền Cloudflare GitHub App cho repository `roomxaydung`, rồi đặt:

| Trường | Giá trị |
| --- | --- |
| Repository | `thienphucvukim-cloud/roomxaydung` |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `pnpm run build:cloudflare` |
| Deploy command | `pnpm run deploy:cloudflare` |
| Build variable `NODE_VERSION` | `24.21.0` |
| Build variable `PNPM_VERSION` | `11.25.0` |

Giữ preview builds tắt cho tới khi có tài nguyên D1/R2 riêng cho preview.
Cloudflare tự cài dependencies từ `pnpm-lock.yaml` trước khi build.

Nếu Worker chưa được tạo, dùng **Create application → Import a repository** với cùng cấu hình.
Tên Worker trên dashboard phải khớp `tipook-web` trong `wrangler.jsonc`.

## Database và triển khai đầu tiên

Áp dụng migration lên database đã xác định trước khi đưa ứng dụng vào sử dụng:

```bash
pnpm run db:migrate:cloudflare
pnpm run build:cloudflare
pnpm run deploy:cloudflare
```

Migration là bước riêng; mỗi push thông thường không tự sửa dữ liệu production.
Không dùng file `dist/server/wrangler.json` sinh từ `pnpm build` local để triển khai production.

## Đăng nhập và thanh toán

Bản standalone Cloudflare dùng đăng nhập email và mật khẩu tại `/dang-nhap`.
Áp dụng các migration `0012_website_auth.sql`, `0013_website_content.sql`, `0014_owner_account.sql` và cấu hình
`TIPOOK_ADMIN_EMAIL`, `TIPOOK_ADMIN_PASSWORD` để khởi tạo tài khoản chủ website.
Chi tiết tại [WEBSITE_OWNER.md](WEBSITE_OWNER.md). Worker tiếp tục loại bỏ header
`oai-authenticated-user-*` từ request công khai để ngăn giả mạo tài khoản.

Các biến ngân hàng và secret ký link phải được cấu hình riêng trên Worker theo
[PAYMENTS.md](PAYMENTS.md). Không đưa `.dev.vars` hoặc token Cloudflare lên GitHub.

## Tài liệu

- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
