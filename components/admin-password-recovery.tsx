"use client";
import { useState, type FormEvent } from "react";
export function AdminPasswordRecovery({ onBack }: { onBack: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false);
  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError("");
    if (form.get("newPassword") !== form.get("confirmPassword")) { setError("Mật khẩu mới và xác nhận chưa khớp."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/admin-recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), code: form.get("code"), newPassword: form.get("newPassword") }) });
      const data = await response.json() as { error?: string; passwordReset?: boolean };
      if (!response.ok || !data.passwordReset) throw new Error(data.error || "Chưa thể khôi phục.");
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối."); } finally { setBusy(false); }
  }
  if (done) return <div><p className="email-code-notice" role="status">Đã đặt mật khẩu mới và đăng xuất mọi phiên cũ. Hãy đăng nhập bằng ứng dụng xác thực hoặc một mã khôi phục khác.</p><a className="auth-submit" href="/admin">Đăng nhập quản trị</a></div>;
  return <div><p className="email-code-notice">Khôi phục quản trị bằng một mã dự phòng đã lưu. Mã dùng một lần; không cần email.</p><form className="auth-form" onSubmit={recover}><label>Email quản trị<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy}/></label><label>Mã khôi phục<input name="code" autoComplete="off" required maxLength={35} minLength={32} disabled={busy}/></label><label>Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={busy}/></label><label>Xác nhận mật khẩu mới<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={busy}/></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-submit" disabled={busy}>Đặt mật khẩu mới</button></form><p className="email-code-help">Nếu mất cả ứng dụng và mã dự phòng, cần người vận hành xác minh và khôi phục trực tiếp. Mật khẩu khởi tạo không bỏ qua được xác thực hai bước.</p><button type="button" className="password-visibility" onClick={onBack} disabled={busy}>Quay lại đăng nhập quản trị</button></div>;
}
