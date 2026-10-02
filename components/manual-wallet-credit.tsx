"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Account = { userId: string; displayName: string; email?: string | null; username?: string | null };
type Credit = { reference: string; userId: string; amount: number; orderCode: number; reason: string; performedBy: string; createdAt: string };
type CreditRequest = { userId: string; amount: number; reason: string; requestId: string };
const pendingStorageKey = "tipook:pending-manual-credit";

export function ManualWalletCredit() {
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [credits, setCredits] = useState<Credit[]>([]);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [restoring, setRestoring] = useState(true);
  const [requestId, setRequestId] = useState("");
  const pending = useRef<CreditRequest | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(pendingStorageKey);
        if (saved) {
          const data = JSON.parse(saved) as { request: CreditRequest; account: Account };
          if (!data.request?.requestId || !data.account?.userId || data.request.userId !== data.account.userId) throw new Error("Yêu cầu đã lưu không hợp lệ.");
          pending.current = data.request;
          setSelected(data.account); setAmount(String(data.request.amount)); setReason(data.request.reason);
          setRequestId(data.request.requestId); setUncertain(true);
        }
      } catch { setError("Không thể khôi phục yêu cầu trước đó. Kiểm tra lịch sử trước khi cộng tiền."); }
      finally { setRestoring(false); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/wallet-credits?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { accounts?: Account[]; credits?: Credit[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Không thể tải tài khoản và lịch sử.");
        setAccounts(data.accounts ?? []); setCredits(data.credits ?? []);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu.");
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, reload]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current) return;
    if (!pending.current) {
      const value = Number(amount);
      if (!selected || !Number.isSafeInteger(value) || value < 1 || value > 20_000_000 || !reason.trim()) {
        setError("Chọn tài khoản, nhập số tiền từ 1đ đến 20.000.000đ và lý do."); return;
      }
      pending.current = { userId: selected.userId, amount: value, reason: reason.trim(), requestId: crypto.randomUUID() };
      try { sessionStorage.setItem(pendingStorageKey, JSON.stringify({ request: pending.current, account: selected })); }
      catch { pending.current = null; setError("Không thể lưu mã yêu cầu trong trình duyệt. Bật bộ nhớ phiên trước khi cộng tiền."); return; }
      setRequestId(pending.current.requestId);
    }
    sending.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/wallet-credits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending.current) });
      const data = await response.json() as { credit?: Credit; error?: string };
      if (!response.ok || !data.credit) {
        if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 403) {
          sessionStorage.removeItem(pendingStorageKey); pending.current = null; setUncertain(false); setRequestId("");
        }
        else setUncertain(true);
        throw new Error(data.error || "Chưa xác định kết quả. Gửi lại để kiểm tra cùng giao dịch.");
      }
      setNotice(`Đã cộng ${data.credit.amount.toLocaleString("vi-VN")}đ vào tài khoản ${selected?.displayName ?? data.credit.userId}. Mã giao dịch: #${data.credit.orderCode}.`);
      sessionStorage.removeItem(pendingStorageKey);
      pending.current = null;
      setRequestId(""); setUncertain(false); setAmount(""); setReason(""); setReload(value => value + 1);
    } catch (cause) {
      if (pending.current) setUncertain(true);
      setError(cause instanceof Error ? cause.message : "Chưa thể xác nhận cộng tiền.");
    } finally { sending.current = false; setBusy(false); }
  };

  const locked = busy || uncertain || restoring;
  const fieldClass = "mt-1 w-full rounded-xl border border-[#d0d5dd] bg-white px-3 py-2 text-sm disabled:bg-slate-100";
  return <section className="mt-8">
    <h2 className="text-xl font-bold text-[#0b2e59]">Cộng tiền thủ công vào ví nạp</h2>
    <p className="mt-2 text-sm text-[#667085]">Cộng bù tiền nạp và lưu lịch sử đối soát. Tiền bán file được cộng riêng theo đơn trong mục File bản vẽ đã bán.</p>
    <form onSubmit={event => void submit(event)} className="mt-4 space-y-4 rounded-2xl border bg-white p-4">
      <label className="block text-sm font-semibold">Tìm tài khoản<input value={query} disabled={locked} onChange={event => setQuery(event.target.value)} placeholder="Tên, email, tên đăng nhập hoặc mã tài khoản" className={fieldClass}/></label>
      <label className="block text-sm font-semibold">Tài khoản nhận tiền
        <select required disabled={locked} value={selected?.userId ?? ""} onChange={event => setSelected(accounts.find(account => account.userId === event.target.value) ?? null)} className={fieldClass}>
          <option value="">Chọn tài khoản</option>
          {selected && !accounts.some(account => account.userId === selected.userId) && <option value={selected.userId}>{selected.displayName} · {selected.email || selected.username || selected.userId} · {selected.userId}</option>}
          {accounts.map(account => <option key={account.userId} value={account.userId}>{account.displayName} · {account.email || account.username || account.userId} · {account.userId}</option>)}
        </select>
      </label>
      {selected && <p className="break-all text-sm text-[#475467]">Tài khoản đã chọn: <strong>{selected.displayName}</strong> · {selected.email || selected.username} · {selected.userId}</p>}
      <label className="block text-sm font-semibold">Số tiền cộng (đ)<input type="number" required min={1} max={20000000} step={1} disabled={locked} value={amount} onChange={event => setAmount(event.target.value)} className={fieldClass}/></label>
      <label className="block text-sm font-semibold">Lý do / mã chuyển khoản để đối soát<textarea required maxLength={500} rows={3} disabled={locked} value={reason} onChange={event => setReason(event.target.value)} className={fieldClass}/></label>
      {uncertain && <p className="text-sm text-amber-800">Chưa xác định được kết quả. Bấm “Kiểm tra / gửi lại” để dùng lại cùng mã yêu cầu, tránh cộng trùng. Mã yêu cầu: {requestId}</p>}
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      {notice && <p role="status" className="text-sm font-semibold text-emerald-700">{notice}</p>}
      <button type="submit" disabled={busy || restoring} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Đang xác nhận…" : uncertain ? "Kiểm tra / gửi lại" : "Cộng tiền vào tài khoản đã chọn"}</button>
    </form>
    <div className="mt-6 flex items-center justify-between gap-3"><h3 className="font-bold text-[#0b2e59]">Lịch sử cộng tiền thủ công (100 giao dịch gần nhất)</h3><button type="button" onClick={() => setReload(value => value + 1)} className="text-sm font-semibold text-[#168ac0]">Tải lại</button></div>
    <div className="mt-3 overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#f4f7fa] text-[#475467]"><tr>{["Mã giao dịch", "Tài khoản", "Số tiền", "Lý do", "Người thực hiện", "Thời gian"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{credits.map(credit => <tr key={credit.reference} className="border-t"><td className="p-3"><strong>#{credit.orderCode}</strong><small className="mt-1 block break-all text-[#667085]">{credit.reference}</small></td><td className="p-3">{credit.userId}</td><td className="whitespace-nowrap p-3 font-bold text-emerald-700">+{credit.amount.toLocaleString("vi-VN")}đ</td><td className="max-w-xs whitespace-pre-wrap break-words p-3">{credit.reason}</td><td className="p-3">{credit.performedBy}</td><td className="p-3">{new Date(credit.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td></tr>)}</tbody>
      </table>
      {!credits.length && <p className="p-6 text-center text-sm text-[#667085]">Chưa có giao dịch cộng tiền thủ công.</p>}
    </div>
  </section>;
}
