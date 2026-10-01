"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, RefreshCw, X } from "lucide-react";

type Topup = { id: number; requestCode: string; userId: string; amount: number; transferContent: string; status: string; createdAt: string };
type Purchase = { id: number; userId: string; amount: number; orderCode: number; targetId?: string | null; sellerUserId?: string | null; description: string; createdAt: string };

export function OwnerFinance() {
  const [items, setItems] = useState<Topup[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    setError("");
    const response = await fetch("/api/admin/wallet-topups", { cache: "no-store" });
    const data = await response.json() as { requests?: Topup[]; purchases?: Purchase[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Chưa thể tải dữ liệu.");
    setItems(data.requests ?? []);
    setPurchases(data.purchases ?? []);
  };
  useEffect(() => { const timer = window.setTimeout(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Chưa thể tải dữ liệu.")); }, 0); return () => window.clearTimeout(timer); }, []);

  const review = async (id: number, status: "approved" | "rejected") => {
    setBusy(id); setError("");
    try {
      const response = await fetch("/api/admin/wallet-topups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Chưa thể xử lý.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể xử lý."); } finally { setBusy(null); }
  };

  return <section className="mx-auto max-w-6xl py-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-[#0b2e59]">Xác nhận nạp tiền</h2><p className="mt-2 text-sm text-[#667085]">Kiểm tra giao dịch thực tế trong tài khoản ngân hàng trước khi duyệt.</p></div><button type="button" onClick={() => void load().catch(cause => setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu."))} aria-label="Tải lại dữ liệu" className="grid size-10 place-items-center rounded-xl border bg-white"><RefreshCw size={18}/></button></div>{error && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700" role="alert">{error}</p>}<div className="mt-6 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f4f7fa] text-[#475467]"><tr><th className="p-3">Mã</th><th className="p-3">Tài khoản</th><th className="p-3">Số tiền</th><th className="p-3">Nội dung CK</th><th className="p-3">Trạng thái</th><th className="p-3 text-right">Xử lý</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-bold">{item.requestCode}</td><td className="p-3">{item.userId}</td><td className="p-3 font-bold text-[#168ac0]">{item.amount.toLocaleString("vi-VN")}đ</td><td className="p-3 font-mono">{item.transferContent}</td><td className="p-3">{item.status === "pending" ? "Chờ xác nhận" : item.status === "approved" ? "Đã duyệt" : "Từ chối"}</td><td className="p-3"><div className="flex justify-end gap-2">{item.status === "pending" && <><button disabled={busy === item.id} onClick={() => void review(item.id, "approved")} className="flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 font-bold text-white">{busy === item.id ? <LoaderCircle size={15} className="animate-spin"/> : <Check size={15}/>}Duyệt</button><button disabled={busy === item.id} onClick={() => void review(item.id, "rejected")} className="flex h-9 items-center gap-1 rounded-lg bg-rose-50 px-3 font-bold text-rose-700"><X size={15}/>Từ chối</button></>}</div></td></tr>)}</tbody></table>{!items.length && !error && <p className="p-10 text-center text-[#667085]">Chưa có yêu cầu nạp tiền.</p>}</div>
  <section className="mt-8"><div><h2 className="text-xl font-bold text-[#0b2e59]">File bản vẽ đã bán</h2><p className="mt-2 text-sm text-[#667085]">Theo dõi người đăng để đối soát và thanh toán cho tác giả.</p></div><div className="mt-4 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-[#f4f7fa] text-[#475467]"><tr><th className="p-3">Đơn</th><th className="p-3">Người mua</th><th className="p-3">Tác giả</th><th className="p-3">Nội dung</th><th className="p-3">Giá trị</th><th className="p-3">Thời gian</th></tr></thead><tbody>{purchases.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-bold">#{item.orderCode}</td><td className="p-3">{item.userId}</td><td className="p-3 font-semibold">{item.sellerUserId || "Chưa xác định"}</td><td className="p-3">{item.description}</td><td className="p-3 font-bold text-[#168ac0]">{Math.abs(item.amount).toLocaleString("vi-VN")}đ</td><td className="p-3 text-[#667085]">{new Date(item.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td></tr>)}</tbody></table>{!purchases.length && <p className="p-10 text-center text-[#667085]">Chưa có giao dịch mua bản vẽ.</p>}</div></section></section>;
}
