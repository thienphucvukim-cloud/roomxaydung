# Tên gọi trong mã nguồn

Tên trong logic, component và dữ liệu ứng dụng phải mô tả chức năng hiện tại. Không đổi riêng chữ trên giao diện trong khi giữ tên nghiệp vụ cũ.

| Giao diện hiện tại | Mã nguồn chính |
| --- | --- |
| Mẫu nhà đẹp | `HouseModelsPage`, `HouseModelCatalog`, `houseModels`, `house-model-feed`, `house-model-links` |
| Kho bản vẽ / Nội thất | `FileCatalog`, `drawing-catalog`, loại hồ sơ `listingType` |
| Thông số / Kích thước / Định dạng hồ sơ | `posts.specifications` |
| Phong cách / Loại hồ sơ | `posts.listingType` |
| Giá bán / Miễn phí | `posts.priceLabel` |
| Bảng tin và nhãn chuyên mục | `SITE_SECTIONS`, `postCategoryLabel` |
| Thông báo thay đổi nội dung, ảnh đại diện, ví, tin nhắn, thao tác | `SITE_EVENTS` |

Điều hướng trên máy tính, điện thoại, nguồn Bảng tin và tìm kiếm dùng chung nhãn chuyên mục. `location` ở hồ sơ người dùng và dự án vẫn là địa điểm, không phải thông số bài đăng.

## Những tên cũ được giữ có chủ đích

`lib/legacy-contracts.ts` giữ khóa đã lưu: cột SQL `location`, `feeling`, `poll_question`; mã chuyên mục; khóa nội dung `facade.*`; thao tác ví đang chờ; định danh thông báo hệ thống và tiền tố chữ ký tải file. Đổi các giá trị này cần chuyển dữ liệu hoặc xử lý phiên bản, không thay chuỗi tùy tiện.

`lib/post-metadata.ts` là ranh giới tương thích API: tab trình duyệt mở trước khi cập nhật vẫn có thể gửi `location`, `feeling`, `pollQuestion`. Server chuyển chúng sang tên hiện tại; phản hồi có cả tên hiện tại và bí danh cũ. Tên hiện tại được ưu tiên khi có cả hai. Quyền chỉnh giá và file hồ sơ vẫn được kiểm tra sau bước chuẩn hóa.

Tên Worker `tipook-web`, R2 `tipook-files`, D1 `roomxaydung-db`, binding, biến môi trường, cookie đăng nhập, tuyến URL cũ để chuyển hướng và lịch sử migration là hợp đồng vận hành đang dùng. Chúng không phải nhãn giao diện. Giữ chúng bảo toàn phiên đăng nhập, liên kết, dữ liệu và hạ tầng; không phát sinh nâng cấp Workers Paid.

Các cụm như “mặt tiền” trong mô tả kiến trúc, tên mẫu nhà và thẻ lọc vẫn có ý nghĩa chuyên môn. Chúng không còn được dùng làm tên của chuyên mục Mẫu nhà đẹp.

## Kiểm tra khi sửa tiếp

`node scripts/check-terminology.mjs` kiểm tra component/import, tên nghiệp vụ và sự kiện trong toàn bộ mã nguồn hoạt động. Build và deploy Cloudflare chạy kiểm tra này tự động.

`node scripts/test-post-metadata.mjs` kiểm tra dữ liệu SQL cũ, tên ORM mới và ranh giới tương thích. `node scripts/test-post-metadata-runtime.mjs` chỉ chạy với server local và kiểm tra API của bản build bằng tài khoản, ảnh và bài thử biệt lập.
