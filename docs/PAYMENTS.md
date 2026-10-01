# Ví Tipook và nạp tiền thủ công

Tipook không dùng payOS. Người dùng chuyển khoản trực tiếp vào tài khoản ngân hàng của admin; admin kiểm tra sao kê và duyệt thủ công trước khi hệ thống cộng số dư.

## Biến môi trường bắt buộc

Các giá trị này chỉ được cấu hình phía máy chủ, không dùng tiền tố `NEXT_PUBLIC_`:

- `ADMIN_BANK_CODE`: mã ngân hàng dùng cho VietQR, ví dụ `VCB`.
- `ADMIN_BANK_ACCOUNT`: số tài khoản nhận tiền của admin.
- `ADMIN_BANK_NAME`: tên chủ tài khoản.
- `TIPOOK_ADMIN_USER_ID` hoặc `TIPOOK_ADMIN_EMAIL`: ID hoặc email đăng nhập đã xác thực được phép duyệt nạp tiền. Không dùng tên hiển thị làm ID.
- `TIPOOK_ADMIN_PASSWORD`: mật khẩu khởi tạo tài khoản chủ website, tối thiểu 10 ký tự. Chỉ dùng khi tài khoản chưa tồn tại; sau đó đổi mật khẩu trong Cài đặt trên website.
- `ADMIN_BANK_QR_IMAGE` (tùy chọn): đường dẫn ảnh QR dự phòng trong `/payments/`, phải thuộc đúng tài khoản nhận tiền đang cấu hình.
- `DOWNLOAD_LINK_SECRET`: chuỗi bí mật ngẫu nhiên dài dùng để ký link tải 24 giờ.

Cloudflare D1 phải được bind với tên `DB`, R2 bind với tên `BUCKET`. Có thể dùng gói miễn phí khi lượng người dùng còn thấp.

## Luồng nạp tiền

1. Người dùng tạo yêu cầu nạp tại trang Tài khoản.
2. Máy chủ tạo mã riêng và nội dung chuyển khoản, sau đó hiển thị QR chuyển khoản vào ngân hàng admin.
3. Yêu cầu giữ trạng thái `pending`; ảnh biên lai hoặc nút xác nhận của người dùng không làm tăng số dư.
4. Chủ website chọn **Quản lý → Giao dịch** ngay trên trang, kiểm tra tiền thực tế trong tài khoản ngân hàng rồi bấm Duyệt. Đường dẫn cũ `/quan-tri/nap-tien` chuyển về bảng quản lý này.
5. API quản trị kiểm tra ID hoặc email từ phiên đăng nhập đã xác thực và ghi giao dịch cộng tiền vào sổ cái. Một yêu cầu chỉ được cộng tiền một lần.
6. Khi mua file, máy chủ tự lấy giá, trừ số dư bằng câu lệnh nguyên tử và lưu tác giả để admin đối soát, trả tiền riêng.

## File bản vẽ

File bán được lưu private trong R2. API công khai không đọc được file private. Sau khi mua thành công, hệ thống tạo link có chữ ký gắn với tài khoản mua và hết hạn sau 24 giờ. Link tải luôn trả về dạng attachment, có `nosniff` và CSP sandbox.

Tệp không đặt giá được tải miễn phí. Nút “Tải lại” trong lịch sử ví cấp liên kết mới cho hồ sơ đã mua và không trừ tiền thêm. Máy chủ kiểm tra file và ký liên kết trước khi trừ số dư. Mua đồng thời cùng một hồ sơ chỉ ghi một giao dịch.

Các bản vẽ có sẵn trong danh mục là nội dung tham khảo chưa có file bán thật; API không trừ tiền cho các mục này. Người đăng cần tải hồ sơ thực tế lên để bán qua bài cộng đồng.

## Kiểm tra local

`.dev.vars` bị loại khỏi Git. Chạy `node scripts/setup-owner.mjs` để tạo mật khẩu khởi tạo nếu chưa có; khởi động lại server và đăng nhập tại `/dang-nhap`. Chọn **Quản lý → Giao dịch** để duyệt yêu cầu. Cookie mô phỏng cũ không cấp quyền quản trị.

Chạy `node scripts/check-functional-flows.mjs` khi dev server đang mở. Bộ kiểm tra dùng hai phiên riêng, đăng dữ liệu thử, duyệt nạp thử trong database local, kiểm tra mua đồng thời và quyền tải file, rồi dọn dữ liệu đã tạo. Không có giao dịch ngân hàng thật.

## Migration

Áp dụng `drizzle/0011_wallet_transactions.sql` sau các migration hiện có trước khi bật tính năng ví.


## Cấu hình Cloudflare

Đặt các giá trị nhạy cảm bằng các lệnh `wrangler secret put ADMIN_BANK_ACCOUNT`, `wrangler secret put ADMIN_BANK_NAME`, `wrangler secret put TIPOOK_ADMIN_EMAIL` (hoặc `TIPOOK_ADMIN_USER_ID`) và `wrangler secret put DOWNLOAD_LINK_SECRET`. `ADMIN_BANK_CODE` có thể đặt bằng biến môi trường thường. `.dev.vars` chỉ cung cấp cấu hình local; các giá trị phải được cấu hình riêng trên máy chủ production.

Áp dụng migration lên D1 production bằng lệnh tương ứng với cấu hình triển khai: `wrangler d1 execute DB --remote --file drizzle/0011_wallet_transactions.sql`. Kiểm tra đúng database trước khi chạy.
