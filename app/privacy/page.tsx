import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ClientNavigationLink as Link } from "@/components/client-navigation-link";
import { RequestActionButton } from "@/components/interactive-actions";

export const metadata: Metadata = {
  title: "Chính sách bảo mật | NhàĐẹpChất",
  description: "Thông tin về dữ liệu tài khoản, đăng nhập Google, cookie và cách gửi yêu cầu về quyền riêng tư trên nhadepchat.top.",
  alternates: { canonical: "https://nhadepchat.top/privacy" },
};

const sections = [
  { id: "du-lieu", title: "1. Thông tin được thu thập", paragraphs: [
    "Khi đăng ký bằng mật khẩu, bạn cung cấp họ tên, tên đăng nhập và mật khẩu. Email không bắt buộc đối với tài khoản mới. Mật khẩu được lưu dưới dạng băm, không lưu dưới dạng văn bản có thể đọc trực tiếp.",
    "Khi sử dụng các tính năng cộng đồng, website lưu thông tin bạn cung cấp như hồ sơ nghề nghiệp, bài viết, bình luận, ảnh, tệp bản vẽ, tin nhắn, yêu cầu tư vấn và thông tin liên hệ. Website cũng lưu mẫu yêu thích, hoạt động theo dõi, yêu cầu nạp tiền và lịch sử giao dịch trong ví khi bạn sử dụng các tính năng đó.",
    "Thông tin kỹ thuật như địa chỉ IP, thời điểm yêu cầu, lỗi hệ thống và mã phiên có thể được xử lý để vận hành website, bảo vệ tài khoản và giới hạn các lần thử đăng nhập.",
  ] },
  { id: "google", title: "2. Đăng nhập bằng Google", paragraphs: [
    "Đăng nhập Google là lựa chọn của bạn. Khi bạn cho phép đăng nhập, website sử dụng tên, địa chỉ email đã xác minh và mã định danh tài khoản Google để tạo hoặc nhận diện tài khoản, hiển thị hồ sơ và duy trì phiên đăng nhập.",
    "Website chỉ yêu cầu quyền nhận diện và hồ sơ cơ bản cho đăng nhập; không yêu cầu đọc nội dung Gmail, danh bạ hoặc tệp Google Drive. Website không nhận mật khẩu Google và không lưu mã truy cập hay mã làm mới của Google để sử dụng lâu dài.",
    "Dữ liệu nhận từ Google được dùng cho chức năng tài khoản và hỗ trợ liên quan, không dùng để quảng cáo cá nhân hóa hoặc bán cho bên thứ ba. Bạn có thể ngừng dùng Google để đăng nhập và thu hồi quyền truy cập trong phần kết nối với ứng dụng bên thứ ba của Tài khoản Google. Thu hồi quyền tại Google không tự xóa dữ liệu đã có trên website; bạn có thể gửi yêu cầu xóa ở mục liên hệ bên dưới.",
  ] },
  { id: "muc-dich", title: "3. Mục đích sử dụng thông tin", paragraphs: [
    "Thông tin được sử dụng để cung cấp tài khoản, lưu ý tưởng xây nhà, hiển thị nội dung cộng đồng, kết nối người dùng với người đăng hoặc chuyên gia, xử lý yêu cầu tư vấn, cung cấp tệp đã mua và đối soát các giao dịch.",
    "Thông tin tài khoản và kỹ thuật còn giúp xác thực đăng nhập, gửi mã khôi phục khi bạn yêu cầu và có email, ngăn hành vi lạm dụng, xử lý sự cố và hỗ trợ người dùng. Người vận hành có thể xem dữ liệu cần thiết để thực hiện các công việc này.",
  ] },
  { id: "chia-se", title: "4. Nội dung hiển thị và bên nhận dữ liệu", paragraphs: [
    "Tên hiển thị, thông tin nghề nghiệp, bài viết, bình luận và tệp bạn đăng công khai có thể được người khác xem. Không đưa mật khẩu, giấy tờ cá nhân hoặc thông tin riêng tư vào nội dung công khai.",
    "Tin nhắn và yêu cầu tư vấn được gửi đến người nhận hoặc người vận hành website. Nếu bạn chọn gửi qua Zalo, Messenger hoặc Telegram, nội dung yêu cầu và thông tin liên hệ bạn điền sẽ được chuyển qua dịch vụ tương ứng khi kênh đó được cấu hình.",
    "Website sử dụng Cloudflare để cung cấp hạ tầng, lưu trữ dữ liệu và tệp. Google xử lý việc xác thực khi bạn chọn đăng nhập Google. Dịch vụ gửi email được cấu hình, như Resend hoặc Cloudflare, có thể xử lý địa chỉ email và nội dung mã khôi phục khi bạn yêu cầu khôi phục mật khẩu. Các nhà cung cấp này xử lý dữ liệu theo dịch vụ và chính sách riêng của họ; hạ tầng có thể xử lý dữ liệu bên ngoài Việt Nam.",
  ] },
  { id: "cookie", title: "5. Cookie và phiên truy cập", paragraphs: [
    "Website dùng cookie để ghi nhớ phiên đăng nhập, nhận diện phiên khách và bảo vệ các bước xác thực. Cookie đăng nhập có thời hạn tối đa 7 ngày; cookie phiên khách có thể tồn tại đến một năm; cookie cho bước xác thực hoặc đăng nhập Google thường có thời hạn 10 phút.",
    "Bạn có thể đăng xuất hoặc xóa cookie trong trình duyệt. Khi chặn hoặc xóa cookie, bạn có thể phải đăng nhập lại và một số dữ liệu gắn với phiên khách có thể không còn được truy cập từ trình duyệt đó.",
  ] },
  { id: "luu-tru", title: "6. Lưu trữ và bảo vệ thông tin", paragraphs: [
    "Dữ liệu tài khoản, nội dung và giao dịch được lưu để cung cấp các chức năng bạn sử dụng. Các mã xác thực và phiên đăng nhập có thời hạn riêng. Website áp dụng các biện pháp như băm mật khẩu, cookie phiên được bảo vệ và xác thực bổ sung cho quản trị viên.",
    "Khi nhận yêu cầu xóa đã được xác minh, người vận hành xem xét và xử lý dữ liệu liên quan. Một số thông tin giao dịch hoặc dữ liệu liên quan đến yêu cầu đang giải quyết có thể cần được giữ để đối soát, xử lý tranh chấp hoặc đáp ứng nghĩa vụ áp dụng; phạm vi xử lý sẽ được trao đổi khi tiếp nhận yêu cầu.",
  ] },
  { id: "quyen", title: "7. Lựa chọn và yêu cầu của bạn", paragraphs: [
    "Bạn có thể chọn đăng ký không dùng email, chọn phương thức đăng nhập, thay đổi mật khẩu của tài khoản dùng mật khẩu và quyết định thông tin đưa vào bài đăng hoặc yêu cầu tư vấn.",
    "Bạn có thể gửi yêu cầu xem, sửa hoặc xóa thông tin cá nhân, xóa tài khoản hoặc hỏi về cách sử dụng dữ liệu. Hãy nêu tên đăng nhập hoặc thông tin giúp nhận diện tài khoản và cách liên hệ để phản hồi. Người vận hành có thể cần xác minh quyền sở hữu tài khoản trước khi xử lý. Không gửi mật khẩu hoặc mã xác thực trong yêu cầu.",
  ] },
  { id: "cap-nhat", title: "8. Cập nhật chính sách", paragraphs: [
    "Chính sách này áp dụng cho website NhàĐẹpChất tại nhadepchat.top và các tính năng được mô tả trên trang này. Khi cách xử lý dữ liệu thay đổi, nội dung chính sách và ngày cập nhật trên trang sẽ được điều chỉnh để người dùng có thể theo dõi.",
  ] },
];

export default function PrivacyPage() {
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#168ac0]"><ArrowLeft size={16}/>Về trang chủ</Link>
    <header className="rounded-3xl border border-[#dce8ef] bg-[#edf6fa] p-6 sm:p-9">
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-white text-[#168ac0]"><ShieldCheck size={26}/></span>
      <p className="text-xs font-bold tracking-widest text-[#168ac0]">NhàĐẹpChất</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0b2e59] sm:text-4xl">Chính sách bảo mật</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#536273]">Trang này giải thích thông tin website thu thập, cách sử dụng và chia sẻ dữ liệu, cùng các lựa chọn của bạn khi tham gia cộng đồng hoặc đăng nhập bằng Google.</p>
      <p className="mt-5 text-xs font-medium text-[#667085]">Cập nhật ngày <time dateTime="2026-10-02">02/10/2026</time></p>
    </header>
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Mục lục chính sách bảo mật" className="rounded-2xl border border-[#e3eaf2] bg-white p-5 lg:sticky lg:top-24">
        <p className="mb-3 text-sm font-bold text-[#0b2e59]">Nội dung</p>
        <ol className="space-y-3">{sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="text-sm leading-6 text-[#667085] hover:text-[#168ac0]">{section.title}</a></li>)}</ol>
        <a href="#lien-he" className="mt-4 block border-t border-[#e3eaf2] pt-4 text-sm font-semibold text-[#168ac0]">Liên hệ về dữ liệu</a>
      </nav>
      <article className="space-y-8 rounded-2xl border border-[#e3eaf2] bg-white p-6 sm:p-8">
        {sections.map(section => <section key={section.id} id={section.id} className="scroll-mt-28">
          <h2 className="text-lg font-bold text-[#0b2e59]">{section.title}</h2>
          <div className="mt-3 space-y-3 text-sm leading-7 text-[#536273]">{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
        </section>)}
        <section id="lien-he" className="scroll-mt-28 rounded-2xl bg-[#f3f8fb] p-5">
          <h2 className="text-lg font-bold text-[#0b2e59]">Liên hệ về quyền riêng tư</h2>
          <p className="mt-3 text-sm leading-7 text-[#536273]">Gửi yêu cầu trực tiếp cho người vận hành website bằng nút bên dưới. Bạn có thể yêu cầu hỗ trợ về dữ liệu hoặc tài khoản và cung cấp email hay số điện thoại để nhận phản hồi.</p>
          <RequestActionButton requestType="privacy-request" targetType="website" targetId="privacy" label="Gửi yêu cầu về dữ liệu" title="Yêu cầu về quyền riêng tư" description="Nêu yêu cầu xem, sửa hoặc xóa dữ liệu, tên đăng nhập và cách liên hệ để nhận phản hồi. Không gửi mật khẩu hoặc mã xác thực." className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#073b74] px-5 py-3 text-sm font-bold text-white hover:bg-[#0b4b8d]"/>
        </section>
      </article>
    </div>
  </main>;
}
