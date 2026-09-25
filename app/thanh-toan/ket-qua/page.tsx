"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, LoaderCircle, XCircle } from "lucide-react";

type Order = { orderCode: number; productTitle: string; amount: number; status: string; paidAt?: string | null };

export default function PaymentResultPage() {
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("Đang xác nhận kết quả thanh toán...");
  const [loading, setLoading] = useState(true);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderCode = params.get("orderCode");
    const isCancelled = params.get("cancel") === "true" || params.get("status") === "CANCELLED";
    let stopped = false;
    let attempts = 0;
    const check = async () => {
      if (!orderCode) { setMessage("Không tìm thấy mã đơn hàng."); setLoading(false); return; }
      try {
        const response = await fetch(`/api/payments/status?orderCode=${encodeURIComponent(orderCode)}`, { cache: "no-store" });
        const data = await response.json() as { order?: Order; error?: string };
        if (!response.ok || !data.order) throw new Error(data.error || "Chưa thể kiểm tra đơn hàng.");
        if (stopped) return;
        setCancelled(isCancelled);
        setOrder(data.order);
        if (data.order.status === "paid") { setMessage("Thanh toán thành công. Người bán đã nhận được thông báo gửi file cho bạn."); setLoading(false); return; }
        if (isCancelled) { setMessage("Bạn đã hủy giao dịch. Đơn hàng chưa được thanh toán."); setLoading(false); return; }
        attempts += 1;
        if (attempts < 8) window.setTimeout(check, 2000);
        else { setMessage("Giao dịch đang được đối soát. Bạn có thể quay lại trang này sau ít phút."); setLoading(false); }
      } catch (cause) {
        if (!stopped) { setMessage(cause instanceof Error ? cause.message : "Chưa thể kiểm tra đơn hàng."); setLoading(false); }
      }
    };
    void check();
    return () => { stopped = true; };
  }, []);

  const paid = order?.status === "paid";
  return <main className="mx-auto grid min-h-[70dvh] max-w-2xl place-items-center px-4 py-12">
    <section className="w-full rounded-[24px] border border-[#dfe8f1] bg-white p-6 text-center shadow-sm sm:p-10">
      <span className={`mx-auto grid size-16 place-items-center rounded-full ${paid ? "bg-emerald-50 text-emerald-600" : cancelled ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-[#168ac0]"}`}>{loading ? <LoaderCircle size={34} className="animate-spin"/> : paid ? <CheckCircle2 size={36}/> : cancelled ? <XCircle size={36}/> : <Clock3 size={34}/>}</span>
      <h1 className="mt-5 text-2xl font-extrabold text-[#0b2e59]">Kết quả thanh toán</h1>
      <p className="mt-3 leading-7 text-[#536273]">{message}</p>
      {order && <div className="mt-5 rounded-xl bg-[#f4f7fa] p-4 text-left text-sm"><p><span className="text-[#667085]">Đơn hàng:</span> <strong>#{order.orderCode}</strong></p><p className="mt-2"><span className="text-[#667085]">Sản phẩm:</span> <strong>{order.productTitle}</strong></p><p className="mt-2"><span className="text-[#667085]">Số tiền:</span> <strong className="text-[#168ac0]">{order.amount.toLocaleString("vi-VN")}đ</strong></p></div>}
      <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/file-ban-ve-nha-dep-tipook" className="rounded-xl bg-[#229ed9] px-5 py-3 font-bold text-white">Về Kho bản vẽ</Link><Link href="/tai-khoan" className="rounded-xl border border-[#d0d5dd] px-5 py-3 font-bold text-[#344054]">Xem tin nhắn</Link></div>
    </section>
  </main>;
}