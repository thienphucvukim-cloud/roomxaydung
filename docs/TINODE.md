# Tích hợp Tinode

Trang chat của ROOM nằm tại `/chat` và dùng package chính thức `tinode-sdk`.

## Chạy thử

Mặc định ứng dụng kết nối `sandbox.tinode.co`. Có thể đăng nhập bằng `alice / alice123`, `bob / bob123`, hoặc các tài khoản demo khác do Tinode cung cấp. Sandbox xóa dữ liệu mỗi ngày.

## Production / self-host

Triển khai máy chủ từ repository chính thức: https://github.com/tinode/chat

Cấu hình hai biến môi trường public khi build frontend:

- `NEXT_PUBLIC_TINODE_HOST`: hostname và cổng Tinode, ví dụ `chat.example.com` hoặc `localhost:6060`.
- `NEXT_PUBLIC_TINODE_API_KEY`: API key do công cụ `keygen` của Tinode tạo.

Khi dùng HTTPS cho website, máy chủ Tinode cũng phải hỗ trợ WSS/TLS. Không dùng API key sandbox cho production.

## Chức năng đã nối

- Kết nối WebSocket trực tiếp tới Tinode.
- Đăng nhập basic và tạo tài khoản.
- Đồng bộ danh sách hội thoại, trạng thái online và chưa đọc.
- Tải lịch sử topic và nhận tin nhắn thời gian thực.
- Gửi tin, đánh dấu đã đọc, mở topic/UID và đăng xuất.
- Giao diện desktop/mobile tích hợp trong ROOM.