# Lưu giữ dữ liệu và đối soát tiền

## Dữ liệu thật trên Cloudflare

Database thật là D1 `roomxaydung-db`, ID cố định trong `wrangler.jsonc`. Web ghi giao dịch trực tiếp vào D1 và chờ xác nhận trước khi báo thành công. D1 tồn tại riêng với Worker web: dừng web, thay mã nguồn hoặc bảo trì không xóa database.

Migration `0028_financial_audit.sql` bảo vệ dữ liệu tài chính:

- `wallet_transactions` và `wallet_manual_credits` chỉ cho phép thêm, không sửa/xóa. Hoàn tiền và thu hồi tạo giao dịch đối ứng.
- Giá trị gốc của đơn, khoản cộng, tài khoản nhận và yêu cầu rút được bảo vệ. Thay đổi trạng thái duyệt hoặc tỷ lệ phí vẫn được ghi nhật ký.
- SQLite triggers ghi mọi thay đổi vào `finance_audit_events` trong cùng giao dịch với dữ liệu tiền. Ghi nhật ký thất bại thì thao tác tiền cũng thất bại. Nhật ký không cho sửa/xóa.
- Khi áp dụng migration, dữ liệu tài chính cũ được ghi thành các sự kiện baseline; không sửa số dư cũ.

Worker `tipook-finance-backup` chạy riêng với web, có lịch mỗi phút. Worker đọc nhật ký D1 theo thứ tự, lưu các đoạn vào bucket riêng tư `tipook-finance-backups`, dưới prefix `finance/v1/`. Mỗi đoạn có SHA-256 và liên kết tới đoạn trước. Checkpoint D1 chỉ tăng sau khi R2 xác nhận lưu thành công. Khi lỗi, sự kiện chưa lưu vẫn ở D1 và lần chạy sau thử lại. Mỗi lần tối đa 2.000 sự kiện; backlog lớn hoặc sự cố dịch vụ có thể làm sao lưu chậm hơn một phút.

R2 có rule `finance-retention`, khóa xóa/ghi đè tất cả các bản sao trong 365 ngày. Hết thời gian khóa không tự xóa dữ liệu. Đây là lớp bảo vệ trước thao tác nhầm; chủ tài khoản Cloudflare vẫn có thể thay đổi cấu hình. Bucket không có endpoint tải công khai. Không đặt bucket này sau CDN hay cấp quyền công khai.

D1 Time Travel cung cấp lịch sử phục hồi của Cloudflare, hiện 7 ngày trên gói Free hoặc 30 ngày trên gói Paid. Tham khảo [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) và [R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/). Bản sao R2 bổ sung cho Time Travel; lưu trên cùng tài khoản Cloudflare không bảo vệ khỏi mất quyền truy cập toàn bộ tài khoản.

## Nâng cấp production

```bash
pnpm run db:archive:cloudflare
pnpm run db:migrate:cloudflare
pnpm run build:cloudflare
pnpm run deploy:cloudflare
```

`db:migrate:cloudflare` xuất toàn bộ D1 thành SQL và upload vào R2 dưới `database/v1/` **trước** migration. Lỗi xuất/upload sẽ dừng quy trình. Sau migration, script so sánh toàn bộ giao dịch đã tồn tại trước nâng cấp, không tính giao dịch mới phát sinh trong lúc chạy. Biên bản kiểm tra và bản SQL local nằm trong `.sites-runtime/backups/production/`, không commit lên Git.

Xuất D1 và migration có thể tạm làm database không phục vụ truy vấn. Nên chạy trong khoảng bảo trì; giao dịch chưa được D1 xác nhận không được coi là đã hoàn tất. Quy trình deploy kiểm tra mọi migration đã áp dụng và các trigger bảo vệ sổ ví còn tồn tại; schema thiếu sẽ chặn deploy. Không chạy lệnh deploy Wrangler trực tiếp để bỏ qua bước kiểm tra.

Worker sao lưu dùng config riêng `wrangler.finance-backup.jsonc`; deploy bằng `pnpm run deploy:finance-backup` khi thay đổi mã sao lưu. Web thông thường không triển khai lại Worker này.

Kiểm tra hoạt động bằng truy vấn quản trị D1:

```sql
SELECT last_event_id, last_success_at, last_checked_at, last_error,
  (SELECT coalesce(max(id), 0) FROM finance_audit_events) AS newest_event_id
FROM finance_backup_state WHERE id = 1;
```

`last_event_id` là mốc đã xác nhận trên R2. `newest_event_id` lớn hơn nghĩa là còn sự kiện chờ. `last_success_at` chỉ đổi khi có sự kiện mới được sao lưu; `last_checked_at` là lần kiểm tra gần nhất, kể cả lúc không có giao dịch. `last_error` khác NULL hoặc thời gian kiểm tra quá cũ cần được kiểm tra trong logs của Worker. Hiện trạng thái được lưu và có log lỗi; chưa cấu hình kênh cảnh báo bên ngoài.

## Localhost

`pnpm dev` và `pnpm start` dùng chung ID D1/R2 local và thư mục `.wrangler/state`. `TIPOOK_LOCAL_STATE_PATH`, nếu đặt, áp dụng thống nhất cho cả hai. Build production không làm localhost chuyển sang database local mang ID production nữa. Không xóa `.wrangler/state` khi nâng cấp; Git không chứa dữ liệu local.

Trước khi bộ migration thay đổi, script tạo bản sao SQLite nhất quán, bao gồm dữ liệu đã commit trong WAL, ở `.sites-runtime/backups/`. Sau đó mới áp dụng migration. `.sites-runtime` cũng không được commit.

Lệnh `pnpm run db:backup:local-cloud` sao lưu SQLite local lên vùng riêng `local/v1/` trong bucket riêng tư. Kiểm tra SHA của dữ liệu gốc để chỉ upload khi có thay đổi; chỉ đánh dấu đã upload sau khi tất cả các file và manifest được R2 xác nhận. Dữ liệu local không được nhập vào số dư/đơn hàng thật.

Trên máy Windows này đã có tác vụ `TipookLocalCloudBackup-835E0569078B`, chạy mỗi 5 phút khi tài khoản Windows đang đăng nhập, độc lập với web. Tác vụ cần kết nối Internet và phiên Wrangler Cloudflare hợp lệ. Trạng thái nằm ở `.sites-runtime/local-cloud-backup/status.json`; khi lỗi, dữ liệu gốc vẫn ở máy và lần sau thử lại. Máy tắt, đăng xuất, mất mạng hoặc hết quyền Cloudflare thì không thể gửi dữ liệu local mới. Những bản đã upload vẫn ở Cloudflare. Với giao dịch thật, dùng web production ghi trực tiếp D1, không dùng localhost làm nơi nhận tiền thật.

Nếu chuyển thư mục/máy, cần mang theo `.wrangler/state` hoặc phục hồi từ bản sao, và cài lại tác vụ với `scripts/install-local-cloud-backup.ps1`. Không nhập bản sao local vào production khi chưa đối soát.

## Phục hồi

Trước khi phục hồi, ngừng các thao tác tiền mới và tạo bản sao của trạng thái hiện tại. Dùng một database phục hồi riêng, kiểm tra SHA-256 của SQL/chunk, kiểm tra liên kết chuỗi và phát lại sự kiện theo ID để đối chiếu số dư, đơn hàng, khoản cộng/rút và người thực hiện. Những giao dịch sau thời điểm snapshot phải được lấy thêm từ nhật ký R2; không chỉ nạp một snapshot cũ rồi mở thanh toán lại.

Khôi phục Time Travel ghi đè database hiện tại và có thể bỏ các giao dịch mới hơn mốc chọn. Không tự động restore vào database thật. Sau khi đối soát đủ mới chuyển ứng dụng sang database đã phục hồi.

Kiểm thử: `scripts/test-finance-archive.mjs` xác nhận lỗi nhật ký hủy thao tác tiền, lỗi R2/checkpoint không mất sự kiện, chạy đồng thời không mất đoạn, và dựng lại đúng số dư từ chuỗi sao lưu. `scripts/test-local-data-persistence.mjs` xác nhận snapshot chứa các ghi đã commit trong WAL và các chế độ local dùng chung tài nguyên.

`pnpm run db:verify:cloud-backups` tải thử các bản sao thật từ R2, kiểm tra SHA-256 và tính toàn vẹn SQLite, phục hồi SQL vào database trong bộ nhớ, và kiểm tra các file local trong manifest mới nhất. File tải thử nằm trong `.sites-runtime/cloud-backup-verification/`; lệnh không ghi vào database thật. Đây là kiểm tra phục hồi bản sao, không thay thế đối soát toàn bộ chuỗi trước khi khôi phục production.
