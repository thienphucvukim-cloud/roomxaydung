# Sàn freelancer thiết kế xây dựng

`/thue-thiet-ke` được xây lại hoàn toàn, dùng các bảng `freelance_*` trong migration `0031_freelance_marketplace.sql`. Không chuyển hồ sơ, dự án hoặc hợp đồng từ tính năng cũ. Các migration cũ chỉ là lịch sử database; không có API hay giao diện sử dụng chúng.

## Cấu trúc

- **Tìm freelancer:** hồ sơ do thành viên tự tạo, chuyên môn chính, kỹ năng, địa điểm, kinh nghiệm, đơn giá tham khảo, trạng thái nhận việc và tối đa 6 công trình tiêu biểu. Bộ lọc chuyên môn, trạng thái nhận việc, từ khóa; sắp xếp mới nhất, kinh nghiệm hoặc đơn giá.
- **Tìm dự án:** nhu cầu đang mở với chuyên môn, mô tả, địa điểm, ngân sách và thời gian dự kiến. Lọc theo chuyên môn/ngân sách, tìm kiếm, sắp xếp và phân trang 6 kết quả.
- **Dự án của tôi:** dự án do thành viên đăng, đã gửi đề xuất hoặc nhận thực hiện.
- **Hồ sơ freelancer:** `/thue-thiet-ke/freelancer/[id]`. Công trình dùng liên kết HTTPS do freelancer cung cấp; không gán đánh giá, chứng nhận hoặc kinh nghiệm giả. Trao đổi trước dự án sử dụng hộp thư chung của website.
- **Dự án:** `/thue-thiet-ke/[id]`. Người đăng xem mọi đề xuất; freelancer chỉ xem đề xuất của mình. Mỗi người gửi tối đa một đề xuất cho một dự án và được cập nhật khi dự án còn mở.

## Luồng thực hiện

1. Đăng nhập, tạo dự án; có thể đính kèm tài liệu đầu vào sau khi đăng.
2. Freelancer tạo hồ sơ, gửi đề xuất gồm giá trọn gói, số ngày và phạm vi/hồ sơ bàn giao.
3. Người đăng xác nhận chọn một đề xuất. Giá và thời gian được ghi lại, dự án chuyển sang `working`.
4. Hai bên trao đổi riêng trong dự án. Freelancer nộp tệp hồ sơ rồi gửi xác nhận bàn giao (`delivered`).
5. Bên thuê yêu cầu điều chỉnh (`working`) hoặc xác nhận hoàn thành (`completed`). Dự án hoàn thành được tính vào hồ sơ freelancer. Người đăng có thể đóng một dự án chưa tuyển (`cancelled`).

Nền tảng hiện hỗ trợ kết nối và quản lý công việc; không cung cấp giữ tiền, hợp đồng điện tử, thu phí hay xử lý tranh chấp. Hai bên thống nhất thanh toán trực tiếp.

## Quyền và dữ liệu

API nằm tại `/api/freelance`, `/profiles`, `/projects` và `/files`. Thao tác ghi yêu cầu tài khoản đang hoạt động và kiểm tra nguồn yêu cầu. Chọn freelancer và đổi trạng thái kiểm tra trạng thái ngay trong câu SQL, tránh hai yêu cầu đồng thời chọn hai người. Đăng dự án và gửi tin dùng UUID để tránh tạo trùng khi thử lại.

Mọi người xem nhu cầu dự án; chỉ người đăng và freelancer được chọn xem trao đổi và tệp bàn giao. Thành viên đăng nhập được tải tệp đầu vào. Tệp lưu dưới `freelance/` trên R2, tải bằng API có kiểm tra quyền, luôn tải xuống thay vì thực thi trong trình duyệt. Giới hạn 100 MB/tệp, 50 tệp/dự án. Cho phép PDF, bản vẽ, ảnh, tài liệu và tệp nén; không cho phép tệp thực thi.

Khởi động local qua `MO-WEB-LOCAL.bat` hoặc `pnpm dev` để áp dụng migration mới. Khi triển khai Cloudflare, áp dụng migration trước khi xuất bản mã.

## Kiểm tra

```sh
node --experimental-vm-modules scripts/test-freelance-api.mjs
node scripts/test-freelance-browser.mjs
```

API được kiểm tra bằng SQLite trong bộ nhớ và R2 giả. Kiểm tra trình duyệt dùng dữ liệu giả riêng trong phiên Chrome, không ghi tài khoản/dự án thật. Ảnh kiểm tra nằm ở `.sites-runtime/freelance-review`.
