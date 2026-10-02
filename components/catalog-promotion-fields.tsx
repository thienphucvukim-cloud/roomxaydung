"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { promotionMonthlyPrice } from "@/lib/catalog-promotions";

export type PromotionSelection = { position: number; months: number };
type ActivePromotion = { position: number; expiresAt: string };
const money = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;

export function CatalogPromotionFields({ category, value, onChange, disabled }: {
  category: string; value: PromotionSelection | null; onChange: (value: PromotionSelection | null) => void; disabled: boolean;
}) {
  const [active, setActive] = useState<ActivePromotion[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/catalog-promotions?category=${encodeURIComponent(category)}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json() as { active: ActivePromotion[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Chưa thể tải vị trí quảng cáo.");
        return data.active;
      }).then(data => { if (!controller.signal.aborted) setActive(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Chưa thể tải vị trí quảng cáo."); });
    return () => controller.abort();
  }, [category]);
  return <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
    <label className="flex cursor-pointer items-center gap-3 text-sm font-extrabold text-amber-900"><span className="relative inline-flex shrink-0"><input type="checkbox" role="switch" aria-label="Bật quảng cáo nổi bật" checked={!!value} disabled={disabled} onChange={event => onChange(event.target.checked ? { position: 0, months: 1 } : null)} className="peer sr-only"/><span className="h-6 w-11 rounded-full bg-[#cbd5e1] transition peer-checked:bg-amber-500 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-600 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50"/><span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5"/></span><Megaphone size={19}/>Bật nổi bật · Chạy quảng cáo</label>
    <p className="mt-2 text-xs leading-5 text-[#667085]">Đưa hồ sơ vào vị trí đã chọn trong 16 ô trang đầu. Giá từ 10.000đ/tháng; vị trí đầu 50.000đ/tháng.</p>
    {value && <>
      {!active && !error && <p role="status" className="mt-3 text-xs">Đang tải vị trí quảng cáo...</p>}
      {error && <p role="status" className="mt-3 text-xs text-rose-700">{error}</p>}
      <fieldset disabled={disabled || !active} className="mt-3"><legend className="mb-2 text-xs font-bold">Chọn vị trí trên trang 1</legend><div className="grid grid-cols-4 gap-2">{Array.from({ length: 16 }, (_, index) => {
        const position = index + 1;
        const occupied = active?.find(item => item.position === position);
        return <button key={position} type="button" disabled={!!occupied || disabled || !active} aria-pressed={value.position === position} title={occupied ? `Đã đặt đến ${new Date(occupied.expiresAt).toLocaleDateString("vi-VN")}` : `Chọn vị trí ${position}`} onClick={() => onChange({ ...value, position })} className={`rounded-lg border bg-white p-2 text-xs disabled:opacity-45 ${value.position === position ? "border-amber-500 ring-2 ring-amber-200" : "border-[#dfe5eb]"}`}><strong className="block">Vị trí {position}</strong>{occupied ? <span className="mt-2 block font-semibold text-[#667085]">Đã đặt</span> : active ? <><span className="mt-1 block">{money(promotionMonthlyPrice(position))}</span><span className="mt-1 block text-[10px]">/tháng</span></> : <span className="mt-2 block">Đang kiểm tra</span>}</button>;
      })}</div></fieldset>
      <label className="mt-3 flex items-center gap-3 text-xs font-bold">Số tháng<input type="number" min={1} max={12} value={value.months} disabled={disabled} onChange={event => onChange({ ...value, months: Number(event.target.value) })} className="w-20 rounded-lg border bg-white p-2"/></label>
      <p className="mt-3 text-sm">Phí quảng cáo: <strong className="text-amber-900">{value.position && Number.isInteger(value.months) && value.months >= 1 && value.months <= 12 ? money(promotionMonthlyPrice(value.position) * value.months) : "—"}</strong></p>
      <p className="mt-1 text-xs leading-5 text-[#667085]">Thanh toán bằng ví khi đăng. Tính theo tháng lịch từ lúc thanh toán, tự hết hạn và không tự gia hạn.</p>
    </>}
  </section>;
}
