"use client";
import { useState, type FormEvent } from "react";
import { TotpCodeForm, type TotpChallengeResult } from "@/components/totp-code-form";
export function AdminTotpSettings() {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [recovery, setRecovery] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [challenge, setChallenge] = useState<TotpChallengeResult | null>(null);
  async function rotate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/totp-rotate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: form.get("password"), code: form.get("code"), recovery }) });
      const data = await response.json() as TotpChallengeResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Chưa thể đổi thiết bị.");
      setChallenge(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối."); } finally { setBusy(false); }
  }
  return <div className="password-change"><h3 className="mt-6 font-semibold">Ứng dụng xác thực</h3><p className="email-code-help">Mã được tạo trên điện thoại. Khi đổi thiết bị, bạn nhận bộ mã khôi phục mới; thiết bị và mã dự phòng cũ bị vô hiệu.</p>{notice && <p role="status" className="admin-alert success">{notice}</p>}{challenge ? <TotpCodeForm challenge={challenge} account onRestart={() => setChallenge(null)} onVerified={() => { setChallenge(null); setOpen(false); setNotice("Đã đổi thiết bị, cập nhật mã khôi phục và đăng xuất các phiên khác."); }}/> : open ? <form className="owner-edit-form" onSubmit={rotate}><label>Mật khẩu hiện tại<input name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy}/></label><label>{recovery ? "Mã khôi phục còn dùng được" : "Mã từ ứng dụng hiện tại"}<input key={String(recovery)} name="code" required maxLength={recovery ? 35 : 6} autoComplete="off" disabled={busy}/></label>{error && <p className="auth-error" role="alert">{error}</p>}<button type="button" className="password-visibility" onClick={() => setRecovery(!recovery)} disabled={busy}>{recovery ? "Dùng mã ứng dụng" : "Dùng mã khôi phục"}</button><button className="owner-primary" disabled={busy}>Thiết lập thiết bị mới</button><button type="button" className="owner-secondary" onClick={() => setOpen(false)} disabled={busy}>Hủy</button></form> : <button type="button" className="owner-secondary" onClick={() => { setOpen(true); setError(""); setNotice(""); }}>Đổi thiết bị / Tạo mã khôi phục mới</button>}</div>;
}
