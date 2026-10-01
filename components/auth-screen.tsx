"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { ClientNavigationLink as Link } from "@/components/client-navigation-link";
import { EditableImage } from "@/components/site-editor";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Fingerprint, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";

export function AuthScreen({ register = false, admin = false, returnTo = "/tai-khoan", notice = "" }: { register?: boolean; admin?: boolean; returnTo?: string; notice?: string }) {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setReady(true), 0); return () => window.clearTimeout(timer); }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice);
  const modeQuery = admin ? "?role=admin" : "";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${register ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password"), name: form.get("name"), role: admin ? "admin" : "member", returnTo }) });
      const data = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(data.error || "Chưa thể đăng nhập.");
      window.location.assign(data.redirectTo || returnTo);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kết nối. Vui lòng thử lại."); setBusy(false); }
  }
  return <main className="auth-page">
    <section className="auth-story" aria-label="Giới thiệu Tipook">
      <div className="auth-story-grid"/>
      <Link href="/" className="auth-brand"><EditableImage contentKey="global.logo" src="/tipook-logo.png" alt="Tipook" width={140} height={70}/><span>{admin ? "Website của bạn" : "Cộng đồng xây nhà"}</span></Link>
      <div className="auth-story-content"><span className="auth-eyebrow"><span/>{admin ? "TIPOOK ADMIN" : "MỘT Ý TƯỞNG. MỘT TỔ ẤM."}</span>
        <h1>{admin ? <>Quản lý hiệu quả.<br/><em>Phát triển mỗi ngày.</em></> : <>Ngôi nhà mơ ước<br/>bắt đầu từ <em>đây.</em></>}</h1>
        <p>{admin ? "Một không gian tập trung để quản lý nội dung, chăm sóc cộng đồng và theo dõi mọi giao dịch trên website." : "Lưu mẫu nhà yêu thích, khám phá bản vẽ và kết nối với những người cùng xây dựng tổ ấm."}</p>
        <div className="auth-photo"><Image src="/community-house.png" alt="Kiến trúc nhà hiện đại với không gian xanh" width={760} height={500} className="auth-photo-image" priority/><div className="auth-photo-caption"><span><span className="auth-photo-tag">KHÔNG GIAN SỐNG</span><strong>Cảm hứng cho mỗi tổ ấm</strong></span><span className="auth-photo-arrow"><ArrowRight size={21}/></span></div></div>
        <div className="auth-story-benefits"><span><Check size={16}/>Kết nối cộng đồng</span><span><Check size={16}/>Quản lý thuận tiện</span><span><Check size={16}/>Bảo mật tài khoản</span></div>
      </div><p className="auth-story-footer">Tipook · Cùng bạn xây dựng tổ ấm</p>
    </section>
    <section className="auth-form-side"><Link href="/" className="auth-back"><ArrowLeft size={17}/>Về website</Link>
      <div className="auth-form-wrap"><div className="auth-form-symbol">{admin ? <ShieldCheck size={28}/> : <Fingerprint size={30}/>}</div>
        <p className="auth-form-eyebrow">{admin ? "DÀNH CHO QUẢN TRỊ VIÊN" : "CHÀO MỪNG ĐẾN TIPOOK"}</p>
        <h2>{register ? "Tạo tài khoản của bạn" : admin ? "Đăng nhập quản trị" : "Rất vui được gặp bạn"}</h2><p className="auth-form-description">{register ? "Tham gia cộng đồng và bắt đầu hành trình xây nhà." : admin ? "Đăng nhập để bắt đầu quản lý website của bạn." : "Đăng nhập để tiếp tục khám phá và lưu ý tưởng của bạn."}</p>
        <form onSubmit={submit} className="auth-form" data-ready={ready} method="post" action={`/api/auth/${register ? "register" : "login"}`}>
          {register && <label>Họ và tên<div className="auth-input"><UserRound size={18}/><input required name="name" autoComplete="name" minLength={2} maxLength={80} placeholder="Nhập họ và tên của bạn" disabled={busy}/></div></label>}
          <label>Địa chỉ email<div className="auth-input"><Mail size={18}/><input required name="email" type="email" autoComplete="email" maxLength={254} placeholder={admin ? "Email quản trị của bạn" : "ban@example.com"} disabled={busy}/></div></label>
          <label>Mật khẩu<div className="auth-input"><LockKeyhole size={18}/><input required name="password" type={visible ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} minLength={register ? 10 : 1} maxLength={128} placeholder={register ? "Ít nhất 10 ký tự" : "Nhập mật khẩu của bạn"} disabled={busy}/><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={visible}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy || !ready}>{busy ? <><LoaderCircle size={18} className="animate-spin"/>Đang xử lý...</> : <>{register ? "Tạo tài khoản" : "Đăng nhập"}<ArrowRight size={18}/></>}</button>
        </form>
        <p className="auth-switch">{admin ? "Khu vực này chỉ dành cho tài khoản được cấp quyền quản trị." : register ? <>Đã có tài khoản? <a href={`/dang-nhap?return_to=${encodeURIComponent(returnTo)}`}>Đăng nhập</a></> : <>Chưa có tài khoản? <a href={`/dang-ky?return_to=${encodeURIComponent(returnTo)}`}>Đăng ký miễn phí</a></>}</p>
        {!register && <p className="auth-recovery">Nếu quên mật khẩu, hãy liên hệ quản trị viên để được hỗ trợ.</p>}
        <div className="auth-security"><ShieldCheck size={17}/><span>Thông tin đăng nhập được bảo vệ bằng phiên riêng.</span></div>
        {register && <a className="auth-switch block" href={`/dang-nhap${modeQuery}`}>Quay lại đăng nhập</a>}
      </div><p className="auth-form-footer">© {new Date().getFullYear()} Tipook. Cùng bạn xây nhà.</p>
    </section>
  </main>;
}
