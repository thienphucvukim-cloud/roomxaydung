"use client";

import { useState } from "react";
import { ArrowLeftRight, Check, LoaderCircle, Plus, UserRound, X } from "lucide-react";

type SavedAccount = { userId: string; name: string; label: string | null; active: boolean };

export function AccountSwitcher({ returnTo, blocked = false }: { returnTo: string; blocked?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/accounts", { cache: "no-store" });
      const data = await response.json() as { accounts?: SavedAccount[]; error?: string };
      if (!response.ok || !data.accounts) throw new Error(data.error || "Chưa thể tải danh sách tài khoản.");
      setAccounts(data.accounts);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối. Vui lòng thử lại."); }
    finally { setLoading(false); }
  }

  async function select(account: SavedAccount, action: "switch" | "remove") {
    if (blocked || busy) return;
    setBusy(account.userId); setError("");
    try {
      const response = await fetch("/api/auth/accounts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId: account.userId, returnTo: "/tai-khoan" }) });
      const data = await response.json() as { redirectTo?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Chưa thể chuyển đổi tài khoản.");
      if (action === "switch") {
        // Reload every account-dependent view, including the owner workspace.
        window.location.assign(data.redirectTo || "/tai-khoan");
        return;
      }
      setAccounts(current => current.filter(item => item.userId !== account.userId));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối. Vui lòng thử lại."); }
    setBusy(null);
  }

  return <div className="mt-1 border-t border-[#e1e7ee] pt-1">
    <button type="button" disabled={Boolean(busy)} aria-expanded={expanded} onClick={() => {
      setExpanded(!expanded);
      if (!expanded) void load();
    }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[#f3f7fa] disabled:opacity-50"><ArrowLeftRight size={18}/>Chuyển tài khoản</button>
    {expanded && <div className="rounded-xl bg-[#f3f7fa] p-2">
      <p className="px-1 pb-2 text-xs text-[#667085]">Tài khoản đã đăng nhập trên trình duyệt này</p>
      {loading ? <p role="status" className="flex items-center gap-2 p-2 text-xs"><LoaderCircle size={16} className="animate-spin"/>Đang tải tài khoản...</p> : <div className="max-h-60 space-y-1 overflow-y-auto">
        {accounts.map(account => <div key={account.userId} className="flex items-center rounded-lg bg-white">
          <button type="button" disabled={account.active || blocked || Boolean(busy)} onClick={() => void select(account, "switch")} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-2 text-left hover:bg-sky-50 disabled:cursor-default">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-100 text-[#073b74]"><UserRound size={17}/></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{account.name}</span><span className="block truncate text-xs text-[#667085]">{account.active ? "Đang sử dụng" : account.label || "Thành viên NhàĐẹpChất"}</span></span>
            {busy === account.userId ? <LoaderCircle size={16} className="shrink-0 animate-spin"/> : account.active ? <Check size={16} className="shrink-0 text-[#168ac0]"/> : null}
          </button>
          {!account.active && <button type="button" disabled={blocked || Boolean(busy)} onClick={() => void select(account, "remove")} aria-label={`Gỡ tài khoản ${account.name} khỏi trình duyệt`} title="Gỡ tài khoản khỏi trình duyệt" className="mr-1 grid size-8 shrink-0 place-items-center rounded-full text-[#667085] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><X size={15}/></button>}
        </div>)}
        {!accounts.length && !error && <p className="p-2 text-xs text-[#667085]">Chưa có tài khoản được lưu.</p>}
      </div>}
      {error && <p role="alert" className="p-2 text-xs text-rose-600">{error}</p>}
      <p className="px-1 pt-2 text-[11px] text-[#667085]">Lưu tối đa 5 tài khoản. Phiên hết hạn cần đăng nhập lại.</p>
    </div>}
    <a href={`/dang-nhap?add_account=1&return_to=${encodeURIComponent(returnTo)}`} aria-disabled={blocked || Boolean(busy)} onClick={event => { if (blocked || busy) event.preventDefault(); }} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#168ac0] hover:bg-[#f3f7fa] ${blocked || busy ? "opacity-50" : ""}`}><Plus size={18}/>Thêm tài khoản</a>
    {blocked && <p role="status" className="px-3 pb-2 text-xs text-amber-700">Lưu hoặc bỏ thay đổi trước khi chuyển tài khoản.</p>}
  </div>;
}
