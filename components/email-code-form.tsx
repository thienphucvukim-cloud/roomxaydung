"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, LoaderCircle, Mail, RefreshCw, ShieldCheck } from "lucide-react";

export type EmailChallengeResult = { requiresCode: true; challengeId: string; emailMasked: string; expiresAt: number; resendAfter: number };
export type AuthResult = { error?: string; ok?: boolean; redirectTo?: string; passwordChanged?: boolean };
export function EmailCodeForm({ challenge, onChallenge, onVerified, onRestart, account = false }: {
  challenge: EmailChallengeResult; onChallenge: (next: EmailChallengeResult) => void;
  onVerified: (result: AuthResult) => void; onRestart: () => void; account?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(challenge.resendAfter);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const sentAt = Date.now();
    const refresh = () => { setRemaining(Math.max(0, challenge.resendAfter - Math.floor((Date.now() - sentAt) / 1000))); setExpired(Date.now() >= challenge.expiresAt); };
    const start = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 1000);
    return () => { window.clearTimeout(start); window.clearInterval(timer); };
  }, [challenge]);
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") || "").trim();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: challenge.challengeId, code }) });
      const data = await response.json() as AuthResult;
      if (!response.ok || !data.ok) throw new Error(data.error || "Chưa thể xác nhận mã.");
      onVerified(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: challenge.challengeId }) });
      const data = await response.json() as EmailChallengeResult & AuthResult;
      if (!response.ok || !data.requiresCode) throw new Error(data.error || "Chưa gửi được mã mới.");
      onChallenge(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối."); }
    finally { setBusy(false); }
  }
  return <div className={`email-verification ${account ? "in-account" : ""}`}>
    <p className="email-code-notice" role="status"><Mail size={18}/><span>Mã xác nhận đã được gửi tới <strong>{challenge.emailMasked}</strong>. Kiểm tra cả mục thư rác.</span></p>
    <form className={account ? "owner-edit-form" : "auth-form"} onSubmit={verify} method="post" action="/api/auth/verify">
      <input type="hidden" name="challengeId" value={challenge.challengeId}/>
      <label>Mã xác nhận 6 chữ số<div className={account ? "" : "auth-input"}><input name="code" className="email-code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} required autoFocus placeholder="000000" disabled={busy || expired}/></div></label>
      <p className="email-code-help">Mã dùng một lần và có hiệu lực 10 phút. Không chia sẻ mã với người khác.</p>
      {(error || expired) && <p className="auth-error" role="alert">{expired ? "Mã đã hết hạn. Vui lòng quay lại và yêu cầu mã mới." : error}</p>}
      <button className={account ? "owner-primary" : "auth-submit"} disabled={busy || expired}>{busy ? <LoaderCircle size={17} className="animate-spin"/> : <ShieldCheck size={17}/>}Xác nhận</button>
    </form>
    <div className="email-code-actions"><button type="button" onClick={() => void resend()} disabled={busy || remaining > 0 || expired}><RefreshCw size={14}/>{remaining ? `Gửi lại sau ${remaining}s` : "Gửi lại mã"}</button><button type="button" onClick={onRestart} disabled={busy}><ArrowLeft size={14}/>Quay lại</button></div>
  </div>;
}
