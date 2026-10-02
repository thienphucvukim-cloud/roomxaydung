"use client";
import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { EmailCodeForm, type AuthResult, type EmailChallengeResult } from "@/components/email-code-form";
import { TotpCodeForm, type TotpChallengeResult } from "@/components/totp-code-form";

export function PasswordChange({ admin = false }: { admin?: boolean }) {
  const [challenge, setChallenge] = useState<EmailChallengeResult | TotpChallengeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function complete() { setChallenge(null); setNotice("Đã đổi mật khẩu. Các phiên đăng nhập khác đã được đăng xuất."); setError(""); }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget; const form = new FormData(element);
    setNotice(""); setError("");
    if (form.get("newPassword") !== form.get("confirmPassword")) { setError("Mật khẩu mới và xác nhận chưa khớp."); return; }
    if (form.get("password") === form.get("newPassword")) { setError("Chọn mật khẩu mới khác với mật khẩu hiện tại."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: form.get("password"), newPassword: form.get("newPassword") }) });
      const result = await response.json() as AuthResult & Partial<EmailChallengeResult | TotpChallengeResult>;
      if (!response.ok) throw new Error(result.error || "Chưa thể đổi mật khẩu.");
      element.reset();
      if (result.requiresCode) setChallenge(result as EmailChallengeResult | TotpChallengeResult); else complete();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể đổi mật khẩu."); }
    finally { setBusy(false); }
  }
  return <div className="password-change">
    <p className="email-code-help">{admin ? "Nhập mật khẩu hiện tại và xác nhận bằng ứng dụng xác thực hoặc mã khôi phục. Mật khẩu chỉ đổi sau khi xác nhận mã." : "Dùng mật khẩu từ 6 đến 128 ký tự. Đổi mật khẩu sẽ đăng xuất các phiên khác."}</p>
    {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="admin-alert success" role="status">{notice}</p>}
    {challenge ? ("method" in challenge && challenge.method === "totp" ? <TotpCodeForm challenge={challenge} onVerified={complete} onRestart={() => setChallenge(null)} account/> : <EmailCodeForm challenge={challenge as EmailChallengeResult} onChallenge={setChallenge} onVerified={complete} onRestart={() => setChallenge(null)} account/>) : <form onSubmit={changePassword} className="owner-edit-form mt-4" method="post" action="/api/auth/password">
      <label>Mật khẩu hiện tại<input name="password" type={visible ? "text" : "password"} required autoComplete="current-password" maxLength={128} disabled={busy}/></label>
      <label>Mật khẩu mới<input name="newPassword" type={visible ? "text" : "password"} required minLength={admin ? 10 : 6} maxLength={128} autoComplete="new-password" disabled={busy}/></label>
      <label>Xác nhận mật khẩu mới<input name="confirmPassword" type={visible ? "text" : "password"} required minLength={admin ? 10 : 6} maxLength={128} autoComplete="new-password" disabled={busy}/></label>
      <button className="password-visibility" type="button" onClick={() => setVisible(!visible)} aria-pressed={visible}>{visible ? <EyeOff size={15}/> : <Eye size={15}/>} {visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}</button>
      <button className="owner-primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="animate-spin"/> : admin ? <LockKeyhole size={16}/> : <Check size={16}/>} {admin ? "Tiếp tục xác thực" : "Đổi mật khẩu"}</button>
    </form>}
  </div>;
}
