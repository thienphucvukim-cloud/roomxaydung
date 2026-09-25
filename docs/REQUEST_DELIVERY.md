# Gửi yêu cầu theo 4 kênh

Các yêu cầu `expert-question` và `drawing-purchase` được định tuyến tới `recipientUserId` của tác giả/người phụ trách.

## Web nội bộ

Luôn hoạt động sau khi chạy migration `0006_request_delivery.sql`. Tin nhắn được lưu trong `direct_messages` và hiển thị tại trang Tài khoản của người nhận.

## Telegram

- Secret: `TELEGRAM_BOT_TOKEN`
- Hồ sơ người nhận: `virtual_profiles.telegram_chat_id`
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