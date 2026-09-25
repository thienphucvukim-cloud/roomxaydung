"use client";

import { useState } from "react";
import { LoaderCircle, ShieldCheck, ShoppingCart, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PurchaseActionButton({ targetType, targetId, title, price, className = "" }: { targetType: "drawing" | "post"; targetId: string; title: string; price: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const checkout = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Chưa thể tạo giao dịch thanh toán.");
      window.location.assign(data.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể tạo giao dịch thanh toán.");
      setBusy(false);
    }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Đặt mua" className={`group/purchase relative ${className}`}>
      <ShoppingCart size={19}/>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#182230] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover/purchase:block group-focus-visible/purchase:block">Đặt mua</span>
    </button>
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(""); }}>
      <DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] max-w-[460px] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl">
        <DialogHeader className="relative border-b border-[#e4e6eb] px-14 py-5 text-center sm:text-center">
          <DialogTitle className="text-xl font-extrabold text-[#0b2e59]">Xác nhận đặt mua</DialogTitle>
          <DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose>
        </DialogHeader>
        <div className="p-5">
          <p className="text-sm text-[#667085]">Bạn đang mua</p>
          <h2 className="mt-1 font-extrabold leading-6 text-[#182230]">{title}</h2>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f4f9fc] px-4 py-3"><span className="text-sm font-semibold text-[#475467]">Tổng thanh toán</span><strong className="text-xl text-[#168ac0]">{price}</strong></div>
          <div className="mt-4 flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800"><ShieldCheck size={20} className="mt-0.5 shrink-0"/><p>Giao dịch được xử lý trên trang thanh toán bảo mật của payOS. Đơn chỉ được xác nhận sau khi hệ thống nhận kết quả thanh toán hợp lệ.</p></div>
          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
          <button type="button" onClick={checkout} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] font-extrabold text-white transition hover:bg-[#168ac0] disabled:opacity-60">{busy ? <LoaderCircle size={19} className="animate-spin"/> : <ShoppingCart size={19}/>}Thanh toán ngay</button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}