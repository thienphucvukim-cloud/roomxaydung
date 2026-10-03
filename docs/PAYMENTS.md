# Ví nạp, ví bán file và thanh toán thủ công

NhàĐẹpChất không dùng payOS. Người dùng chuyển khoản trực tiếp vào tài khoản ngân hàng của admin; admin kiểm tra sao kê và duyệt thủ công trước khi hệ thống cộng số dư.

Sổ ví và nhật ký tài chính được bảo vệ bởi migration `0028_financial_audit.sql`, với Worker sao lưu riêng sang R2 mỗi phút. Xem [Lưu giữ dữ liệu và đối soát tiền](DATA_DURABILITY.md) về nâng cấp, sao lưu local/Cloudflare và phục hồi đối soát.

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

1. Người dùng đăng ký hoặc đăng nhập tài khoản, sau đó tạo yêu cầu nạp tại trang Tài khoản. Phiên khách không được nạp ví hoặc mua file.
2. Máy chủ tạo mã riêng và nội dung chuyển khoản, sau đó hiển thị QR chuyển khoản vào ngân hàng admin.
3. Yêu cầu giữ trạng thái `pending`; ảnh biên lai hoặc nút xác nhận của người dùng không làm tăng số dư.
4. Chủ website chọn **Quản lý → Giao dịch** ngay trên trang, kiểm tra tiền thực tế trong tài khoản ngân hàng rồi bấm Duyệt. Đường dẫn cũ `/quan-tri/nap-tien` chuyển về bảng quản lý này.
5. API quản trị kiểm tra ID hoặc email từ phiên đăng nhập đã xác thực và ghi giao dịch cộng tiền vào sổ cái. Một yêu cầu chỉ được cộng tiền một lần.
6. Khi mua file, máy chủ tự lấy giá, chỉ trừ ví nạp bằng câu lệnh nguyên tử và lưu tác giả để admin đối soát, cộng vào ví bán file theo từng đơn.

## Hai ví và tiền bán file

- **Ví nạp** nhận tiền nạp được duyệt, cộng bù thủ công và tiền chuyển từ ví bán file. Mua file và quảng cáo chỉ trừ ví này. Ví nạp không có chức năng rút hoặc chuyển sang ví bán file.
- **Ví bán file** nhận đúng giá trị của đơn mua có trả tiền khi admin bấm **Cộng ví bán file** tại **Quản lý → Giao dịch → File bản vẽ đã bán**. Không nhận số tiền hay tài khoản người bán từ client. Mỗi đơn chỉ cộng một lần, lưu admin và thời gian cộng; file miễn phí không tạo tiền bán.
- Ví bán file hiện màu sáng khi số dư lớn hơn 0. Từng khoản chờ **36 giờ kể từ lúc admin cộng**, không tính từ lúc khách mua. Trang Tài khoản hiển thị số tiền đang chờ, số tiền đã đủ thời gian và thời điểm từng khoản được dùng. Khoản chưa đủ 36 giờ không được rút hoặc chuyển sang ví nạp.
- Khi đủ 36 giờ, người bán có thể chuyển tiền sang ví nạp một chiều hoặc yêu cầu rút **tối thiểu 50.000đ** về ngân hàng. Mỗi thao tác tối đa 20.000.000đ. Chuyển nội bộ không áp dụng mức tối thiểu 50.000đ.

## Yêu cầu rút và thu hồi khi có khiếu nại

Người bán nhập số tiền, ngân hàng, số tài khoản và tên chủ tài khoản. API `/api/wallet/sales` lấy người bán từ phiên đăng nhập, kiểm tra số tiền đã đủ 36 giờ và giữ tiền ngay khi tạo yêu cầu `pending`. Khoản đã giữ không thể tiếp tục rút hoặc chuyển. Sổ cái và yêu cầu được ghi trong cùng batch nguyên tử. Cùng mã yêu cầu chỉ được xử lý một lần; mã đang chờ xác nhận được giữ trong sessionStorage để gửi lại khi mất mạng hoặc tải lại tab.

Admin chuyển khoản thủ công tại **Thanh toán tiền bán file**, nhập mã giao dịch ngân hàng và bấm **Đã chuyển khoản**. Trạng thái thành `paid`; không trừ tiền lần nữa. Nếu từ chối, admin phải nhập lý do; batch hoàn tiền về ví bán file và chuyển yêu cầu sang `rejected` đồng thời. Người bán thấy trạng thái và ghi chú tại Tài khoản. Website không tự chuyển khoản ngân hàng.

Admin có thể **Thu hồi tiền bán file** theo từng đơn đã cộng khi có khiếu nại, kể cả sau 36 giờ, và bắt buộc nhập lý do. Hệ thống ghi giao dịch âm vào ví bán file, lưu admin/thời gian/lý do; khoản đã thu hồi không thể được cộng lại bằng nút duyệt cũ. Những yêu cầu rút đang chờ của người bán được hủy và hoàn ví trong cùng batch trước khi thu hồi. Nếu tiền đã rút hoặc chuyển đi, ví bán file có thể âm; doanh thu tiếp theo đối trừ khoản thiếu trước khi cho rút hoặc chuyển. Ví nạp và tiền đã chuyển khoản ra ngoài không tự bị trừ hay thu hồi qua ngân hàng.

API quản trị `/api/admin/wallet-sales` kiểm tra phiên admin và nguồn yêu cầu cho việc cộng, thu hồi, xác nhận thanh toán hoặc từ chối. Gửi lại hoặc xử lý đồng thời không cộng, hoàn hoặc thu hồi trùng.

Áp dụng `drizzle/0026_split_wallets.sql` trước khi sử dụng. Toàn bộ giao dịch và số dư cũ được giữ trong **ví nạp**; không tự suy đoán các khoản cộng thủ công trước đây là doanh thu. Với đơn cũ đã thanh toán cho tác giả, admin cần đối soát trước khi bấm cộng ví bán file để tránh trả lần hai.

Kiểm tra bằng `node --experimental-vm-modules scripts/test-split-wallets.mjs`: migration giữ số dư cũ, phân quyền, ranh giới đúng 36 giờ, mức rút 50.000đ, chuyển một chiều, gửi lại, xử lý đồng thời, hoàn tiền, thu hồi sau thanh toán và rollback khi lỗi.

## Cộng tiền thủ công

Trong **Quản lý → Giao dịch → Cộng tiền thủ công vào ví nạp**, admin tìm và chọn tài khoản đã đăng ký, nhập số tiền nguyên từ 1đ đến 20.000.000đ cùng lý do (tối đa 500 ký tự), rồi bấm cộng tiền. Không cần tạo yêu cầu nạp tiền trước đó. Kiểm tra lịch sử nạp để tránh cộng bù cho khoản đã được duyệt. Tiền bán file phải cộng theo đơn bằng chức năng riêng.

API `/api/admin/wallet-credits` kiểm tra phiên quản trị và nguồn yêu cầu. Một lần cộng ghi đồng thời giao dịch dương vào `wallet_transactions` và bản ghi đối soát trong `wallet_manual_credits`: tài khoản nhận, số tiền, lý do, ID admin thực hiện, thời gian máy chủ, mã giao dịch và mã yêu cầu duy nhất. Số dư và lịch sử ví sử dụng giao dịch này ngay như các khoản nạp khác.

Nếu mất mạng hoặc chưa xác định kết quả, nút **Kiểm tra / gửi lại** giữ cùng mã yêu cầu để không cộng trùng. Yêu cầu đang chờ được lưu trong bộ nhớ phiên của tab, kể cả khi tải lại trang. Cùng mã nhưng khác tài khoản, số tiền, lý do hoặc admin sẽ bị từ chối. Các lần cộng mới có mã riêng; hệ thống không tự đối chiếu chúng với giao dịch ngân hàng hay yêu cầu nạp đã duyệt.

Áp dụng `drizzle/0021_wallet_manual_credits.sql` trước khi dùng chức năng. Local tự áp dụng khi khởi động qua `npm run dev`; production chạy migration theo quy trình triển khai hiện có (`npm run db:migrate:cloudflare`). Kiểm tra riêng chức năng bằng `node --experimental-vm-modules scripts/test-wallet-manual-credits.mjs`.

## File bản vẽ

Trong **Quản lý → Giao dịch → File bản vẽ đã bán**, phí admin mặc định 20%: người bán nhận 80% giá đơn. Admin có thể nhập phí khác, ví dụ 25% hoặc 30%; số tiền hiển thị và nút cộng ví cập nhật ngay theo tỷ lệ 75:25 hoặc 70:30. Bấm **Lưu tỷ lệ** trước khi cộng. Tỷ lệ được lưu dùng chung cho các đơn chưa cộng, kể cả sau khi tải lại trang.

Máy chủ tự tính khoản cộng bằng giá đơn nhân tỷ lệ người bán, làm tròn xuống đến đồng. Phần còn lại là phí admin. Mỗi khoản đã cộng lưu giá gốc, tỷ lệ phí và tiền thực nhận; đổi tỷ lệ không sửa lịch sử. Thu hồi chỉ trừ số tiền đã cộng sau phí. Các khoản cũ trước migration vẫn giữ nguyên số tiền và tỷ lệ 100:0.

Áp dụng `drizzle/0027_sale_commission.sql` sau `0026_split_wallets.sql` trước khi dùng tính năng. Local tự áp dụng khi khởi động qua `npm run dev`; production áp dụng theo `npm run db:migrate:cloudflare`. Kiểm tra bằng `node --experimental-vm-modules scripts/test-split-wallets.mjs`.

File bán được lưu private trong R2. API công khai không đọc được file private. Sau khi mua thành công, hệ thống tạo link có chữ ký gắn với tài khoản mua và hết hạn sau 24 giờ. Link tải luôn trả về dạng attachment, có `nosniff` và CSP sandbox.

Tệp không đặt giá được tải miễn phí. Nút “Tải lại” trong lịch sử ví cấp liên kết mới cho hồ sơ đã mua và không trừ tiền thêm. Máy chủ kiểm tra file và ký liên kết trước khi trừ số dư. Mua đồng thời cùng một hồ sơ chỉ ghi một giao dịch.

Các bản vẽ có sẵn trong danh mục là nội dung tham khảo chưa có file bán thật; API không trừ tiền cho các mục này. Người đăng cần tải hồ sơ thực tế lên để bán qua bài cộng đồng.

## Kiểm tra local

`.dev.vars` bị loại khỏi Git. Chạy `node scripts/setup-owner.mjs` để tạo mật khẩu khởi tạo nếu chưa có; khởi động lại server và đăng nhập tại `/admin`. Chọn **Quản lý → Giao dịch** để duyệt yêu cầu. Cookie mô phỏng cũ không cấp quyền quản trị.

Chạy `node scripts/check-functional-flows.mjs` khi dev server đang mở. Bộ kiểm tra dùng hai phiên riêng, đăng dữ liệu thử, duyệt nạp thử trong database local, kiểm tra mua đồng thời và quyền tải file, rồi dọn dữ liệu đã tạo. Không có giao dịch ngân hàng thật.

## Migration

Áp dụng `drizzle/0011_wallet_transactions.sql` sau các migration hiện có trước khi bật tính năng ví.


## Cấu hình Cloudflare

Đặt các giá trị nhạy cảm bằng các lệnh `wrangler secret put ADMIN_BANK_ACCOUNT`, `wrangler secret put ADMIN_BANK_NAME`, `wrangler secret put TIPOOK_ADMIN_EMAIL` (hoặc `TIPOOK_ADMIN_USER_ID`) và `wrangler secret put DOWNLOAD_LINK_SECRET`. `ADMIN_BANK_CODE` có thể đặt bằng biến môi trường thường. `.dev.vars` chỉ cung cấp cấu hình local; các giá trị phải được cấu hình riêng trên máy chủ production.

Áp dụng migration lên D1 production bằng lệnh tương ứng với cấu hình triển khai: `wrangler d1 execute DB --remote --file drizzle/0011_wallet_transactions.sql`. Kiểm tra đúng database trước khi chạy.
