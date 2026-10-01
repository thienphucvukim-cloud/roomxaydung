# Bản vá phản hồi hàng đợi Codex trên máy này

Ngày kiểm tra: 01/10/2026. Extension: `openai.chatgpt` phiên bản `26.928.31416`; CLI đi kèm: `0.159.2`.

Log VS Code ghi nhiều lần `Failed to release queued message send lock` và `"undefined" is not valid JSON`. Đối chiếu mã đang cài cho thấy handler `queued-follow-up-send-lock-release` trả về `undefined`; cầu nối nội bộ gửi `JSON.stringify(undefined)`, còn webview gọi `JSON.parse` trên giá trị này.

Bản vá thay đúng một biểu thức trong `out/extension.js`: `JSON.stringify(o)` thành `JSON.stringify(o)??"null"` tại phản hồi của cầu nối nội bộ VS Code. Phản hồi không có giá trị trở thành JSON `null`; các phản hồi JSON hiện có được giữ nguyên. Không thay logic khóa, chống gửi trùng, quyền truy cập hoặc dữ liệu hội thoại.

Đây là lỗi xác nhận được trong đường xử lý hàng đợi. Handler giải phóng khóa trước khi lỗi đọc JSON xảy ra, và phía gọi có bắt lỗi; vì vậy chưa đủ bằng chứng khẳng định đây là nguyên nhân duy nhất khiến tin nhắn bị kẹt. Không ép phát lại tin nhắn có kết quả gửi chưa xác định.

## Kích hoạt và kiểm tra trong VS Code

1. Sau khi lượt sửa này kết thúc, nhấn `Ctrl+Shift+P` rồi chọn `Developer: Reload Window`.
2. Mở luồng từng bị kẹt, gửi một yêu cầu ngắn bằng `Enter`. Workspace đã có `chatgpt.followUpQueueMode: steer`.
3. Kiểm tra Codex nhận tin và tiếp tục trả lời. Theo tài liệu OpenAI, `Ctrl+Shift+Enter` đảo hành vi hàng đợi cho riêng một tin; với `steer`, tổ hợp này vẫn có thể đưa tin vào hàng đợi.
4. Kiểm tra log mới không còn lỗi JSON nói trên. Nếu còn tin trong hàng đợi, kiểm tra yêu cầu duyệt quyền và dùng thao tác gửi ngay của giao diện nếu có. Chỉ phát lại tin khi biết lượt trước chưa thực hiện công việc.

Nguồn: [OpenAI Docs — Developer settings](https://learn.chatgpt.com/docs/developer-settings?surface=ide), [OpenAI Docs — Stuck states and recovery patterns](https://learn.chatgpt.com/docs/reference/troubleshooting#stuck-states-and-recovery-patterns).

## Kiểm chứng và hoàn tác

Bản gốc ở `extension.original.js`, bản đã kiểm tra ở `extension.patched.js`, checksum ở `manifest.json` trong thư mục này. Các tệp này được loại khỏi Git.

Chạy trong PowerShell tại thư mục dự án:

```powershell
& 'F:\DEV\VSCode\node-v24.21.0-win-x64\node.exe' '.vscode\codex-repair\repair.cjs' --verify
```

Kiểm tra tái hiện lỗi gốc bằng handler đang cài, xác nhận phản hồi rỗng đọc được, giữ nguyên tham số giải phóng khóa và chín loại phản hồi JSON, tiếp tục từ chối dữ liệu không thể chuyển thành JSON, đồng thời kiểm tra cú pháp toàn bộ extension và checksum.

Để hoàn tác, dùng cùng lệnh với `--restore`, rồi tải lại cửa sổ. Việc ghi vào thư mục extension cần quyền của người dùng Windows; công cụ chỉ hoàn tác nếu checksum đúng với bản đã vá.

Đây là bản vá cục bộ. Cập nhật hoặc cài lại extension có thể ghi đè nó. Công cụ chỉ hỗ trợ phiên bản đã kiểm tra và sẽ dừng nếu mã hoặc phiên bản thay đổi; không tự vá một bản mới chưa được xem xét. Chưa kiểm chứng trực tiếp giao diện sau khi tải lại và không có bảo đảm mọi dạng kẹt luồng sẽ được loại bỏ.
