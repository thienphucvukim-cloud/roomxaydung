# GitHub và Cloudflare Workers

Repository: `thienphucvukim-cloud/roomxaydung`, nhánh production: `main`.
Worker: `tipook-web`.

URL production: https://nhadepchat.top

Đăng nhập quản trị: https://nhadepchat.top/admin

Hai Custom Domain `nhadepchat.top` và `www.nhadepchat.top` được khai báo trong
`wrangler.jsonc` để giữ cấu hình qua các lần triển khai. Cloudflare quản lý DNS
và chứng chỉ HTTPS cho hai tên miền này.
URL Workers dự phòng: https://tipook-web.thienphuc-vukim.workers.dev

Ngày 01/10/2026, Worker đã được liên kết với repository trên Cloudflare Workers Builds.
Push vào `main` kích hoạt build và deploy tự động; preview builds đang tắt.

## Tài nguyên

- D1: `roomxaydung-db`, binding `DB`.
- R2: `tipook-files`, binding `BUCKET`. Chủ tài khoản phải kích hoạt R2 trên dashboard trước khi tạo bucket.
- Cấu hình production nằm trong `wrangler.jsonc`.
- `pnpm build:cloudflare` dùng binding production; `pnpm dev` và `pnpm build` giữ cấu hình local/Sites.
- `pnpm deploy:cloudflare` kiểm tra binding và tên miền của bản build trước khi upload, từ chối bản build local hoặc cấu hình cũ.

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

Migration là bước riêng; mỗi push thông thường không tự sửa dữ liệu production. Lệnh migration hiện sao lưu toàn bộ SQL lên R2 trước khi thay đổi schema và kiểm tra các giao dịch cũ sau nâng cấp. Deploy bị chặn nếu schema hoặc trigger bảo vệ ví chưa sẵn sàng. Xem [Lưu giữ dữ liệu và đối soát tiền](DATA_DURABILITY.md).
Không dùng file `dist/server/wrangler.json` sinh từ `pnpm build` local để triển khai production.

## Giới hạn CPU và lỗi 1102

Log `Worker exceeded CPU time limit` là lỗi CPU của từng request, khác lỗi build
và hạn mức sự kiện Observability. Banner miễn phí 200K events/ngày chỉ nói về log,
không xác định gói Workers đang chạy.

Workers Free giới hạn 10 ms CPU/request. Cloudflare từ chối cấu hình
`limits.cpu_ms` trên Free (mã 100328), nên production không đặt giới hạn tùy
chỉnh và deploy không thay đổi gói hoặc thanh toán.

Build Cloudflare tạo HTML, RSC và patch chuyển trang cho 17 giao diện công khai,
cùng mẫu trang bài viết, dự án, freelancer và hồ sơ. Trình dựng không có D1/R2,
cookie hoặc secret; phiên đăng nhập và dữ liệu mới luôn được kiểm tra qua API.
Patch chỉ giữ root layout công khai khi build ID khớp trình duyệt, đồng thời
trả đúng header tương thích RSC. Vì thế menu không mất trạng thái khi chuyển
trang. Bộ lọc và phân trang đọc URL sau hydration; các URL phân trang cũ chuyển
đến cùng danh mục với query tương ứng. Trang hồ sơ tải nội dung qua API, nên
trình duyệt cần JavaScript để hiển thị hồ sơ và các dữ liệu cập nhật.

API được nạp khi Worker khởi động và gọi trực tiếp trong ngữ cảnh headers/cookie
riêng từng request, không qua bộ render React. Xác thực, TOTP, phân quyền,
rate limit và cơ chế bảo vệ ví của từng API vẫn được giữ. API không có cache
chia sẻ dữ liệu tài khoản. Worker loại bỏ header danh tính Sites giả mạo.

Các API còn lại chạy qua binding nội bộ `API_RUNTIME` đến Durable Object
`ApiRuntime`. SQLite-backed Durable Objects có trong gói Free và mặc định
cho phép 30 giây CPU mỗi request; vì vậy scrypt giữ nguyên N=16384, r=8, p=5
và định dạng hash cũ, không làm yếu mật khẩu để ép vào 10 ms. Có 16 shard
stateless; class không đọc/ghi storage, không lưu hoặc log mật khẩu/session,
không có URL public riêng. Ngữ cảnh xác thực vẫn riêng cho từng request.
Migration `api-runtime-v1` tạo namespace mới, không thay đổi D1/R2. Gói Free
giới hạn 100.000 request DO/ngày và 13.000 GB-s/ngày; vượt hạn mức thì request
bị chặn, không tự phát sinh phí. Xem [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
và [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).
Dev/Sites dùng router sẵn có; preview bản build Cloudflare dùng DO local.

Worker đọc `/api/files` trực tiếp từ R2 bằng stream, dùng metadata cho `HEAD`
và vẫn chặn file private. Đường dẫn `/_next/image` dùng bộ kiểm tra ảnh của
Vinext và cùng đường đọc R2 an toàn, không nạp router trang. Khách chưa có
cookie đăng nhập nhận kết quả `/api/me` trực tiếp. URL quét WordPress và 404
không hợp lệ được trả nhẹ. Import động của bộ render chỉ còn dùng cho trình
dựng giao diện khi chưa có asset; guard deploy kiểm tra toàn bộ asset và import.

Kiểm tra hồi quy sau khi start bản build production với state local riêng:

```bash
node --experimental-vm-modules scripts/test-cloudflare-fast-paths.mjs
node scripts/check-cloudflare-request.mjs
node scripts/check-cloudflare-build.mjs
node scripts/test-cloudflare-runtime.mjs
node --experimental-vm-modules scripts/test-admin-member-password-reset.mjs
# TIPOOK_TEST_ORIGIN=http://127.0.0.1:8788
# TIPOOK_TEST_CLOUDFLARE_SHELLS=1 (tạo tài khoản fixture local)
node scripts/test-menu-navigation-browser.mjs
```

Sau deploy, dùng `wrangler tail tipook-web --format json` kiểm tra `cpuTime`
và `outcome` trên trang chủ, đăng nhập, ảnh, API và trang chi tiết. Thời gian
tải trang không phải CPU time. Tài liệu: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Đăng nhập và thanh toán

Ảnh tải mới được nén trên trình duyệt trước khi gửi R2: WebP chất lượng 80%,
giữ nguyên chất lượng và giảm kích thước thêm nếu cần. Ảnh bài đăng/ảnh xem trước có
cạnh dài tối đa 1600 px, dung lượng 512 KB; bình luận 1280 px/256 KB;
avatar 512 px/96 KB. GIF/WebP động được chuyển thành ảnh tĩnh; giữ nền trong suốt.
Ảnh tải mới ở Mẫu nhà đẹp, Kho bản vẽ và Nội thất được đóng logo NhàĐẹpChất
nhỏ, bán trong suốt ở giữa mép dưới trước khi nén. Logo nằm trong tệp WebP
lưu trên R2, kể cả khi thêm/thay ảnh qua Bài viết của tôi hoặc công cụ chỉnh
sửa ảnh mẫu của quản trị. Ảnh đã lưu trước đó, ảnh bảng tin, bình luận,
avatar và file hồ sơ riêng tư giữ nguyên.
Máy chủ kiểm tra RIFF WebP, kích thước khung và dung lượng, rồi gắn metadata
xác nhận. API đăng bài, thêm ảnh và bình luận kiểm tra metadata này, ngăn gửi
ảnh gốc hoặc tái sử dụng ảnh cũ chưa tối ưu cho nội dung mới. Ảnh đang gắn với
bài/bình luận cũ vẫn hiển thị và được giữ khi sửa bài. File hồ sơ riêng tư và
tài liệu không bị chuyển đổi. Không cần binding Images hoặc dịch vụ trả phí.
Kiểm tra: `node scripts/test-image-upload-policy.mjs`,
`node scripts/test-image-upload-runtime.mjs` (state local riêng),
`node scripts/test-news-feed-browser.mjs`.

Bản standalone Cloudflare dùng đăng nhập email và mật khẩu tại `/dang-nhap`.
Áp dụng các migration `0012_website_auth.sql`, `0013_website_content.sql`, `0014_owner_account.sql` và cấu hình
`TIPOOK_ADMIN_EMAIL`, `TIPOOK_ADMIN_PASSWORD` để khởi tạo tài khoản chủ website.
Áp dụng toàn bộ migration đến `0017_admin_totp.sql` và cấu hình `TIPOOK_MFA_KEY` theo
[ADMIN_TOTP.md](ADMIN_TOTP.md). Quản trị dùng mật khẩu + TOTP, không cần gửi email.
Khôi phục mật khẩu thành viên qua email cấu hình riêng theo [AUTH_EMAIL.md](AUTH_EMAIL.md).
Chi tiết tại [WEBSITE_OWNER.md](WEBSITE_OWNER.md). Worker tiếp tục loại bỏ header
`oai-authenticated-user-*` từ request công khai để ngăn giả mạo tài khoản.

Các biến ngân hàng và secret ký link phải được cấu hình riêng trên Worker theo
[PAYMENTS.md](PAYMENTS.md). Không đưa `.dev.vars` hoặc token Cloudflare lên GitHub.

## Tài liệu

- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
