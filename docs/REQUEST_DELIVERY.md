# Gửi yêu cầu và tin nhắn nội bộ

Yêu cầu `expert-question` chỉ gửi qua web nội bộ, không hiển thị lựa chọn kênh. API xác định tác giả từ `posts.userId` cho bài cộng đồng hoặc danh mục mẫu nhà cho `house-model`, không cho `recipientUserId` từ trình duyệt ghi đè tác giả. Tin nhắn gửi đúng tác giả, kể cả hồ sơ mẫu, không chuyển sang admin. API luôn dùng `internal` dù trình duyệt yêu cầu kênh khác.

Yêu cầu `drawing-file-request` tự động lưu vào hộp thư quản trị viên và gửi thông báo Telegram cho quản trị viên. API luôn dùng `internal` và `telegram`, không cho trình duyệt đổi kênh hoặc người nhận. Form yêu cầu không hiển thị lựa chọn kênh. Yêu cầu `drawing-purchase` dùng web nội bộ theo mặc định.

## Web nội bộ

“Liên hệ admin” (`admin-help`) hỗ trợ một file hoặc ảnh tối đa 25 MB, xem trước ảnh và bỏ tệp đã chọn. Có thể gửi chỉ tệp mà không nhập nội dung. API kiểm tra tệp thuộc tài khoản gửi và được tải lên ở chế độ công khai, lưu đính kèm vào hộp thư admin, gửi nội dung rồi gửi tệp bằng multipart [Telegram sendDocument](https://core.telegram.org/bots/api#senddocument). Người nhận và kênh luôn được xác định ở máy chủ. Nếu Telegram gửi lỗi hoặc thiếu cấu hình, tin nhắn và đính kèm vẫn được lưu trong hộp thư; giao diện báo trạng thái gửi.

Luôn hoạt động sau khi chạy migration `0006_request_delivery.sql`. Tin nhắn được lưu trong `direct_messages` và hiển thị tại trang Tài khoản của người nhận.

“Hỏi chuyên gia” và “Nhắn tin” mở cửa sổ chat với lịch sử hai chiều, gửi bằng Enter (Shift+Enter xuống dòng), đính kèm tệp và trạng thái đã đọc. Trang Tài khoản gom tin theo người trò chuyện, gồm cả tin đã gửi. Hội thoại tự tải tin mới mỗi 3 giây khi trang đang mở. API chỉ cho người dùng xem hội thoại của chính mình và đánh dấu các tin gửi đến mình; có phân trang để xem tin cũ.

Các hồ sơ `virtual-*` là dữ liệu mẫu, không có người dùng thật đăng nhập để trả lời. Chat lưu tin đúng hồ sơ này; để trò chuyện với chuyên gia thật, tác giả phải đăng bài bằng tài khoản thật.

## Telegram

- Secret: `TELEGRAM_BOT_TOKEN`
- Yêu cầu file: cấu hình `TELEGRAM_ADMIN_CHAT_ID` trong `.dev.vars` khi chạy local và môi trường triển khai. Nếu không có, dùng Telegram Chat ID trong hồ sơ nhận tin của quản trị viên.
- Quản trị viên được xác định bằng `TIPOOK_ADMIN_USER_ID` hoặc tài khoản đã đăng nhập có email `TIPOOK_ADMIN_EMAIL`.
- Thông báo yêu cầu file kèm link tuyệt đối tới bài viết (ID bài và vị trí cuộn) hoặc bản vẽ trong danh mục (tìm theo tên). Link dùng tên miền của website nhận yêu cầu; chạy local sẽ dùng localhost.
- Tạo yêu cầu nạp ví gửi thông báo Telegram với mã nạp, số tiền và nội dung chuyển khoản; ghi rõ đang chờ duyệt và chưa cộng tiền. Mua file thành công gửi mã đơn, giá, người mua và link bài viết. Mua lại bài đã mua hoặc thanh toán thất bại không gửi thông báo đơn mới. Lỗi Telegram không làm thất bại giao dịch ví; API trả trạng thái `telegram` để kiểm tra.
- Các yêu cầu khác: dùng Chat ID trong hồ sơ người nhận.
- Bot phải được người nhận khởi tạo hội thoại trước khi có thể gửi tin nhắn riêng.

## Messenger

- Secret: `MESSENGER_PAGE_ACCESS_TOKEN`
- Biến tùy chọn: `META_GRAPH_VERSION`
- Hồ sơ người nhận: `virtual_profiles.messenger_psid`
- Việc gửi phải tuân theo quyền, cửa sổ nhắn tin và message tag do Meta phê duyệt.

## Zalo OA

- Secret: `ZALO_OA_ACCESS_TOKEN`
- Biến tùy chọn: `ZALO_MESSAGE_ENDPOINT`
- Hồ sơ người nhận: `virtual_profiles.zalo_user_id`
- OA và người nhận phải đáp ứng điều kiện nhắn tin của Zalo.

Không ghi token vào mã nguồn. Cấu hình secret trong môi trường triển khai. API trả trạng thái `sent`, `unavailable` hoặc `failed` riêng cho từng kênh và không báo thành công giả khi thiếu cấu hình.
