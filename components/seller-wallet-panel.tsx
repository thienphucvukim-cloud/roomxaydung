"use client";

import { PENDING_WALLET_STORAGE } from "@/lib/legacy-contracts";
import { SITE_EVENTS } from "@/lib/site-events";
import { useEffect, useState } from "react";
import { ArrowRightLeft, Landmark, WalletCards } from "lucide-react";
import type { Withdrawal } from "@/lib/seller-wallet";

type Pending = { userId: string; requestId: string; action: "transfer" | "withdraw"; amount: number; bankName: string; accountNumber: string; accountName: string };
const storageKey = PENDING_WALLET_STORAGE.sellerOperation;
const money = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;
export type SaleCredit = { purchaseId: number; amount: number; createdAt: string; availableAt: string; ready: boolean; revokedAt: string | null; revocationReason: string | null };

export function SellerWalletPanel({ userId, balance, available, lockedAmount, held, credits, withdrawals, refresh }: { userId: string; balance: number; available: number; lockedAmount: number; held: number; credits: SaleCredit[]; withdrawals: Withdrawal[]; refresh: () => Promise<void> }) {
  const [action, setAction] = useState<"transfer" | "withdraw">("withdraw");
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const operationAction = pending?.action ?? (available < 50000 ? "transfer" : action);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as Pending | null;
        if (saved?.userId === userId && saved.requestId && ["transfer", "withdraw"].includes(saved.action)) {
          setPending(saved); setAction(saved.action); setAmount(String(saved.amount)); setBankName(saved.bankName); setAccountNumber(saved.accountNumber); setAccountName(saved.accountName);
        }
      } catch { /* The server still protects every operation with its request ID. */ }
      setRestoring(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId]);

  const submit = async () => {
    const operation = pending ?? { userId, requestId: crypto.randomUUID(), action: operationAction, amount: Number(amount), bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountName: accountName.trim() };
    setBusy(true); setNotice(""); setPending(operation);
    try { sessionStorage.setItem(storageKey, JSON.stringify(operation)); } catch { /* Keep the request in component state when storage is unavailable. */ }
    try {
      const response = await fetch("/api/wallet/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation) });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        if (response.status < 500) { setPending(null); try { sessionStorage.removeItem(storageKey); } catch {} }
        throw new Error(data.error || "Chưa thể xử lý yêu cầu.");
      }
      setPending(null); setAmount("");
      try { sessionStorage.removeItem(storageKey); } catch {}
      setNotice(operation.action === "transfer" ? "Đã chuyển tiền sang ví nạp." : "Đã gửi yêu cầu rút. Tiền được giữ lại chờ admin chuyển khoản.");
      window.dispatchEvent(new Event(SITE_EVENTS.walletChanged));
      await refresh();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Chưa xác định được kết quả. Bấm Kiểm tra / gửi lại để tránh trừ tiền trùng."); }
    finally { setBusy(false); }
  };

  const locked = busy || restoring || !!pending;
  const field = "mt-1 w-full rounded-xl border border-[#d0d5dd] bg-white px-3 py-2.5 text-sm disabled:bg-slate-100";
  return <div className="mt-6 border-t border-[#e4e7ec] pt-5">
    <div className={`rounded-2xl border p-4 transition-colors ${balance > 0 ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className={`flex items-center gap-2 text-lg font-extrabold ${balance > 0 ? "text-emerald-800" : "text-slate-500"}`}><WalletCards size={22}/>Ví thu nhập</h3><p className="mt-1 text-sm text-[#667085]">Thu nhập từ bán file và dự án thiết kế. Chờ 36 giờ, rút tối thiểu 50.000đ.</p></div><div className="text-right"><span className="block text-xs text-[#667085]">Số dư ví thu nhập</span><strong className={`text-2xl ${balance > 0 ? "text-emerald-700" : "text-slate-400"}`}>{money(balance)}</strong></div></div>
      <p className="mt-3 text-sm font-semibold text-emerald-800">Đã đủ 36 giờ, có thể dùng: {money(available)}</p>
      {lockedAmount > 0 && <p className="mt-2 text-sm font-semibold text-amber-800">Đang giữ theo thời hạn hoặc tranh chấp: {money(lockedAmount)}</p>}
      {held > 0 && <p className="mt-2 text-sm font-semibold text-amber-800">Đang chờ thanh toán về ngân hàng: {money(held)}</p>}
      {balance < 0 && <p className="mt-2 text-sm font-semibold text-rose-700">Khoản thiếu do thu hồi: {money(-balance)}. Tiền bán file tiếp theo sẽ được đối trừ trước khi rút hoặc chuyển.</p>}
      {balance === 0 && !pending && <p className="mt-3 text-sm text-slate-500">Ví sẽ sáng khi có thu nhập bán file hoặc dự án thiết kế đã bàn giao.</p>}
    </div>
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={locked || available < 50000} onClick={() => setAction("withdraw")} aria-pressed={operationAction === "withdraw"} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50 ${operationAction === "withdraw" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "text-slate-600"}`}><Landmark size={16}/>Rút về ngân hàng</button>
        <button type="button" disabled={locked || available <= 0} onClick={() => setAction("transfer")} aria-pressed={operationAction === "transfer"} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50 ${operationAction === "transfer" ? "border-[#229ed9] bg-[#eef9fd] text-[#168ac0]" : "text-slate-600"}`}><ArrowRightLeft size={16}/>Chuyển sang ví nạp</button>
      </div>
      {(available > 0 || pending) && <>
        <label className="block text-sm font-semibold">Số tiền (đ)<input required type="number" min={operationAction === "withdraw" ? 50000 : 1} max={pending ? 20000000 : Math.min(available, 20000000)} step={1} value={amount} disabled={locked} onChange={event => setAmount(event.target.value)} className={field}/></label>
        {operationAction === "withdraw" && <div className="grid gap-3 sm:grid-cols-3"><label className="block text-sm font-semibold">Ngân hàng<input required maxLength={100} disabled={locked} value={bankName} onChange={event => setBankName(event.target.value)} className={field}/></label><label className="block text-sm font-semibold">Số tài khoản<input required minLength={4} maxLength={40} pattern="[a-zA-Z0-9]{4,40}" disabled={locked} value={accountNumber} onChange={event => setAccountNumber(event.target.value)} className={field}/></label><label className="block text-sm font-semibold">Tên chủ tài khoản<input required maxLength={120} disabled={locked} value={accountName} onChange={event => setAccountName(event.target.value)} className={field}/></label></div>}
        <p className="text-xs leading-5 text-[#667085]">{operationAction === "withdraw" ? "Rút tối thiểu 50.000đ, chỉ dùng tiền đã đủ 36 giờ từ lúc ghi nhận thu nhập. Kiểm tra kỹ tài khoản nhận tiền. Admin chuyển khoản thủ công; yêu cầu bị từ chối sẽ được hoàn về ví thu nhập." : "Chỉ chuyển tiền đã đủ 36 giờ sang ví nạp để mua file và quảng cáo. Không thể chuyển ngược từ ví nạp sang ví thu nhập."}</p>
        <button type="submit" disabled={busy || restoring || (!pending && (operationAction === "withdraw" ? available < 50000 : available <= 0))} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang xử lý…" : pending ? "Kiểm tra / gửi lại" : operationAction === "withdraw" ? "Gửi yêu cầu rút tiền" : "Chuyển tiền sang ví nạp"}</button>
      </>}
      {pending && !busy && <p className="break-all text-xs text-amber-800">Yêu cầu đang chờ xác nhận kết quả. Gửi lại cùng mã để tránh trừ tiền trùng: {pending.requestId}</p>}
      {notice && <p role="status" className="text-sm font-semibold text-[#475467]">{notice}</p>}
    </form>
    <h3 className="mt-5 font-bold text-[#182230]">Tiền bán file được cộng</h3><p className="mt-1 text-xs text-[#667085]">Mỗi khoản chờ 36 giờ từ lúc admin cộng. Admin có thể thu hồi khoản đã cộng khi có khiếu nại, kể cả sau 36 giờ.</p>
    <div className="mt-2 space-y-2">{credits.map(credit => <div key={credit.purchaseId} className="rounded-xl bg-[#f6f8fb] px-3 py-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{money(credit.amount)}</strong><span className={credit.revokedAt ? "text-rose-700" : !credit.ready ? "text-amber-700" : "text-emerald-700"}>{credit.revokedAt ? "Đã thu hồi" : !credit.ready ? "Chờ đủ 36 giờ" : "Đã đủ 36 giờ"}</span></div><p className="mt-1 text-xs text-[#667085]">Được dùng từ: {new Date(credit.availableAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>{credit.revocationReason && <p className="mt-1 break-words text-xs text-rose-700">Lý do thu hồi: {credit.revocationReason}</p>}</div>)}{!credits.length && <p className="text-sm text-[#98a2b3]">Chưa có khoản tiền bán file được cộng.</p>}</div>
    <h3 className="mt-5 font-bold text-[#182230]">Yêu cầu rút tiền</h3>
    <div className="mt-2 space-y-2">{withdrawals.map(item => <div key={item.id} className="rounded-xl bg-[#f6f8fb] px-3 py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{money(item.amount)}</strong><span className={`font-semibold ${item.status === "paid" ? "text-emerald-700" : item.status === "rejected" ? "text-rose-700" : "text-amber-700"}`}>{item.status === "paid" ? "Đã thanh toán" : item.status === "rejected" ? "Từ chối · đã hoàn ví" : "Chờ admin thanh toán"}</span></div><p className="mt-1 text-xs text-[#667085]">{item.bankName} · {item.accountNumber} · {item.accountName}</p><p className="mt-1 text-xs text-[#667085]">#{item.id.slice(0,8)} · {new Date(item.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>{item.reviewNote && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[#475467]">{item.status === "paid" ? "Đối soát" : "Lý do"}: {item.reviewNote}</p>}</div>)}{!withdrawals.length && <p className="text-sm text-[#98a2b3]">Chưa có yêu cầu rút tiền.</p>}</div>
  </div>;
}
