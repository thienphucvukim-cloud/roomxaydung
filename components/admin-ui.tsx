"use client";
import { FileSearch, LoaderCircle, RefreshCw } from "lucide-react";

export function ReloadButton({ loading = false, onClick }: { loading?: boolean; onClick: () => void }) {
  return <button type="button" className="admin-button secondary" onClick={onClick} disabled={loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""}/><span>Làm mới</span></button>;
}
export function AdminLoading() { return <div className="admin-empty" role="status"><LoaderCircle size={25} className="animate-spin"/><strong>Đang tải dữ liệu...</strong></div>; }
export function AdminEmpty({ title = "Chưa có dữ liệu", description = "Nội dung mới sẽ xuất hiện tại đây." }: { title?: string; description?: string }) { return <div className="admin-empty"><span className="admin-empty-icon"><FileSearch size={28}/></span><strong>{title}</strong><p>{description}</p></div>; }
export function AdminError({ error }: { error: string }) { return error ? <p className="admin-alert error" role="alert">{error}</p> : null; }
export function StatusBadge({ status, label }: { status: string; label: string }) { return <span className={`admin-badge status-${status}`}><i/>{label}</span>; }
