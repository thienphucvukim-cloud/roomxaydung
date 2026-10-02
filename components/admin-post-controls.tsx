"use client";

import { useState } from "react";
import { EyeOff, LoaderCircle, Pencil, Trash2 } from "lucide-react";

export function AdminPostControls({ postId, onEdit }: { postId: number; onEdit: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState(false);

  async function update(deleting: boolean) {
    if (busy) return;
    if (deleting && !window.confirm("Chuyển bài viết này vào thùng rác? Bạn có thể khôi phục lại trong mục Quản lý.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/manage/posts", {
        method: deleting ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId, ...(deleting ? {} : { audience: "Ẩn bởi quản trị" }) }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Chưa thể cập nhật bài viết.");
      setRemoved(true);
      window.dispatchEvent(new Event("tipook-content-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể cập nhật bài viết.");
    } finally {
      setBusy(false);
    }
  }

  return <span className="admin-post-controls" role="group" aria-label="Quản trị bài viết">
    {removed ? <span role="status">Đã gỡ bài viết khỏi nội dung công khai.</span> : <>
      <button type="button" onClick={onEdit} disabled={busy}><Pencil size={14} aria-hidden="true"/>Chỉnh sửa</button>
      <button type="button" onClick={() => void update(false)} disabled={busy}><EyeOff size={14} aria-hidden="true"/>Ẩn</button>
      <button type="button" className="danger" onClick={() => void update(true)} disabled={busy}><Trash2 size={14} aria-hidden="true"/>Xóa</button>
      {busy && <LoaderCircle size={14} className="animate-spin" aria-label="Đang cập nhật"/>}
    </>}
    {error && <span className="admin-post-error" role="alert">{error}</span>}
  </span>;
}
