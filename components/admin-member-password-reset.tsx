"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import type { AdminMember } from "@/lib/admin-types";
import { adminDate } from "@/lib/admin-types";

type History = { id: string; performedBy: string; verificationNote: string; createdAt: string };
export function AdminMemberPasswordReset({ member, onClose }: { member: AdminMember; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [visible, setVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [issuedPassword, setIssuedPassword] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [history, setHistory] = useState<History[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/member-password?userId=${encodeURIComponent(member.userId)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json() as { history?: History[]; error?: string }; if (!response.ok || !data.history) throw new Error(data.error || "Chưa thể tải lịch sử."); return data.history; })
      .then(data => { setHistory(data); setHistoryError(""); })
      .catch(cause => { if (!controller.signal.aborted) setHistoryError(cause instanceof Error ? cause.message : "Chưa thể tải lịch sử."); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [member.userId, revision]);
  async function copyPassword(password: string) {
    setCopyNotice("");
    try {
      await navigator.clipboard.writeText(password);
      setCopyNotice("Đã sao chép mật khẩu.");
    } catch {
      setCopyNotice("Chưa thể sao chép tự động. Nhấn Hiện mật khẩu rồi chọn và sao chép trực tiếp trong ô mật khẩu.");
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError(""); setNotice(""); setCopyNotice("");
    if (fields.get("newPassword") !== fields.get("confirmPassword")) { setError("Mật khẩu mới và xác nhận chưa khớp."); return; }
    sending.current = true; setBusy(true);
    try {
      const response = await fetch("/api/admin/member-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        userId: member.userId, verified: fields.get("verified") === "on", verificationNote: fields.get("verificationNote"),
        newPassword: fields.get("newPassword"), adminPassword: fields.get("adminPassword"),
      }) });
      const data = await response.json() as { passwordReset?: boolean; error?: string };
      if (!response.ok || !data.passwordReset) throw new Error(data.error || "Chưa thể đặt lại mật khẩu.");
      setIssuedPassword(String(fields.get("newPassword")));
      setNewPassword("");
      form.reset();
      setNotice("Đã đặt lại mật khẩu và đăng xuất mọi phiên cũ. Hãy chuyển mật khẩu mới qua kênh đã xác minh và hướng dẫn người dùng đổi mật khẩu sau khi đăng nhập.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mất kết nối. Kiểm tra lịch sử hỗ trợ trước khi thử lại."); }
    finally { setHistoryLoading(true); setRevision(value => value + 1); sending.current = false; setBusy(false); }
  }
  return <section className="owner-record-detail" aria-label="Hỗ trợ khôi phục tài khoản">
    <h3>Đặt lại mật khẩu: {member.username || member.email || member.userId}</h3>
    <div className="owner-edit-form mt-3">
      <label>Tên đăng nhập của thành viên<input type="text" value={member.username || "Chưa có tên đăng nhập"} readOnly onFocus={event => event.currentTarget.select()}/></label>
    </div>
    <p className="mt-2 text-sm">Họ và tên: <strong>{member.displayName}</strong> · Email: {member.email || "Chưa có"}</p>
    <p className="mt-1 text-sm">Mã tài khoản: {member.userId}</p>
    <p className="mt-3 text-sm">Chỉ thực hiện sau khi xác minh người yêu cầu là chủ tài khoản qua kênh liên hệ hoặc thông tin đã có từ trước. Ghi cách xác minh và mã yêu cầu hỗ trợ; tránh ghi dữ liệu nhạy cảm.</p>
    <form className="owner-edit-form mt-4" onSubmit={event => void submit(event)}>
      <label>Cách xác minh chủ tài khoản<textarea name="verificationNote" required minLength={10} maxLength={500} rows={3} disabled={busy} placeholder="Ví dụ: Đã gọi lại số liên hệ đã lưu, đối chiếu yêu cầu hỗ trợ #123."/></label>
      <label className="admin-reset-verification"><input name="verified" type="checkbox" required disabled={busy}/>Tôi đã xác minh người yêu cầu là chủ tài khoản này.</label>
      <label>Mật khẩu mới cho thành viên<input name="newPassword" type={visible ? "text" : "password"} value={newPassword} onChange={event => { setNewPassword(event.target.value); setCopyNotice(""); }} required minLength={6} maxLength={128} autoComplete="new-password" placeholder="Ít nhất 6 ký tự" disabled={busy}/></label>
      <label>Xác nhận mật khẩu mới<input name="confirmPassword" type={visible ? "text" : "password"} required minLength={6} maxLength={128} autoComplete="new-password" disabled={busy}/></label>
      <div className="owner-edit-actions">
        <button className="owner-secondary" type="button" onClick={() => setVisible(value => !value)} aria-pressed={visible} disabled={busy}>{visible ? <EyeOff size={15}/> : <Eye size={15}/>} {visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}</button>
        <button className="owner-secondary" type="button" onClick={() => void copyPassword(newPassword)} disabled={busy || !newPassword}><Copy size={15}/>Sao chép mật khẩu</button>
      </div>
      <label>Mật khẩu quản trị để xác nhận<input name="adminPassword" type="password" required maxLength={128} autoComplete="off" disabled={busy}/></label>
      {error && <p className="admin-alert error" role="alert">{error}</p>}
      {notice && <p className="admin-alert success" role="status">{notice}</p>}
      {issuedPassword && <div className="owner-edit-form">
        <label>Mật khẩu đã đặt cho thành viên<input type={visible ? "text" : "password"} value={issuedPassword} readOnly autoComplete="off" onFocus={event => event.currentTarget.select()}/></label>
        <button className="owner-secondary" type="button" onClick={() => void copyPassword(issuedPassword)} disabled={busy}><Copy size={15}/>Sao chép mật khẩu đã đặt</button>
      </div>}
      {copyNotice && <p className="text-sm" role="status">{copyNotice}</p>}
      <div className="owner-edit-actions"><button type="button" className="owner-secondary" disabled={busy} onClick={onClose}>Đóng</button><button className="owner-primary" disabled={busy}>{busy ? "Đang đặt lại..." : "Xác nhận đặt lại mật khẩu"}</button></div>
    </form>
    <h4 className="mt-5 font-semibold">Lịch sử hỗ trợ gần nhất</h4>
    {historyLoading ? <p className="mt-2 text-sm" role="status">Đang tải lịch sử hỗ trợ...</p> : historyError ? <p className="admin-alert error" role="alert">{historyError}</p> : history.length ? <ul className="mt-2 space-y-2 text-sm">{history.map(item => <li key={item.id}><strong>{adminDate(item.createdAt)}</strong> · Quản trị: {item.performedBy}<p className="whitespace-pre-wrap">{item.verificationNote}</p></li>)}</ul> : <p className="mt-2 text-sm">Chưa có lần đặt lại mật khẩu nào được ghi nhận.</p>}
  </section>;
}
