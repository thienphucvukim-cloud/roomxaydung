# Bản SEO và sitemap tự động

Ngày 04/10/2026. Nhánh local: `codex/seo-review`.

Người dùng đã duyệt và yêu cầu cập nhật GitHub cùng Cloudflare ngày 04/10/2026. Bản này được đưa vào `main`; Cloudflare Workers Builds triển khai từ commit trên GitHub.

## Website hiện tại đã đồng bộ

GitHub `main` và Cloudflare đã đồng bộ trước khi làm SEO:

- Commit: [`6e5afb123e30caf880ee12afae264af8f66875d0`](https://github.com/thienphucvukim-cloud/roomxaydung/commit/6e5afb123e30caf880ee12afae264af8f66875d0).
- Workers Builds báo thành công, build `a22df153-dc89-4179-bda5-cfe8de8c6be8`.
- Cloudflare version `5e0ff66c-e776-41b8-ab3c-4f786db0db3f` phục vụ 100% traffic.
- Đã kiểm tra các trang và API công khai sau khi cập nhật.
- Khi hoàn thành bản kiểm tra local, GitHub vẫn ở commit trên và Cloudflare phục vụ version trên. Đây là mốc đồng bộ trước khi triển khai SEO.

## Các thay đổi SEO trong bản local

1. Trang bài viết có title, description, canonical, Open Graph và thông tin chia sẻ riêng cho từng bài; lấy từ nội dung công khai thực tế.
2. HTML ban đầu chứa bài viết, danh mục và hồ sơ công khai. Dùng các component hiện có; không thêm mục hoặc đổi CSS, bố cục, màu sắc hay các nút thao tác.
3. Bài viết có JSON-LD `SocialMediaPosting`; hồ sơ thật có bài công khai có `ProfilePage`. Không gán hồ sơ ảo thành người thật, không tạo đánh giá hoặc ngày cập nhật giả, không đánh dấu bình luận chưa hiển thị lúc tải trang.
4. `/sitemap.xml` trỏ đến sitemap trang, bài viết và hồ sơ. Mỗi phần bài viết/hồ sơ tối đa 1.000 URL. Ảnh công khai được đưa vào sitemap ảnh; file riêng tư không xuất hiện.
5. Trang tài khoản, đăng nhập, tìm kiếm và URL lọc có `noindex`; URL công khai có canonical. Phân trang Kho bản vẽ/Nội thất có canonical riêng. Giữ các chuyển hướng URL cũ.
6. Thời gian đăng và tiêu đề hiện có trên bảng tin dẫn đến URL bài viết chuẩn để crawler có thể đi theo liên kết. Nút “Xem bài viết” vẫn mở bài trong danh mục nguồn như trước.
7. Bài không tồn tại, bị ẩn hoặc xóa trả HTTP 404. HTML và sitemap kiểm tra quyền hiển thị trực tiếp, không giữ bản HTML đã ẩn trong cache.

## Giữ Cloudflare Free

Render trang công khai được chuyển sang Durable Object SQLite hiện có bằng tên `public-pages`, tách khỏi các shard API. Renderer chỉ tải trong nhánh trang công khai. Không thêm binding, migration hoặc dịch vụ trả phí; file ảnh và API vẫn giữ đường xử lý riêng.

HTML không chứa cookie/session của người xem. Các thông tin tài khoản và chức năng cá nhân tiếp tục đọc qua API sau khi tải trang. Bộ HTML/RSC dự phòng vẫn được build không có DB hoặc secrets.

Dry-run Cloudflare đạt, tổng gzip khoảng 533 KiB. Các kiểm tra runtime dùng D1/R2 local tách biệt. CPU và lưu lượng production của bản SEO chỉ có thể kiểm tra sau khi được phép triển khai.

## Cách duyệt

[Sơ đồ website và cơ chế cập nhật sitemap](./WEBSITE_MAP.md) mô tả các mục hiện tại, robots.txt và cách sitemap tự cập nhật từ dữ liệu công khai. Sitemap lấy dữ liệu mới mỗi lần đọc, tự điều chỉnh số phần; không cần chạy cron. DB lỗi tạm thời trả 503 để lần đọc sau thử lại.

Mở [bản xem thử local](http://127.0.0.1:8790). Dữ liệu ở đây là dữ liệu kiểm thử local, không phải dữ liệu mới đăng lên website thật.

- Xem Bảng tin, Mẫu nhà đẹp, Kho bản vẽ, Nội thất trên máy tính và điện thoại; so sánh bố cục với website hiện tại.
- Bấm thời gian đăng hoặc tiêu đề bài viết để xem trang bài. Kiểm tra title trên tab và `view-source:` để xem canonical, mô tả và JSON-LD.
- Mở [robots.txt](http://127.0.0.1:8790/robots.txt), [sitemap index](http://127.0.0.1:8790/sitemap.xml) và [sitemap bài viết](http://127.0.0.1:8790/sitemaps/posts-1.xml).
- Thử Đặt mua, lưu, chia sẻ, bình luận, ảnh bình luận và đăng nhập/đăng ký; kiểm tra việc quay về đúng bài.
- Bài ẩn/xóa không còn URL trong sitemap và trả 404 khi mở trang bài.

Canonical trong bản local cố ý dùng `https://nhadepchat.top`, vì đây là địa chỉ chuẩn khi bản sửa được triển khai.

## Đã kiểm tra

- TypeScript, ESLint: không có lỗi. Các cảnh báo `<img>` của component hiện có được giữ vì ảnh upload đã nén WebP và luồng ảnh đang dùng đường xử lý riêng.
- Build Cloudflare: đạt, 21 bộ HTML/RSC shell được tạo; 869 import của bản build được kiểm tra.
- Metadata/canonical/JSON-LD: đạt, có kiểm tra escape nội dung chống chèn script.
- Sitemap với schema SQLite thật: đạt; bài ẩn/xóa, file riêng tư, hồ sơ ảo/rỗng/khóa, phân trang và giới hạn bind D1.
- Runtime local: đạt; HTML có nội dung, 404 thật, không lộ session/file riêng tư, phân trang và hide/publish/delete có hiệu lực ngay.
- 12 lượt so sánh giao diện trên desktop/mobile: đạt. Mẫu nhà đẹp giữ cách xáo trộn thứ tự vốn có, nên so sánh kích thước cột và vị trí lưới.
- 62 luồng đăng nhập/đăng ký thật: đạt; tất cả thao tác bài thành viên/bài demo, đặt mua/tải miễn phí, đánh giá, bình luận/ảnh quay lại đúng bài, không reload document.
- Bảng tin, nén ảnh WebP, menu desktop/mobile, Back/Forward, bàn phím, điều hướng và giữ root layout: đạt.
- Worker fast paths, quyền đọc file riêng tư, thứ tự danh mục và bộ kiểm tra thuật ngữ: đạt.

Ảnh so sánh và log nằm trong `.sites-runtime/seo-ui-review`, `.sites-runtime/seo-auth-actions.log`, `.sites-runtime/seo-menu.log`, `.sites-runtime/seo-feed.log`; không đưa dữ liệu kiểm thử hoặc secrets lên GitHub.

## Triển khai theo yêu cầu của người dùng

Bản SEO được duyệt sau khi người dùng xem bản local và yêu cầu "cập nhật github và cloudflare". Đẩy commit lên `main` để Workers Builds triển khai, theo dõi kết quả build và xác nhận version phục vụ 100% traffic; sau đó kiểm tra các trang công khai, metadata, sitemap, robots.txt và lỗi Worker trên website thật. Dữ liệu fixture và secrets không được đưa lên GitHub.

Tài liệu đối chiếu: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Discussion forum structured data](https://developers.google.com/search/docs/appearance/structured-data/discussion-forum), [ProfilePage](https://developers.google.com/search/docs/appearance/structured-data/profile-page), [Sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
