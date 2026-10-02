"use client";
import { useRef, useState, type FormEvent } from "react";
import type { AdminMember } from "@/lib/admin-types";

export function AdminMemberModeration({ member, action, onClose, onComplete }: { member: AdminMember; action: "disable" | "enable" | "delete"; onClose: () => void; onComplete: (notice: string) => void }) {
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState("");
  const label = action === "delete" ? "Xóa tài khoản" : action === "enable" ? "Mở lại tài khoản" : "Vô hiệu hóa tài khoản";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const fields = new FormData(event.currentTarget);
    sending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/member-moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: member.userId, action, reason: fields.get("reason"), version: member.moderationVersion }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Chưa thể xử lý tài khoản.");
      onComplete(action === "enable" ? "Đã mở lại tài khoản. Bài đăng bị ẩn cần được duyệt riêng trước khi hiển thị lại." : action === "delete" ? "Đã xóa tài khoản khỏi danh sách hoạt động, chặn truy cập và ẩn bài đăng công khai." : "Đã vô hiệu hóa tài khoản, đăng xuất các phiên và ẩn bài đăng công khai.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể xử lý tài khoản."); }
    finally { sending.current = false; setBusy(false); }
  }
  return <section className="owner-record-detail" aria-label={label}>
    <h3>{label}: {member.username || member.email || member.userId}</h3>
    <p className="mt-2 text-sm">Họ tên: <strong>{member.displayName}</strong> · Mã tài khoản: {member.userId}</p>
    <p className="mt-2 text-sm">{action === "enable" ? "Thành viên sẽ được đăng nhập lại. Các bài đăng bị ẩn vẫn cần quản trị kiểm tra." : "Tài khoản sẽ bị chặn đăng nhập, đăng xuất mọi phiên và ẩn hồ sơ cùng bài đăng công khai."}</p>
    {action === "delete" && <p className="mt-2 text-sm">Tài khoản đã xóa không thể mở lại từ đây. Lịch sử giao dịch và xử lý vi phạm được giữ để đối soát.</p>}
    <form className="owner-edit-form mt-3" onSubmit={event => void submit(event)}>
      <label>Lý do xử lý<textarea name="reason" required minLength={5} maxLength={500} rows={3} disabled={busy} placeholder={action === "enable" ? "Ví dụ: Đã kiểm tra và giải quyết khiếu nại." : "Ví dụ: Lừa đảo, đăng nội dung vi phạm chính sách; mã báo cáo #123."}/></label>
      <label className="admin-reset-verification"><input type="checkbox" required disabled={busy}/>Tôi xác nhận xử lý đúng tài khoản thành viên trên.</label>
      {error && <p className="admin-alert error" role="alert">{error}</p>}
      <div className="owner-edit-actions"><button type="button" className="owner-secondary" disabled={busy} onClick={onClose}>Hủy</button><button className={action === "delete" ? "admin-row-button danger" : "owner-primary"} disabled={busy}>{busy ? "Đang xử lý..." : label}</button></div>
    </form>
  </section>;
}
