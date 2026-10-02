/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Copy, LoaderCircle, RefreshCw, WalletCards } from "lucide-react";
import { PurchaseActionButton } from "@/components/purchase-action-button";
import { SellerWalletPanel, type SaleCredit } from "@/components/seller-wallet-panel";
import type { Withdrawal } from "@/lib/seller-wallet";

type Transaction = { id: number; wallet: string; kind: string; amount: number; description: string; createdAt: string; targetType?: string | null; targetId?: string | null };
type Topup = { id?: number; requestCode: string; amount: number; transferContent: string; status: string; createdAt?: string; bank?: Bank };
type Bank = { bankCode: string; accountNumber: string; accountName: string; qrUrl: string; fallbackQrUrl?: string };

export function WalletPanel() {
  const [balance, setBalance] = useState(0);
  const [salesBalance, setSalesBalance] = useState(0);
  const [salesHeld, setSalesHeld] = useState(0);
  const [salesAvailable, setSalesAvailable] = useState(0);
  const [salesLocked, setSalesLocked] = useState(0);
  const [saleCredits, setSaleCredits] = useState<SaleCredit[]>([]);
  const [userId, setUserId] = useState("");
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<Topup[]>([]);
  const [amount, setAmount] = useState(100000);
  const [active, setActive] = useState<{ request: Topup; bank: Bank } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async () => {
    const [walletResponse, requestResponse] = await Promise.all([fetch("/api/wallet", { cache: "no-store" }), fetch("/api/wallet/topups", { cache: "no-store" })]);
    const wallet = await walletResponse.json() as { userId?: string; balance?: number; salesBalance?: number; salesHeld?: number; salesAvailable?: number; salesLocked?: number; saleCredits?: SaleCredit[]; withdrawals?: Withdrawal[]; transactions?: Transaction[]; error?: string };
    const topups = await requestResponse.json() as { requests?: Topup[]; error?: string };
    if (!walletResponse.ok || !requestResponse.ok) throw new Error(wallet.error || topups.error || "Không thể tải lịch sử ví.");
    setBalance(Number(wallet.balance ?? 0));
    setSalesBalance(Number(wallet.salesBalance ?? 0));
    setSalesHeld(Number(wallet.salesHeld ?? 0));
    setSalesAvailable(Number(wallet.salesAvailable ?? 0));
    setSalesLocked(Number(wallet.salesLocked ?? 0));
    setSaleCredits(wallet.saleCredits ?? []);
    setUserId(wallet.userId ?? "");
    setWithdrawals(wallet.withdrawals ?? []);
    setTransactions(wallet.transactions ?? []);
    setRequests(topups.requests ?? []);
    setActive(current => {
      const pending = topups.requests?.find(item => item.status === "pending" && item.bank && item.requestCode === current?.request.requestCode)
        || topups.requests?.find(item => item.status === "pending" && item.bank);
      return pending?.bank ? { request: pending, bank: pending.bank } : null;
    });
  };

  useEffect(() => {
    const refresh = () => void load().catch(cause => setNotice(cause instanceof Error ? cause.message : "Không thể tải ví."));
    const timer = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 15_000);
    window.addEventListener("tipook-wallet-changed", refresh);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener("tipook-wallet-changed", refresh); };
  }, []);

  const createTopup = async () => {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/wallet/topups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }) });
      const data = await response.json() as { request?: Topup; bank?: Bank; error?: string };
      if (!response.ok || !data.request || !data.bank) throw new Error(data.error || "Chưa thể tạo yêu cầu nạp tiền.");
      setActive({ request: data.request, bank: data.bank });
      setRequests((current) => [data.request!, ...current]);
      setNotice("Yêu cầu đã tạo. Hãy chuyển đúng số tiền và nội dung; admin sẽ kiểm tra rồi duyệt thủ công.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Chưa thể tạo yêu cầu nạp tiền.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); setNotice("Đã sao chép."); } catch { setNotice("Không thể sao chép tự động. Bạn có thể chọn và sao chép nội dung trên màn hình."); } };

  return <section id="vi-tipook" className="mt-5 scroll-mt-24 rounded-2xl border border-[#dce8f1] bg-white p-5 shadow-sm">
    <button type="button" aria-label="Tải lại ví" onClick={() => void load().catch(cause => setNotice(cause instanceof Error ? cause.message : "Không thể tải ví."))} className="float-right rounded-lg p-2 text-[#168ac0]"><RefreshCw size={17}/></button><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-extrabold text-[#0b2e59]"><WalletCards size={23} className="text-[#229ed9]"/>Ví nạp</h2><p className="mt-1 text-sm text-[#667085]">Dùng để mua file bản vẽ và quảng cáo. Tiền nạp được chuyển vào tài khoản ngân hàng admin.</p></div><div className="rounded-xl bg-[#eef9fd] px-4 py-3 text-right"><span className="block text-xs font-semibold text-[#667085]">Số dư ví nạp</span><strong className="text-2xl text-[#168ac0]">{balance.toLocaleString("vi-VN")}đ</strong></div></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
      <div><h3 className="font-bold text-[#182230]">Tạo yêu cầu nạp tiền</h3><div className="mt-3 flex flex-wrap gap-2">{[50000,100000,200000,500000,1000000].map((value) => <button key={value} type="button" onClick={() => setAmount(value)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${amount === value ? "border-[#229ed9] bg-[#eef9fd] text-[#168ac0]" : "border-[#d0d5dd] text-[#475467]"}`}>{value.toLocaleString("vi-VN")}đ</button>)}</div><label className="mt-3 block text-sm font-semibold text-[#475467]">Số tiền khác</label><input type="number" min={10000} max={20000000} step={10000} value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="mt-1 h-11 w-full rounded-xl border border-[#d0d5dd] px-3 outline-none focus:border-[#229ed9]"/><button type="button" disabled={busy} onClick={() => void createTopup()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] font-bold text-white disabled:opacity-60">{busy && <LoaderCircle size={18} className="animate-spin"/>}Lấy mã QR chuyển khoản</button><p className="mt-3 text-xs leading-5 text-[#667085]">Số dư không tự cộng từ ảnh biên lai. Admin chỉ duyệt sau khi tiền thực tế vào tài khoản.</p></div>
      <div>{active ? <div className="rounded-2xl border border-[#b9e5f6] bg-[#f6fcff] p-4"><div className="grid gap-4 sm:grid-cols-[150px_1fr]"><img src={active.bank.qrUrl} alt="Mã QR nạp Ví Tipook" onError={event => { if (active.bank.fallbackQrUrl && !event.currentTarget.src.endsWith(active.bank.fallbackQrUrl)) event.currentTarget.src = active.bank.fallbackQrUrl; }} className="mx-auto w-[150px] rounded-xl bg-white object-contain"/><div className="space-y-2 text-sm"><p>Ngân hàng: <strong>{active.bank.bankCode}</strong></p><p>Chủ tài khoản: <strong>{active.bank.accountName}</strong></p><p className="flex items-center gap-2">Số tài khoản: <strong>{active.bank.accountNumber}</strong><button type="button" onClick={() => void copy(active.bank.accountNumber)} aria-label="Sao chép số tài khoản"><Copy size={15}/></button></p><p>Số tiền: <strong className="text-[#168ac0]">{active.request.amount.toLocaleString("vi-VN")}đ</strong></p><p className="flex items-center gap-2">Nội dung: <strong>{active.request.transferContent}</strong><button type="button" onClick={() => void copy(active.request.transferContent)} aria-label="Sao chép nội dung"><Copy size={15}/></button></p></div></div></div> : <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-[#bfd3e2] bg-[#f8fafc] p-5 text-center text-sm text-[#667085]">Chọn số tiền và tạo yêu cầu để xem mã QR.</div>}{notice && <p className="mt-3 text-sm font-semibold text-[#475467]">{notice}</p>}</div>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><h3 className="font-bold text-[#182230]">Yêu cầu nạp gần đây</h3><div className="mt-2 space-y-2">{requests.slice(0,5).map((item) => <div key={item.requestCode} className="flex items-center justify-between rounded-xl bg-[#f6f8fb] px-3 py-2 text-sm"><span><b>{item.amount.toLocaleString("vi-VN")}đ</b><small className="ml-2 text-[#667085]">{item.transferContent}</small></span><span className={`flex items-center gap-1 text-xs font-bold ${item.status === "approved" ? "text-emerald-700" : item.status === "rejected" ? "text-rose-700" : "text-amber-700"}`}>{item.status === "approved" ? <CheckCircle2 size={14}/> : <Clock3 size={14}/>} {item.status === "approved" ? "Đã duyệt" : item.status === "rejected" ? "Từ chối" : "Chờ xác nhận"}</span></div>)}{!requests.length && <p className="text-sm text-[#98a2b3]">Chưa có yêu cầu nạp.</p>}</div></div><div><h3 className="font-bold text-[#182230]">Lịch sử ví</h3><div className="mt-2 space-y-2">{transactions.slice(0,20).map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#f6f8fb] px-3 py-2 text-sm"><span className="min-w-0 pr-3"><small className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.wallet === "sales" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{item.wallet === "sales" ? "Ví bán file" : "Ví nạp"}</small>{item.description}</span>{item.kind === "purchase" && item.targetId && (item.targetType === "post" || item.targetType === "drawing") && <PurchaseActionButton targetType={item.targetType} targetId={item.targetId} title={item.description} price={Math.abs(item.amount).toLocaleString("vi-VN") + "đ"} label="Tải lại" className="mr-2 flex shrink-0 items-center gap-1 text-xs font-bold text-[#168ac0]"/>}<b className={item.amount > 0 ? "text-emerald-700" : "text-[#182230]"}>{item.amount > 0 ? "+" : ""}{item.amount.toLocaleString("vi-VN")}đ</b></div>)}{!transactions.length && <p className="text-sm text-[#98a2b3]">Chưa có giao dịch.</p>}</div></div></div>
    {userId && <SellerWalletPanel key={userId} userId={userId} balance={salesBalance} available={salesAvailable} lockedAmount={salesLocked} held={salesHeld} credits={saleCredits} withdrawals={withdrawals} refresh={load}/>}
  </section>;
}
