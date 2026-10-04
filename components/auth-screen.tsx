"use client";

import { SITE_EVENTS } from "@/lib/site-events";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeAuthReturn } from "@/lib/auth-return";
import Image from "next/image";
import { ClientNavigationLink as Link } from "@/components/client-navigation-link";
import { EditableImage } from "@/components/site-editor";
import { EmailCodeForm, type AuthResult, type EmailChallengeResult } from "@/components/email-code-form";
import { PasswordRecovery } from "@/components/password-recovery";
import { AdminPasswordRecovery } from "@/components/admin-password-recovery";
import { TotpCodeForm, type TotpChallengeResult } from "@/components/totp-code-form";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Eye, EyeOff, Fingerprint, House, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound, UsersRound } from "lucide-react";

export function AuthScreen({ register = false, admin = false, recovery = false, addingAccount = false, returnTo = "/tai-khoan", notice = "" }: { register?: boolean; admin?: boolean; recovery?: boolean; addingAccount?: boolean; returnTo?: string; notice?: string }) {
  const router = useRouter();
  const completeAuth = (data: AuthResult) => {
    window.dispatchEvent(new Event(SITE_EVENTS.avatarChanged));
    router.replace(safeAuthReturn(data.redirectTo, returnTo));
  };
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setReady(true), 0); return () => window.clearTimeout(timer); }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice);
  const [challenge, setChallenge] = useState<EmailChallengeResult | TotpChallengeResult | null>(null);
  const loginPath = admin ? "/admin" : "/dang-nhap";
  const accountQuery = `?return_to=${encodeURIComponent(returnTo)}${addingAccount ? "&add_account=1" : ""}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${register ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), username: form.get("username"), login: form.get("login"), password: form.get("password"), name: form.get("name"), role: admin ? "admin" : "member", returnTo }) });
      const data = await response.json() as AuthResult & Partial<EmailChallengeResult | TotpChallengeResult>;
      if (!response.ok) throw new Error(data.error || "Chưa thể đăng nhập.");
      if (data.requiresCode) { formElement.reset(); setChallenge(data as EmailChallengeResult | TotpChallengeResult); setBusy(false); return; }
      completeAuth(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối. Vui lòng thử lại."); setBusy(false); }
  }
  return <main className="auth-page">
    <section className="auth-story" aria-label="Giới thiệu NhàĐẹpChất">
      <Image src="/auth-future-architecture-v4.png" alt="" fill sizes="(max-width: 900px) 1px, 50vw" className="auth-story-image" priority aria-hidden="true"/>
      <div className="auth-story-shade" aria-hidden="true"/>
      <Link href="/" className="auth-brand"><span className="auth-brand-mark"><EditableImage contentKey="global.logo" src="/nhadepchat-symbol.png?v=4" alt="" width={72} height={36}/></span><span className="auth-brand-name"><strong>NhàĐẹpChất<span>.</span></strong><small>{admin ? "Không gian quản trị" : "Cộng đồng xây nhà"}</small></span></Link>
      <div className="auth-story-content"><span className="auth-eyebrow"><span/>{admin ? "CÙNG PHÁT TRIỂN CỘNG ĐỒNG" : "MỘT Ý TƯỞNG. MỘT TỔ ẤM."}</span>
        <h1>{admin ? <>Quản lý hiệu quả.<br/><em>Phát triển mỗi ngày.</em></> : <>Ý tưởng hôm nay.<br/><em>Tổ ấm ngày mai.</em></>}</h1>
        <p>{admin ? "Không gian của bạn để quản lý nội dung, kết nối thành viên và phát triển cộng đồng NhàĐẹpChất." : "Tìm cảm hứng, lưu ý tưởng và kết nối với những người cùng bạn biến ngôi nhà mơ ước thành hiện thực."}</p>
        <Link href="/kho-mau-nha-dep-chat" className="auth-story-explore">Khám phá không gian sống<ArrowUpRight size={18} aria-hidden="true"/></Link>
        <div className="auth-story-benefits"><span><House size={17} aria-hidden="true"/>Cảm hứng thiết kế</span><span><Bookmark size={17} aria-hidden="true"/>Lưu điều yêu thích</span><span><UsersRound size={17} aria-hidden="true"/>Kết nối cộng đồng</span></div>
      </div><p className="auth-story-footer"><span>Được tạo nên từ những ý tưởng đẹp.</span><span>NhàĐẹpChất © {new Date().getFullYear()}</span></p>
    </section>
    <section className="auth-form-side" aria-labelledby="auth-title"><div className="auth-form-top"><Link href="/" className="auth-mobile-brand" aria-label="NhàĐẹpChất — Trang chủ"><EditableImage contentKey="global.logo" src="/nhadepchat-symbol.png?v=4" alt="" width={52} height={26}/><span>NhàĐẹpChất<span>.</span></span></Link><Link href="/" className="auth-back"><ArrowLeft size={16} aria-hidden="true"/>Về trang chủ</Link></div>
      <div className="auth-form-wrap"><div className="auth-form-symbol" aria-hidden="true">{admin ? <ShieldCheck size={27}/> : recovery ? <LockKeyhole size={27}/> : <Fingerprint size={29}/>}</div>
        <p className="auth-form-eyebrow">{admin ? "KHÔNG GIAN QUẢN TRỊ" : "KHÔNG GIAN CỦA BẠN"}</p>
        <h2 id="auth-title">{recovery ? "Khôi phục mật khẩu" : challenge ? "Xác nhận đăng nhập" : register ? "Bắt đầu hành trình mới." : addingAccount ? "Thêm tài khoản" : admin ? "Đăng nhập quản trị" : "Chào mừng trở lại."}</h2><p className="auth-form-description">{recovery ? admin ? "Dùng mã khôi phục đã lưu để đặt mật khẩu mới." : "Nhập email đã đăng ký để lấy lại quyền truy cập tài khoản." : challenge ? "Xác nhận danh tính để tiếp tục vào tài khoản của bạn." : register ? "Tạo tài khoản miễn phí. Cùng xây nên tổ ấm của bạn." : addingAccount ? "Đăng nhập tài khoản khác để chuyển đổi nhanh trên trình duyệt này." : admin ? "Mọi thứ bạn cần để quản lý website, ở một nơi." : "Những ý tưởng cho tổ ấm vẫn đang chờ bạn."}</p>
        {!admin && !recovery && !challenge && <nav className="auth-mode" aria-label="Tài khoản"><Link href={`/dang-nhap${accountQuery}`} aria-current={!register ? "page" : undefined}>Đăng nhập</Link><Link href={`/dang-ky${accountQuery}`} aria-current={register ? "page" : undefined}>Đăng ký</Link></nav>}
        {!admin && !recovery && !challenge && <div className="auth-google-wrap">
          <a className="auth-google" href={`/api/auth/google?return_to=${encodeURIComponent(returnTo)}`} aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M43.6 20.5H24v7.9h11.3c-.5 2.6-2 4.8-4.2 6.2v5.2h6.8c4-3.7 6.3-9.1 6.3-15.5 0-1.3-.1-2.6-.4-3.8z"/>
              <path fill="#34A853" d="M24 44c5.7 0 10.5-1.9 14-5.2l-6.8-5.2c-1.9 1.3-4.3 2-7.2 2-5.5 0-10.2-3.7-11.8-8.6h-7v5.4C8.7 39.3 15.8 44 24 44z"/>
              <path fill="#FBBC05" d="M12.2 27a12 12 0 0 1 0-6v-5.4h-7a20 20 0 0 0 0 16.8l7-5.4z"/>
              <path fill="#EA4335" d="M24 12.4c3.1 0 5.8 1.1 7.9 3.1l5.9-5.9C34.2 6.1 29.5 4 24 4 15.8 4 8.7 8.7 5.2 15.6l7 5.4c1.6-4.9 6.3-8.6 11.8-8.6z"/>
            </svg>
            {register ? "Đăng ký bằng Google" : "Đăng nhập bằng Google"}
          </a>
          <p className="auth-divider"><span>hoặc dùng tài khoản của bạn</span></p>
        </div>}
        {recovery ? (admin ? <AdminPasswordRecovery onBack={() => window.location.assign(loginPath)}/> : <PasswordRecovery/>) : challenge ? ("method" in challenge && challenge.method === "totp" ? <TotpCodeForm challenge={challenge} onVerified={completeAuth} onRestart={() => { setChallenge(null); setError(""); }}/> : <EmailCodeForm challenge={challenge as EmailChallengeResult} onChallenge={setChallenge} onVerified={completeAuth} onRestart={() => { setChallenge(null); setError(""); }}/>) : <form onSubmit={submit} className="auth-form" data-ready={ready} aria-busy={busy} method="post" action={`/api/auth/${register ? "register" : "login"}`}>
          {register && <div className="auth-field"><label htmlFor="auth-name">Họ và tên</label><div className="auth-input"><UserRound size={18} aria-hidden="true"/><input id="auth-name" required name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Nhập họ và tên của bạn" disabled={busy}/></div></div>}
          <div className="auth-field"><label htmlFor="auth-login">{admin ? "Địa chỉ email" : register ? "Tên đăng nhập" : "Tên đăng nhập hoặc email"}</label><div className="auth-input">{admin ? <Mail size={18} aria-hidden="true"/> : <UserRound size={18} aria-hidden="true"/>}<input id="auth-login" required name={admin ? "email" : register ? "username" : "login"} type={admin ? "email" : "text"} autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={register ? 3 : 1} maxLength={register ? 32 : 254} pattern={register ? "[a-zA-Z0-9][a-zA-Z0-9._\\-]{2,31}" : undefined} title={register ? "Từ 3 đến 32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang." : undefined} aria-describedby={register ? "auth-username-help" : undefined} placeholder={admin ? "Email quản trị của bạn" : register ? "Ví dụ: nguyen_van_an" : "Nhập tên đăng nhập hoặc email"} disabled={busy}/></div>{register && <span id="auth-username-help" className="auth-input-help">Không cần email. Dùng 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.</span>}</div>
          <div className="auth-field"><div className="auth-password-header"><label htmlFor="auth-password">Mật khẩu</label>{!register && <a href={admin ? "/admin?recovery=1" : "/quen-mat-khau"}>Quên mật khẩu?</a>}</div><div className="auth-input"><LockKeyhole size={18} aria-hidden="true"/><input id="auth-password" required name="password" type={visible ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} minLength={register ? 6 : 1} maxLength={128} placeholder={register ? "Tạo mật khẩu ít nhất 6 ký tự" : "Nhập mật khẩu của bạn"} disabled={busy}/><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={visible} aria-controls="auth-password" disabled={busy}>{visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}</button></div></div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy || !ready}>{busy ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true"/>Đang xử lý...</> : <>{register ? "Tạo tài khoản miễn phí" : "Đăng nhập"}<ArrowRight size={18} aria-hidden="true"/></>}</button>
        </form>}
        <p className="auth-switch">{recovery ? <a href={loginPath}>Quay lại đăng nhập</a> : admin ? "Dành riêng cho tài khoản được cấp quyền quản trị." : challenge ? null : register ? <>Đã có tài khoản? <Link href={`/dang-nhap${accountQuery}`}>Đăng nhập</Link></> : <>Chưa có tài khoản? <Link href={`/dang-ky${accountQuery}`}>Đăng ký miễn phí<ArrowUpRight size={14} aria-hidden="true"/></Link></>}</p>
        <div className="auth-security"><ShieldCheck size={16} aria-hidden="true"/><span>An tâm kết nối. Riêng tư được bảo vệ.</span></div>
      </div><footer className="auth-form-footer"><span>© {new Date().getFullYear()} NhàĐẹpChất</span><a href="/privacy">Chính sách bảo mật<ArrowUpRight size={12} aria-hidden="true"/></a></footer>
    </section>
  </main>;
}
