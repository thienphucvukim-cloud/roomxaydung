import { ArrowRight, Calculator, DraftingCompass, Heart, House, Info, MessageCircle, Sofa, Handshake } from "lucide-react";
import Image from "next/image";
import { ClientNavigationLink as Link } from "@/components/client-navigation-link";
import { StructuredData } from "@/components/structured-data";
import { SITE_SECTIONS } from "@/lib/site-sections";
import { pageMetadata, SITE_IMAGE, SITE_IMAGE_ALT, sitePageStructuredData } from "@/lib/seo";

export const metadata = pageMetadata("Giới thiệu NhàĐẹpChất — Mẫu nhà đẹp, bản vẽ và cộng đồng xây nhà", "Khám phá NhàĐẹpChất: chia sẻ mẫu nhà đẹp, bản vẽ nhà, ý tưởng nội thất, thuê thiết kế và tính vật tư xây dựng trong một cộng đồng.", "/gioi-thieu");

const features = [
  { ...SITE_SECTIONS.news, icon: MessageCircle, title: "Cộng đồng chia sẻ kinh nghiệm xây nhà", text: "Bảng tin kết nối người chuẩn bị xây nhà, chủ nhà và người làm nghề. Bạn có thể đăng bài, chia sẻ ảnh công trình, đặt câu hỏi, bình luận và trao đổi kinh nghiệm về chi phí xây nhà, bố trí không gian hoặc lựa chọn vật liệu." },
  { ...SITE_SECTIONS.houseModels, icon: House, title: "Mẫu nhà đẹp và ý tưởng kiến trúc", text: "Khám phá mẫu nhà phố, nhà cấp 4, nhà 2 tầng và các ý tưởng thiết kế nhà hiện đại được chia sẻ trên website. Xem ảnh phối cảnh, tìm cảm hứng cho mặt tiền và mặt bằng công năng, lưu mẫu yêu thích để trao đổi với người thiết kế." },
  { ...SITE_SECTIONS.drawings, icon: DraftingCompass, title: "Kho bản vẽ nhà và tài liệu thiết kế", text: "Tìm bản vẽ nhà và tài liệu do thành viên đăng tải. Mỗi bài có nội dung, ảnh xem trước và thông tin tệp để bạn tham khảo trước khi tải miễn phí hoặc đặt mua theo điều kiện của người đăng. Xem kỹ mô tả và phạm vi sử dụng trước khi chọn bản vẽ." },
  { ...SITE_SECTIONS.interiors, icon: Sofa, title: "Ý tưởng thiết kế nội thất", text: "Tham khảo cách bố trí phòng khách, phòng ngủ, bếp và những không gian sống khác. Chia sẻ ảnh nội thất, hỏi về màu sắc, vật liệu và cách tận dụng diện tích để tìm phương án phù hợp với nhu cầu của gia đình." },
  { ...SITE_SECTIONS.designMarketplace, icon: Handshake, title: "Kết nối và thuê thiết kế nhà", text: "Đăng nhu cầu thiết kế, mô tả quy mô công trình và trao đổi với người làm nghề qua khu vực Thuê thiết kế. Bạn có thể xem hồ sơ nghề nghiệp, tìm người phù hợp và làm rõ yêu cầu, chi phí, tiến độ cùng các hạng mục bàn giao trước khi hợp tác." },
  { ...SITE_SECTIONS.materials, icon: Calculator, title: "Tính vật tư xây dựng để dự trù khối lượng", text: "Công cụ Tính vật tư hỗ trợ ước tính bê tông, xây tường, trát, lát gạch và sơn nước theo thông số bạn nhập. Kết quả giúp tham khảo khi chuẩn bị vật liệu xây nhà; khối lượng thực tế cần đối chiếu với bản vẽ, điều kiện thi công và người phụ trách kỹ thuật." },
];

export default function AboutPage() {
  return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
    <StructuredData value={sitePageStructuredData("/gioi-thieu")}/>
    <header className="grid overflow-hidden rounded-3xl border border-[#dce8ef] bg-white md:grid-cols-[1.3fr_1fr]">
      <div className="p-6 sm:p-9">
        <p className="flex items-center gap-2 text-sm font-bold text-[#168ac0]"><Info size={18}/>Giới thiệu NhàĐẹpChất</p>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-[#0b2e59] sm:text-4xl">Cùng tìm ý tưởng, thiết kế và chuẩn bị xây ngôi nhà của bạn</h1>
        <p className="mt-5 text-base leading-8 text-[#536273]">NhàĐẹpChất (Nhà Đẹp Chất) là cộng đồng chia sẻ mẫu nhà đẹp, bản vẽ nhà, ý tưởng nội thất và kinh nghiệm xây dựng. Website kết hợp bảng tin trao đổi với các công cụ tìm ý tưởng, kết nối thiết kế và tính vật tư, giúp bạn tiếp cận thông tin trong từng bước chuẩn bị xây nhà.</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 text-sm font-bold text-white">Khám phá bảng tin<ArrowRight size={17}/></Link>
      </div>
      {/* Keep the entire login architecture image visible and crawlable. */}
      <Image src={SITE_IMAGE} alt={SITE_IMAGE_ALT} width={1122} height={1402} className="h-auto w-full object-contain" priority unoptimized/>
    </header>
    <section className="mt-9" aria-labelledby="features-heading">
      <h2 id="features-heading" className="text-2xl font-extrabold text-[#0b2e59]">Bạn có thể làm gì trên NhàĐẹpChất?</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{features.map(({ path, label, icon: Icon, title, text }) => <article key={path} className="rounded-2xl border border-[#e3eaf2] bg-white p-6">
        <Icon size={25} className="text-[#168ac0]" aria-hidden="true"/>
        <h3 className="mt-4 text-lg font-bold text-[#0b2e59]">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-[#536273]">{text}</p>
        <Link href={path} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#168ac0]">Khám phá {label}<ArrowRight size={16}/></Link>
      </article>)}</div>
    </section>
    <section className="mt-6 rounded-2xl border border-[#e3eaf2] bg-white p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-xl font-bold text-[#0b2e59]"><Heart size={22}/>Lưu ý tưởng và tham gia trao đổi</h2>
      <p className="mt-4 text-sm leading-7 text-[#536273]">Tài khoản giúp bạn đăng bài, bình luận kèm ảnh, lưu mẫu yêu thích, theo dõi hoạt động và sử dụng những chức năng cần xác thực. Bạn có thể đăng ký bằng mật khẩu hoặc đăng nhập Google. Khu vực tài khoản tập hợp hồ sơ, bài đăng, tin nhắn và thông tin ví khi bạn sử dụng chức năng mua tài liệu.</p>
      <p className="mt-3 text-sm leading-7 text-[#536273]">Nếu chưa biết bắt đầu từ đâu, hãy tìm mẫu nhà phù hợp với diện tích và nhu cầu, lưu lại các ý tưởng, rồi trao đổi về mặt bằng, ngân sách và vật tư với người làm nghề. Ảnh tham khảo và bản vẽ có sẵn là điểm khởi đầu để thảo luận, cần được điều chỉnh cho công trình thực tế.</p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2"><Link href="/dang-ky" className="inline-flex min-h-11 items-center text-sm font-bold text-[#168ac0]">Tham gia cộng đồng →</Link><Link href="/hoi-chuyen-gia" className="inline-flex min-h-11 items-center text-sm font-bold text-[#168ac0]">Hỏi chuyên gia →</Link><Link href="/privacy" className="inline-flex min-h-11 items-center text-sm font-bold text-[#168ac0]">Chính sách bảo mật →</Link></div>
    </section>
    <section className="mt-6 rounded-2xl border border-[#e3eaf2] bg-white p-6 sm:p-8">
      <h2 className="text-xl font-bold text-[#0b2e59]">Câu hỏi thường gặp khi tìm ý tưởng xây nhà</h2>
      <h3 className="mt-5 font-bold text-[#0b2e59]">Có thể xem mẫu nhà đẹp mà chưa đăng nhập không?</h3>
      <p className="mt-2 text-sm leading-7 text-[#536273]">Bạn có thể xem nội dung công khai trên bảng tin, khu mẫu nhà, kho bản vẽ và nội thất. Khi muốn tương tác hoặc dùng chức năng dành cho thành viên, website hướng dẫn đăng ký hoặc đăng nhập.</p>
      <h3 className="mt-5 font-bold text-[#0b2e59]">Bản vẽ nhà trên website có miễn phí không?</h3>
      <p className="mt-2 text-sm leading-7 text-[#536273]">Kho bản vẽ có tệp miễn phí và tệp trả phí tùy bài đăng. Hãy kiểm tra thông tin tệp, giá và nội dung mô tả của người đăng trước khi tải hoặc đặt mua.</p>
      <h3 className="mt-5 font-bold text-[#0b2e59]">Tính vật tư có thay thế dự toán xây nhà không?</h3>
      <p className="mt-2 text-sm leading-7 text-[#536273]">Công cụ hỗ trợ dự trù một số khối lượng vật liệu từ dữ liệu nhập. Để lập dự toán xây dựng đầy đủ, bạn cần bản vẽ, đơn giá, nhân công và kiểm tra chuyên môn cho công trình cụ thể.</p>
    </section>
  </main>;
}
