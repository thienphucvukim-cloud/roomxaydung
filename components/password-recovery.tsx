"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, RefreshCw } from "lucide-react";
import type { EmailChallengeResult } from "@/components/email-code-form";

type RecoveryResult = EmailChallengeResult & { message: string };
export function PasswordRecovery() {
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<RecoveryResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [expired, setExpired] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setReady(true), 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    if (!challenge) return;
    const sentAt = Date.now();
    const refresh = () => { setRemaining(Math.max(0, challenge.resendAfter - Math.floor((Date.now() - sentAt) / 1000))); setExpired(Date.now() >= challenge.expiresAt); };
    const timer = window.setInterval(refresh, 1000); const start = window.setTimeout(refresh, 0);
    return () => { window.clearInterval(timer); window.clearTimeout(start); };
  }, [challenge]);
  async function requestCode(value = email) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: value }) });
      const result = await response.json() as RecoveryResult & { error?: string };
      if (!response.ok || !result.requiresCode) throw new Error(result.error || "Chưa thể yêu cầu mã khôi phục.");
      setEmail(value.trim()); setChallenge(result); setRemaining(result.resendAfter); setExpired(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestCode(String(new FormData(event.currentTarget).get("email") || ""));
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget; const form = new FormData(element);
    setError("");
    if (form.get("newPassword") !== form.get("confirmPassword")) { setError("Mật khẩu mới và xác nhận chưa khớp."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: challenge?.challengeId, code: String(form.get("code") || "").trim(), newPassword: form.get("newPassword") }) });
      const result = await response.json() as { ok?: boolean; passwordReset?: boolean; error?: string };
      if (!response.ok || !result.passwordReset) throw new Error(result.error || "Chưa thể đặt lại mật khẩu.");
      element.reset(); setChallenge(null); setComplete(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  if (complete) return <div className="password-recovery-success"><p className="email-code-notice" role="status"><Check size={20}/><span>Đã đặt mật khẩu mới và đăng xuất mọi phiên cũ. Hãy đăng nhập lại. Tài khoản quản lý vẫn cần mã email khi đăng nhập.</span></p><a className="auth-submit" href="/dang-nhap">Về đăng nhập<ArrowRight size={17}/></a></div>;
  return <div className="password-recovery">
    {challenge ? <>
      <p className="email-code-notice" role="status"><Mail size={18}/><span>{challenge.message}</span></p>
      <form className="auth-form" onSubmit={reset} method="post" action="/api/auth/reset" data-ready={ready}>
        <input name="challengeId" type="hidden" value={challenge.challengeId}/>
        <label>Mã xác nhận 6 chữ số<div className="auth-input"><input className="email-code-input" name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" autoFocus disabled={busy || expired}/></div></label>
        <label>Mật khẩu mới<div className="auth-input"><LockKeyhole size={18}/><input name="newPassword" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={10} maxLength={128} placeholder="Ít nhất 10 ký tự" disabled={busy || expired}/><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={visible}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        <label>Xác nhận mật khẩu mới<div className="auth-input"><LockKeyhole size={18}/><input name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={10} maxLength={128} disabled={busy || expired}/></div></label>
        <p className="email-code-help">Mã có hiệu lực 10 phút. Mật khẩu chỉ đổi khi mã hợp lệ; mọi phiên cũ sẽ bị đăng xuất.</p>
        {(error || expired) && <p className="auth-error" role="alert">{expired ? "Mã đã hết hạn. Vui lòng quay lại để yêu cầu mã mới." : error}</p>}
        <button className="auth-submit" disabled={busy || expired || !ready}>{busy ? <LoaderCircle size={17} className="animate-spin"/> : <LockKeyhole size={17}/>}Đặt mật khẩu mới</button>
      </form>
      <div className="email-code-actions"><button type="button" onClick={() => void requestCode()} disabled={busy || remaining > 0 || expired}><RefreshCw size={14}/>{remaining ? `Gửi lại sau ${remaining}s` : "Gửi lại mã"}</button><button type="button" onClick={() => { setChallenge(null); setError(""); }} disabled={busy}><ArrowLeft size={14}/>Đổi email</button></div>
    </> : <form className="auth-form" onSubmit={request} method="post" action="/api/auth/forgot" data-ready={ready}>
      <label>Email đã đăng ký<div className="auth-input"><Mail size={18}/><input name="email" type="email" required autoComplete="email" maxLength={254} defaultValue={email} placeholder="Email tài khoản của bạn" disabled={busy}/></div></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" disabled={busy || !ready}>{busy ? <LoaderCircle size={17} className="animate-spin"/> : <Mail size={17}/>}Gửi mã khôi phục</button>
    </form>}
    <p className="auth-recovery">Bạn cần truy cập được hộp thư đã đăng ký. Nếu mất quyền truy cập email, hãy liên hệ người vận hành website để xác minh tài khoản.</p>
  </div>;
}
