"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import qrcode from "qrcode-generator";
import { Download, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import type { AuthResult } from "@/components/email-code-form";

export type TotpChallengeResult = { requiresCode: true; method: "totp"; challengeId: string; expiresAt: number; setupRequired: boolean; setupSecret?: string; setupUri?: string };
export type TotpResult = AuthResult & { recoveryCodes?: string[]; deviceChanged?: boolean };
function SetupQr({ uri }: { uri: string }) {
  const qr = useMemo(() => { const value = qrcode(0, "M"); value.addData(uri); value.make(); return value; }, [uri]);
  const size = qr.getModuleCount();
  let path = "";
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) if (qr.isDark(row, column)) path += `M${column + 4} ${row + 4}h1v1h-1z`;
  return <svg className="totp-qr" role="img" aria-label="Mã QR thiết lập ứng dụng xác thực" viewBox={`0 0 ${size + 8} ${size + 8}`} shapeRendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d={path} fill="#111827"/></svg>;
}
export function TotpCodeForm({ challenge, onVerified, onRestart, account = false }: { challenge: TotpChallengeResult; onVerified: (result: TotpResult) => void; onRestart: () => void; account?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [recovery, setRecovery] = useState(false), [expired, setExpired] = useState(false);
  const [result, setResult] = useState<TotpResult | null>(null), [saved, setSaved] = useState(false);
  useEffect(() => {
    const refresh = () => setExpired(Date.now() >= challenge.expiresAt);
    const start = window.setTimeout(refresh, 0), timer = window.setInterval(refresh, 1000);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [challenge.expiresAt]);
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/totp-verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: challenge.challengeId, code: form.get("code"), recovery }) });
      const data = await response.json() as TotpResult;
      if (!response.ok || !data.ok) throw new Error(data.error || "Chưa thể xác thực.");
      if (data.recoveryCodes) setResult(data); else onVerified(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối."); }
    finally { setBusy(false); }
  }
  function download() {
    const text = "NhàĐẹpChất — mã khôi phục quản trị\nMỗi mã chỉ dùng một lần. Giữ riêng khỏi điện thoại xác thực.\n\n" + result!.recoveryCodes!.join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "nhadepchat-ma-khoi-phuc.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (result?.recoveryCodes) return <div className="totp-recovery-codes"><p className="email-code-notice"><ShieldCheck size={20}/><span>Đã bật xác thực hai bước. Lưu các mã dưới đây trước khi tiếp tục.</span></p><p className="email-code-help">Mỗi mã chỉ dùng một lần để đăng nhập khi mất điện thoại hoặc đặt lại mật khẩu. Hệ thống không hiển thị lại bộ mã này.</p><ul>{result.recoveryCodes.map(code => <li key={code}><code>{code}</code></li>)}</ul><button type="button" className="owner-secondary" onClick={download}><Download size={16}/>Tải mã khôi phục</button><label className="totp-saved"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)}/>Tôi đã lưu mã ở nơi an toàn</label><button type="button" className={account ? "owner-primary" : "auth-submit"} disabled={!saved} onClick={() => onVerified(result)}>Tiếp tục</button></div>;
  return <div className={account ? "totp-verification in-account" : "totp-verification"}>
    <p className="email-code-notice"><Smartphone size={20}/><span>{challenge.setupRequired ? "Thêm NhàĐẹpChất vào ứng dụng xác thực trên điện thoại, sau đó nhập mã để hoàn tất." : recovery ? "Nhập một mã khôi phục đã lưu. Mã sẽ hết hiệu lực sau khi sử dụng." : "Mở ứng dụng xác thực và nhập mã NhàĐẹpChất đang hiển thị. Không cần nhận email."}</span></p>
    {challenge.setupRequired && challenge.setupUri && <div className="totp-setup"><SetupQr uri={challenge.setupUri}/><details><summary>Không quét được QR? Nhập khóa thủ công</summary><code className="totp-secret">{challenge.setupSecret}</code><p className="email-code-help">Loại mã: theo thời gian, 6 chữ số, chu kỳ 30 giây.</p></details><p className="email-code-help">Giữ riêng mã QR và khóa này. Chỉ quét bằng ứng dụng xác thực trên thiết bị của bạn.</p></div>}
    <form className={account ? "owner-edit-form" : "auth-form"} onSubmit={verify}>
      <label>{recovery ? "Mã khôi phục" : "Mã xác thực 6 chữ số"}<input key={String(recovery)} name="code" className={recovery ? "totp-backup-input" : "email-code-input"} autoFocus required autoComplete={recovery ? "off" : "one-time-code"} inputMode={recovery ? "text" : "numeric"} pattern={recovery ? "[A-Fa-f0-9-]{32,35}" : "[0-9]{6}"} maxLength={recovery ? 35 : 6} minLength={recovery ? 32 : 6} placeholder={recovery ? "XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" : "000000"} disabled={busy || expired}/></label>
      {(error || expired) && <p className="auth-error" role="alert">{expired ? "Yêu cầu đã hết hạn. Hãy quay lại và đăng nhập lại." : error}</p>}
      <button className={account ? "owner-primary" : "auth-submit"} disabled={busy || expired}>{busy ? <LoaderCircle size={17} className="animate-spin"/> : <ShieldCheck size={17}/>}Xác nhận</button>
    </form>
    <div className="email-code-actions">{!challenge.setupRequired && <button type="button" disabled={busy} onClick={() => { setRecovery(!recovery); setError(""); }}>{recovery ? "Dùng ứng dụng xác thực" : "Mất điện thoại? Dùng mã khôi phục"}</button>}<button type="button" onClick={onRestart} disabled={busy}>Quay lại</button></div>
  </div>;
}
