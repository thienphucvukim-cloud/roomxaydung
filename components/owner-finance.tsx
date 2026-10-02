"use client";

import { useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { ManualWalletCredit } from "./manual-wallet-credit";
import type { Withdrawal } from "@/lib/seller-wallet";

type Topup = { id: number; requestCode: string; userId: string; amount: number; transferContent: string; status: string; createdAt: string };
type Purchase = { id: number; userId: string; amount: number; orderCode: number; sellerUserId?: string | null; description: string; createdAt: string; saleCredit?: { amount: number; grossAmount: number; adminPercent: number; reviewedBy: string; createdAt: string; revokedAt: string | null; revokedBy: string | null; revocationReason: string | null } | null };
const money = (value: number) => Math.abs(value).toLocaleString("vi-VN") + "đ";
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const button = "rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50";
const rejectButton = "rounded-lg bg-rose-50 px-3 py-2 font-bold text-rose-700 disabled:opacity-50";

export function OwnerFinance() {
  const [items, setItems] = useState<Topup[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adminPercent, setAdminPercent] = useState(20);
  const [feeInput, setFeeInput] = useState("20");
  const [loaded, setLoaded] = useState(false);
  const fee = Number(feeInput);
  const validFee = feeInput.trim() !== "" && Number.isInteger(fee) && fee >= 0 && fee <= 99;
  const feeSaved = loaded && validFee && fee === adminPercent;
  const sellerAmount = (amount: number) => validFee ? Math.floor(Math.abs(amount) * (100 - fee) / 100) : 0;
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/admin/wallet-topups", { cache: "no-store" });
    const data = await response.json() as { requests?: Topup[]; purchases?: Purchase[]; withdrawals?: Withdrawal[]; adminPercent: number; error?: string };
    if (!response.ok) throw new Error(data.error || "Chưa thể tải dữ liệu.");
    setAdminPercent(data.adminPercent); setFeeInput(String(data.adminPercent)); setLoaded(true);
    setItems(data.requests ?? []); setPurchases(data.purchases ?? []); setWithdrawals(data.withdrawals ?? []);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : "Chưa thể tải dữ liệu.")); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const mutate = async (key: string, url: string, body: object, message: string) => {
    setBusy(key); setError(""); setNotice("");
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string; amount?: number; replayed?: boolean };
      if (!response.ok) throw new Error(data.error || "Chưa thể xử lý.");
      setNotice(data.amount !== undefined ? (data.replayed ? "Đơn đã được cộng trước đó: " : "Đã cộng ") + money(data.amount) + " vào ví bán file của tác giả." : message); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể xử lý. Tải lại dữ liệu để kiểm tra."); }
    finally { setBusy(null); }
  };

  return <section className="mx-auto w-full min-w-0 max-w-full py-4">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-[#0b2e59]">Xác nhận nạp tiền</h2><p className="mt-2 text-sm text-[#667085]">Kiểm tra giao dịch thực tế trong tài khoản ngân hàng trước khi cộng vào ví nạp.</p></div><button type="button" onClick={() => { setError(""); void load().catch(cause => setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu.")); }} aria-label="Tải lại dữ liệu" className="grid size-10 place-items-center rounded-xl border bg-white"><RefreshCw size={18}/></button></div>
    {error && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700" role="alert">{error}</p>}
    {notice && <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700" role="status">{notice}</p>}
    <div className="mt-6 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f4f7fa] text-[#475467]"><tr>{["Mã", "Tài khoản", "Số tiền", "Nội dung CK", "Trạng thái", "Xử lý"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-t"><td className="p-3 font-bold">{item.requestCode}</td><td className="p-3">{item.userId}</td><td className="p-3 font-bold text-[#168ac0]">{money(item.amount)}</td><td className="p-3 font-mono">{item.transferContent}</td><td className="p-3">{item.status === "pending" ? "Chờ xác nhận" : item.status === "approved" ? "Đã duyệt" : "Từ chối"}</td><td className="p-3"><div className="flex justify-end gap-2">{item.status === "pending" && <><button disabled={!!busy} onClick={() => void mutate("topup:" + item.id, "/api/admin/wallet-topups", { id: item.id, status: "approved" }, "Đã cộng tiền vào ví nạp.")} className={button}><Check size={15} className="mr-1 inline"/>Duyệt</button><button disabled={!!busy} onClick={() => void mutate("topup:" + item.id, "/api/admin/wallet-topups", { id: item.id, status: "rejected" }, "Đã từ chối yêu cầu nạp.")} className={rejectButton}><X size={15} className="mr-1 inline"/>Từ chối</button></>}</div></td></tr>)}</tbody></table>{!items.length && !error && <p className="p-10 text-center text-[#667085]">Chưa có yêu cầu nạp tiền.</p>}</div>
    <ManualWalletCredit/>
    <section className="mt-8"><h2 className="text-xl font-bold text-[#0b2e59]">File bản vẽ đã bán</h2><p className="mt-2 text-sm text-[#667085]">Kiểm tra đơn rồi cộng vào ví bán file. Mỗi khoản chờ 36 giờ từ lúc cộng. Nếu có khiếu nại, nhập lý do để thu hồi; yêu cầu rút đang chờ của người bán sẽ bị hủy và hoàn ví trước khi thu hồi. Tiền đã rút hoặc chuyển tạo khoản thiếu để đối trừ doanh thu tiếp theo.</p>
      <div className="mt-4 space-y-3 rounded-2xl border bg-white p-4">
        <label className="block text-sm font-semibold">Phí admin (%)<input type="number" min={0} max={99} step={1} value={feeInput} disabled={!!busy || !loaded} onChange={event => setFeeInput(event.target.value)} className="ml-3 w-24 rounded-lg border p-2"/></label>
        <p className="text-sm text-[#475467]">{validFee ? "Người bán nhận " + (100 - fee) + "% · Admin giữ " + fee + "%." : "Nhập phí nguyên từ 0% đến 99%."} Số tiền người bán nhận làm tròn xuống đến đồng; phần còn lại là phí admin.</p>
        <button type="button" disabled={!!busy || !loaded || !validFee || feeSaved} onClick={() => void mutate("commission", "/api/admin/wallet-sales", { action: "commission", adminPercent: fee }, "Đã lưu tỷ lệ chia tiền bán file.")} className={button}>Lưu tỷ lệ</button>
        {!feeSaved && loaded && <p className="text-sm text-amber-800">Lưu tỷ lệ trước khi cộng tiền. Tỷ lệ mới áp dụng cho các đơn chưa cộng; các khoản đã cộng giữ nguyên.</p>}
      </div>
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[#f4f7fa] text-[#475467]"><tr>{["Đơn", "Người mua", "Tác giả", "Nội dung", "Giá bán / chia tiền", "Thời gian", "Ví bán file"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{purchases.map(item => <tr key={item.id} className="border-t"><td className="p-3 font-bold">#{item.orderCode}</td><td className="p-3">{item.userId}</td><td className="p-3 font-semibold">{item.sellerUserId || "Chưa xác định"}</td><td className="p-3">{item.description}</td><td className="p-3"><strong className="text-[#168ac0]">{money(item.amount)}</strong><p className="mt-1 text-xs text-emerald-700">Người bán ({100 - (item.saleCredit?.adminPercent ?? fee)}%): {validFee || item.saleCredit ? money(item.saleCredit?.amount ?? sellerAmount(item.amount)) : "—"}</p><p className="text-xs text-[#667085]">Admin ({item.saleCredit?.adminPercent ?? fee}%): {validFee || item.saleCredit ? money(Math.abs(item.amount) - (item.saleCredit?.amount ?? sellerAmount(item.amount))) : "—"}</p></td><td className="p-3 text-[#667085]">{time(item.createdAt)}</td><td className="p-3">{item.saleCredit ? item.saleCredit.revokedAt ? <div className="text-xs text-rose-700"><strong>Đã thu hồi</strong><p>{item.saleCredit.revocationReason}</p><p>{item.saleCredit.revokedBy} · {time(item.saleCredit.revokedAt)}</p></div> : <div className="min-w-56 space-y-2"><div className="text-xs text-emerald-700"><strong>Đã cộng {money(item.saleCredit.amount)}</strong><p>{item.saleCredit.reviewedBy} · {time(item.saleCredit.createdAt)}</p><p>Được dùng từ: {time(new Date(Date.parse(item.saleCredit.createdAt) + 36 * 60 * 60 * 1000).toISOString())}</p></div><input aria-label={"Lý do thu hồi đơn " + item.orderCode} maxLength={500} placeholder="Lý do khiếu nại / thu hồi" value={notes["sale:" + item.id] ?? ""} disabled={!!busy} onChange={event => setNotes(current => ({ ...current, ["sale:" + item.id]: event.target.value }))} className="w-full rounded-lg border p-2 text-sm"/><button disabled={!!busy || !notes["sale:" + item.id]?.trim()} onClick={() => void mutate("sale:" + item.id, "/api/admin/wallet-sales", { action: "revoke", purchaseId: item.id, note: notes["sale:" + item.id] }, "Đã thu hồi tiền bán file và lưu lý do.")} className={rejectButton}>Thu hồi tiền bán file</button></div> : item.amount < 0 && item.sellerUserId ? <button disabled={!!busy || !feeSaved || sellerAmount(item.amount) < 1} onClick={() => void mutate("sale:" + item.id, "/api/admin/wallet-sales", { action: "credit", purchaseId: item.id, adminPercent }, "Đã cộng " + money(sellerAmount(item.amount)) + " vào ví bán file của tác giả.")} className={button}>{busy === "sale:" + item.id ? "Đang cộng…" : "Cộng " + money(sellerAmount(item.amount)) + " vào ví bán file"}</button> : <span className="text-xs text-slate-500">Không có tiền bán file</span>}</td></tr>)}</tbody></table>{!purchases.length && <p className="p-10 text-center text-[#667085]">Chưa có giao dịch mua bản vẽ.</p>}</div>
    </section>
    <section className="mt-8"><h2 className="text-xl font-bold text-[#0b2e59]">Thanh toán tiền bán file</h2><p className="mt-2 text-sm text-[#667085]">Rút tối thiểu 50.000đ từ tiền đã đủ 36 giờ. Tiền yêu cầu rút đã được giữ lại. Chuyển khoản tới đúng tài khoản bên dưới, nhập mã giao dịch rồi xác nhận đã thanh toán. Từ chối sẽ hoàn tiền về ví bán file.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[#f4f7fa] text-[#475467]"><tr>{["Yêu cầu", "Người bán", "Số tiền", "Tài khoản nhận", "Trạng thái", "Đối soát / xử lý"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{withdrawals.map(item => <tr key={item.id} className="border-t"><td className="p-3"><strong>#{item.id.slice(0,8)}</strong><p className="mt-1 text-xs text-[#667085]">{time(item.createdAt)}</p></td><td className="p-3">{item.userId}</td><td className="p-3 font-bold text-emerald-700">{money(item.amount)}</td><td className="p-3"><strong>{item.bankName}</strong><p className="font-mono">{item.accountNumber}</p><p>{item.accountName}</p></td><td className="p-3">{item.status === "paid" ? "Đã thanh toán" : item.status === "rejected" ? "Từ chối · đã hoàn ví" : "Chờ thanh toán"}</td><td className="p-3">{item.status === "pending" ? <div className="space-y-2"><input aria-label={"Mã giao dịch hoặc lý do từ chối yêu cầu " + item.id.slice(0,8)} maxLength={500} placeholder="Mã giao dịch CK / lý do từ chối" value={notes[item.id] ?? ""} disabled={!!busy} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} className="w-full rounded-lg border p-2"/><div className="flex gap-2"><button disabled={!!busy || !notes[item.id]?.trim()} onClick={() => void mutate("withdrawal:" + item.id, "/api/admin/wallet-sales", { action: "review", id: item.id, status: "paid", note: notes[item.id] }, "Đã xác nhận thanh toán về ngân hàng.")} className={button}>Đã chuyển khoản</button><button disabled={!!busy || !notes[item.id]?.trim()} onClick={() => void mutate("withdrawal:" + item.id, "/api/admin/wallet-sales", { action: "review", id: item.id, status: "rejected", note: notes[item.id] }, "Đã từ chối và hoàn tiền về ví bán file.")} className={rejectButton}>Từ chối / hoàn ví</button></div></div> : <div className="max-w-xs text-xs text-[#667085]"><p className="whitespace-pre-wrap break-words">{item.reviewNote}</p><p className="mt-1">{item.reviewedBy}</p>{item.reviewedAt && <p>{time(item.reviewedAt)}</p>}</div>}</td></tr>)}</tbody></table>{!withdrawals.length && <p className="p-10 text-center text-[#667085]">Chưa có yêu cầu rút tiền.</p>}</div>
    </section>
  </section>;
}
