"use client";

import { useState } from "react";
import { Download, LoaderCircle, ShieldCheck, ShoppingCart, WalletCards, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseVndPrice } from "@/lib/drawing-catalog";

type PurchaseResult = { message?: string; downloadLinks?: { name: string; url: string }[]; error?: string; balance?: number; required?: number };

export function PurchaseActionButton({ targetType, targetId, title, price, className = "", label }: { targetType: "drawing" | "post"; targetId: string; title: string; price: string; className?: string; label?: string }) {
  const amount = parseVndPrice(price);
  const displayPrice = amount ? `${amount.toLocaleString("vi-VN")}đ` : price;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requiresTopup, setRequiresTopup] = useState(false);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const showDialog = () => {
    setOpen(true);
    setError("");
    setRequiresTopup(false);
    setResult(null);
    fetch("/api/wallet", { cache: "no-store" }).then(async (response) => (await response.json()) as { balance?: number }).then((data) => setBalance(Number(data.balance ?? 0))).catch(() => setBalance(null));
  };

  const checkout = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/wallet/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, purchaseId: crypto.randomUUID() }),
      });
      const data = await response.json() as PurchaseResult;
      if (!response.ok) { setRequiresTopup(response.status === 402); throw new Error(data.error || "Chưa thể thanh toán bằng Ví Tipook."); }
      setResult(data);
      window.dispatchEvent(new Event("tipook-wallet-changed"));
      window.dispatchEvent(new Event("tipook-messages-changed"));
      const walletResponse = await fetch("/api/wallet", { cache: "no-store" });
      const wallet = await walletResponse.json() as { balance?: number };
      setBalance(Number(wallet.balance ?? 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể thanh toán bằng Ví Tipook.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button type="button" data-requires-account onClick={showDialog} aria-label={label || "Đặt mua"} className={`group/purchase relative ${className}`}>
      <ShoppingCart size={19}/>
      {label && <span className={label === "Tải miễn phí" ? "sr-only" : undefined}>{label}</span>}
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#182230] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover/purchase:block group-focus-visible/purchase:block">Đặt mua</span>
    </button>
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setError(""); setResult(null); } }}>
      <DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] max-w-[460px] gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl">
        <DialogHeader className="relative border-b border-[#e4e6eb] px-14 py-5 text-center sm:text-center">
          <DialogTitle className="text-xl font-extrabold text-[#0b2e59]">Thanh toán bằng Ví Tipook</DialogTitle>
          <DialogClose className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-[#e4e6eb] text-[#606770]" aria-label="Đóng"><X size={21}/></DialogClose>
        </DialogHeader>
        <div className="p-5">
          <p className="text-sm text-[#667085]">Bạn đang mua</p>
          <h2 className="mt-1 font-extrabold leading-6 text-[#182230]">{title}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#f4f9fc] px-4 py-3"><span className="block text-xs font-semibold text-[#667085]">Giá bản vẽ</span><strong className="mt-1 block text-lg text-[#168ac0]">{displayPrice}</strong></div>
            <div className="rounded-xl bg-[#f4f9fc] px-4 py-3"><span className="block text-xs font-semibold text-[#667085]">Số dư ví nạp</span><strong className="mt-1 block text-lg text-[#0b2e59]">{balance === null ? "Đang tải..." : `${balance.toLocaleString("vi-VN")}đ`}</strong></div>
          </div>
          <div className="mt-4 flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800"><ShieldCheck size={20} className="mt-0.5 shrink-0"/><p>Tiền được trừ trực tiếp từ Ví Tipook. Giao dịch lưu lại tên bản vẽ và tác giả để admin đối soát.</p></div>
          {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"><p>{error}</p>{requiresTopup && <a href="/tai-khoan?wallet=topup#vi-tipook" className="mt-2 inline-flex items-center gap-1.5 text-[#168ac0] hover:underline"><WalletCards size={16}/>Nạp tiền vào ví</a>}</div>}
          {result && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><p className="font-semibold">{result.message}</p>{result.downloadLinks?.map((item) => <a key={item.url} href={item.url} className="mt-2 flex items-center gap-2 rounded-lg bg-white px-3 py-2 font-bold text-[#168ac0]"><Download size={17}/>{item.name}</a>)}</div>}
          {!result && <button type="button" onClick={checkout} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] font-extrabold text-white transition hover:bg-[#168ac0] disabled:opacity-60">{busy ? <LoaderCircle size={19} className="animate-spin"/> : <WalletCards size={19}/>}Xác nhận mua</button>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
