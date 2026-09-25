import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, MessageCircle, UserRound } from "lucide-react";
import { EditorialContent, type EditorialSection } from "@/components/editorial-content";
import { DetailActionButton, RequestActionButton } from "@/components/interactive-actions";

type Section = "diary" | "guides" | "experts";
type PageContent = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  cards: { title: string; copy: string; meta: string }[];
  article: { eyebrow: string; title: string; intro: string; sections: EditorialSection[]; checklist: string[] };
};

const expertRecipientIds: Record<string, string> = { "KTS. Khánh Linh": "virtual-architect-001", "KS. Trọng Hiếu": "virtual-engineer-001", "Chuyên viên Vũ Mai": "virtual-engineer-003" };

const content: Record<Section, PageContent> = {
  diary: {
    eyebrow: "NHẬT KÝ XÂY NHÀ",
    title: "Theo dõi hành trình xây nhà thực tế",
    description: "Những cập nhật thật từ gia chủ: tiến độ, chi phí, lựa chọn vật liệu và cách xử lý phát sinh tại công trình.",
    action: "Chia sẻ nhật ký của bạn",
    cards: [
      { title: "Nhà phố 3 tầng tại Biên Hòa", copy: "Hoàn thiện chống thấm sân thượng và bắt đầu đi điện âm. Gia chủ ghi rõ các khoản phát sinh để mọi người cùng tham khảo.", meta: "Ngày 96 · Tiến độ 53%" },
      { title: "Cải tạo nhà cấp 4 cho gia đình 3 thế hệ", copy: "Tuần 8: chốt phương án lấy sáng, thay toàn bộ hệ mái và xử lý nền nhà cũ trước khi hoàn thiện.", meta: "Ngày 54 · Đang thi công" },
      { title: "Xây nhà vườn 1 tầng ở Long An", copy: "Chia sẻ kinh nghiệm chọn vật liệu địa phương, kiểm soát khối lượng và lịch nghiệm thu từng hạng mục.", meta: "Ngày 71 · Hoàn thiện 68%" }
    ],
    article: {
      eyebrow: "CÁCH GHI NHẬT KÝ CÔNG TRÌNH",
      title: "Một nhật ký xây nhà tốt cần ghi những gì?",
      intro: "Nhật ký không chỉ để lưu kỷ niệm. Nếu được cập nhật đúng cách, đây là căn cứ giúp gia chủ kiểm soát tiến độ, khối lượng, chất lượng và các khoản phát sinh trong suốt quá trình thi công.",
      sections: [
        { title: "Ghi theo mốc công việc, không chỉ theo ngày", paragraphs: ["Mỗi cập nhật nên nêu rõ hạng mục đã thực hiện, số lượng nhân công, vật tư được đưa vào công trình và kết quả nghiệm thu. Ảnh chụp nên có góc toàn cảnh và ảnh cận chi tiết trước khi những phần việc đó bị che khuất."], bullets: ["Móng, cột, dầm và sàn", "Điện nước âm tường", "Chống thấm và thử nước", "Ốp lát, sơn và lắp thiết bị"] },
        { title: "Theo dõi chi phí và phát sinh riêng biệt", paragraphs: ["Tách giá trị theo hợp đồng, chi phí đã thanh toán và chi phí phát sinh. Mọi phát sinh cần có nguyên nhân, người xác nhận, đơn giá và ảnh hiện trạng đi kèm. Cách ghi này giúp tránh tranh luận khi quyết toán."], bullets: ["Lưu báo giá và phiếu giao hàng", "Ghi ngày, số tiền từng đợt thanh toán", "Không duyệt phát sinh chỉ bằng lời nói", "Đối chiếu khối lượng trước khi trả tiền"] },
        { title: "Chốt việc cần làm cho ngày tiếp theo", paragraphs: ["Cuối mỗi tuần, hãy tổng hợp phần đã hoàn thành, việc còn vướng và quyết định cần gia chủ xác nhận. Một danh sách ngắn nhưng rõ trách nhiệm sẽ giúp nhà thầu, giám sát và gia chủ phối hợp hiệu quả hơn."] }
      ],
      checklist: ["Chụp ảnh trước khi nghiệm thu", "Sao lưu hồ sơ lên đám mây", "Ghi rõ người xác nhận", "Cập nhật tối thiểu mỗi tuần"]
    }
  },
  guides: {
    eyebrow: "CẨM NANG XÂY NHÀ",
    title: "Kiến thức rõ ràng cho từng quyết định",
    description: "Hướng dẫn thực tế từ lúc chuẩn bị ngân sách, chọn nhà thầu đến nghiệm thu và bàn giao công trình.",
    action: "Xem danh mục cẩm nang",
    cards: [
      { title: "Lập ngân sách xây nhà: bắt đầu từ đâu?", copy: "Cách phân chia chi phí phần thô, hoàn thiện và khoản dự phòng để không vỡ kế hoạch giữa chừng.", meta: "Dự toán · 8 phút đọc" },
      { title: "7 câu hỏi cần hỏi trước khi chọn nhà thầu", copy: "Danh sách thông tin cần chốt về năng lực, vật tư, bảo hành và cách xử lý phát sinh.", meta: "Nhà thầu · 6 phút đọc" },
      { title: "Nghiệm thu phần thô không bỏ sót hạng mục", copy: "Các mốc kiểm tra quan trọng với móng, cột, sàn, tường và hệ thống âm tường.", meta: "Thi công · 10 phút đọc" }
    ],
    article: {
      eyebrow: "LỘ TRÌNH XÂY NHÀ",
      title: "Từ ý tưởng đến ngày nhận nhà: 4 việc gia chủ cần kiểm soát",
      intro: "Một ngôi nhà tốt không bắt đầu từ việc chọn gạch hay màu sơn, mà từ việc xác định đúng nhu cầu, ngân sách và cách tổ chức dự án. Bốn bước dưới đây giúp hạn chế thay đổi giữa chừng và giảm rủi ro phát sinh.",
      sections: [
        { title: "Chốt nhu cầu sử dụng trước khi thiết kế", paragraphs: ["Liệt kê số người ở, thói quen sinh hoạt, nhu cầu để xe, làm việc tại nhà và khả năng thay đổi của gia đình trong 5–10 năm. Đây là dữ liệu đầu vào quan trọng hơn việc chọn phong cách mặt tiền."], bullets: ["Số phòng và mức độ riêng tư", "Hướng sáng, thông gió", "Không gian dự phòng", "Nhu cầu bảo trì lâu dài"] },
        { title: "Lập ngân sách có khoản dự phòng", paragraphs: ["Ngân sách nên gồm thiết kế, xin phép, thi công phần thô, hoàn thiện, thiết bị, nội thất rời và chi phí dự phòng. Khoản dự phòng thường cần thiết vì giá vật tư, thay đổi thiết kế và điều kiện hiện trường khó dự đoán tuyệt đối."] },
        { title: "Hợp đồng phải đo lường được", paragraphs: ["Phạm vi công việc, chủng loại vật tư, mốc thanh toán, tiêu chuẩn nghiệm thu và thời gian bảo hành phải được ghi rõ. Những cụm từ chung chung như “vật tư loại tốt” hoặc “hoàn thiện cơ bản” nên được thay bằng mã sản phẩm và thông số cụ thể."] },
        { title: "Nghiệm thu theo giai đoạn", paragraphs: ["Không chờ đến khi hoàn thiện mới kiểm tra. Hãy nghiệm thu nền móng, kết cấu, xây tô, hệ thống điện nước âm, chống thấm và hoàn thiện theo từng mốc. Sai sót được phát hiện sớm luôn dễ xử lý và ít tốn kém hơn."] }
      ],
      checklist: ["Có bản vẽ và dự toán thống nhất", "Hợp đồng ghi rõ vật tư", "Thanh toán theo khối lượng", "Lưu hồ sơ nghiệm thu từng giai đoạn"]
    }
  },
  experts: {
    eyebrow: "HỎI CHUYÊN GIA",
    title: "Nhận tư vấn cho ngôi nhà của bạn",
    description: "Gửi câu hỏi về thiết kế, kết cấu, dự toán hoặc thi công để nhận gợi ý từ kiến trúc sư và kỹ sư.",
    action: "Đặt câu hỏi cho chuyên gia",
    cards: [
      { title: "KTS. Khánh Linh", copy: "Tư vấn thiết kế nhà phố, lấy sáng và tổ chức công năng theo nhu cầu sinh hoạt.", meta: "Thiết kế kiến trúc · Đang trực tuyến" },
      { title: "KS. Trọng Hiếu", copy: "Hỗ trợ các vấn đề về kết cấu, biện pháp thi công và kiểm soát chất lượng công trình.", meta: "Kết cấu & thi công · Đang trực tuyến" },
      { title: "Chuyên viên Vũ Mai", copy: "Giải đáp lập dự toán, so sánh báo giá và chuẩn bị ngân sách trước khi xây.", meta: "Dự toán công trình · Phản hồi trong ngày" }
    ],
    article: {
      eyebrow: "ĐẶT CÂU HỎI HIỆU QUẢ",
      title: "Chuẩn bị thông tin gì để chuyên gia tư vấn chính xác?",
      intro: "Câu hỏi càng có bối cảnh rõ, câu trả lời càng sát với công trình. Trước khi gửi, bạn nên chuẩn bị thông tin cơ bản về khu đất, nhu cầu sử dụng, ngân sách và tài liệu hiện có.",
      sections: [
        { title: "Mô tả hiện trạng và mục tiêu", paragraphs: ["Cho biết địa điểm xây dựng, kích thước khu đất, hướng tiếp cận, số tầng dự kiến và số người sử dụng. Nếu là công trình cải tạo, cần bổ sung tuổi nhà, hiện trạng kết cấu và phần muốn giữ lại."], bullets: ["Kích thước và hướng đất", "Số tầng, số phòng", "Ảnh hiện trạng", "Nhu cầu đặc biệt của gia đình"] },
        { title: "Gửi đúng tài liệu liên quan", paragraphs: ["Với câu hỏi về công năng, hãy gửi mặt bằng. Với kết cấu hoặc nứt thấm, cần có ảnh toàn cảnh, ảnh cận cảnh và vị trí trên bản vẽ. Với dự toán, nên gửi bảng khối lượng hoặc báo giá đã nhận để chuyên gia có cơ sở đối chiếu."] },
        { title: "Nêu rõ điều bạn đang phân vân", paragraphs: ["Thay vì hỏi “phương án nào tốt”, hãy nêu hai phương án đang cân nhắc, tiêu chí ưu tiên và giới hạn ngân sách. Chuyên gia sẽ dễ phân tích ưu nhược điểm và đưa ra khuyến nghị có điều kiện hơn."] }
      ],
      checklist: ["Ẩn thông tin cá nhân trên hồ sơ", "Không tự thay đổi kết cấu theo tư vấn online", "Xác minh tại hiện trường khi cần", "Lưu lại câu trả lời và tài liệu"]
    }
  }
};

export function SectionPage({ section }: { section: Section }) {
  const page = content[section];
  return <div className="min-h-screen bg-[#f4f7fb] text-[#0b2e59]">
    <main className="mx-auto max-w-[1320px] px-4 py-8 lg:px-8 lg:py-11">
      <section className="overflow-hidden rounded-[28px] bg-[#073b74] p-7 text-white shadow-[0_18px_45px_rgba(21,68,49,.14)] sm:p-10">
        <p className="text-sm font-extrabold tracking-[.13em] text-[#bde7f8]">{page.eyebrow}</p>
        <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-3xl"><h1 className="text-3xl font-extrabold tracking-[-.04em] sm:text-5xl">{page.title}</h1><p className="mt-4 text-base leading-7 text-white/90 sm:text-lg">{page.description}</p></div>{section === "guides" ? <a href="#noi-dung" className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold text-white">{page.action}<ArrowRight size={18}/></a> : <RequestActionButton requestType={section === "experts" ? "expert-question" : "diary-submission"} targetType={section} targetId="new" label={page.action} title={section === "experts" ? "Đặt câu hỏi cho chuyên gia" : "Chia sẻ nhật ký xây nhà"} description="Cung cấp bối cảnh, nội dung chi tiết và thông tin liên hệ. Bạn có thể đính kèm ảnh hoặc tài liệu." recipientUserId={section === "experts" ? "virtual-architect-001" : undefined} allowFile className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold text-white"/>}</div>
      </section>
      <section className="mt-7 grid gap-5 lg:grid-cols-3">{page.cards.map((card) => <article key={card.title} className="rounded-[22px] border border-[#e3eaf2] bg-white p-6 shadow-[0_5px_20px_rgba(24,49,39,.045)]"><span className="grid size-11 place-items-center rounded-xl bg-[#eef9fd] text-[#229ed9]">{section === "diary" ? <CalendarDays size={21}/> : section === "guides" ? <BookOpen size={21}/> : <UserRound size={21}/>}</span><p className="mt-5 text-xs font-extrabold uppercase tracking-[.11em] text-[#168ac0]">{card.meta}</p><h2 className="mt-2 text-xl font-extrabold tracking-[-.02em]">{card.title}</h2><p className="mt-3 leading-7 text-[#3f5064]">{card.copy}</p>{section === "experts" ? <RequestActionButton requestType="expert-question" targetType="expert" targetId={card.title} label="Gửi câu hỏi" title={"Hỏi " + card.title} description={card.copy} recipientUserId={expertRecipientIds[card.title]} allowFile className="mt-5 flex items-center gap-2 text-sm font-bold text-[#229ed9]"/> : <DetailActionButton label="Xem chi tiết" title={card.title} className="mt-5 flex items-center gap-2 text-sm font-bold text-[#229ed9]"><p>{card.copy}</p><p className="mt-3 font-semibold text-[#168ac0]">{card.meta}</p></DetailActionButton>}</article>)}</section>
      <div id="noi-dung" className="scroll-mt-24"><EditorialContent {...page.article}/></div>
      <section className="mt-8 grid gap-5 rounded-[24px] border border-[#e3eaf2] bg-white p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-8"><span className="grid size-12 place-items-center rounded-full bg-[#eef9fd] text-[#147aa8]"><CheckCircle2 size={24}/></span><div><h2 className="text-xl font-extrabold">Bạn cần hỗ trợ theo trường hợp riêng?</h2><p className="mt-1 text-[#3f5064]">Cung cấp thông tin khu đất và nhu cầu để nhận gợi ý phù hợp.</p></div><a href="/hoi-chuyen-gia" className="flex items-center gap-2 rounded-xl bg-[#229ed9] px-5 py-3 font-bold text-white">Liên hệ chuyên gia <MessageCircle size={17}/></a></section>
    </main>
  </div>;
}