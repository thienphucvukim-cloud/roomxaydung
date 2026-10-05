"use client";
import { useState } from "react";
import { ArrowDownToLine, LoaderCircle, Undo2 } from "lucide-react";
import { useSiteEditor } from "@/components/site-editor";

export function CatalogQualityButton({ targetType, targetId }: { targetType: "post" | "demo"; targetId: string }) {
  const editor = useSiteEditor();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (!editor.isOwner) return null;
  const flagged = Boolean(editor.qualityFlags[`${targetType}:${targetId}`]);
  async function toggle() {
    if (busy || !editor.qualityReady) return;
    setBusy(true); setError("");
    try { await editor.saveQuality(targetType, targetId, !flagged); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa thể lưu đánh giá ngầm."); }
    finally { setBusy(false); }
  }
  return <span className="admin-post-controls basis-full" role="group" aria-label="Đánh giá ngầm của admin">
    <button type="button" disabled={busy || !editor.qualityReady} onClick={() => void toggle()} aria-pressed={flagged} title={flagged ? "Bỏ đánh dấu để bài trở lại thứ tự bình thường" : "Đánh dấu kém chất lượng; chỉ admin thấy đánh giá này"}>
      {busy || !editor.qualityReady ? <LoaderCircle size={14} className="animate-spin"/> : flagged ? <Undo2 size={14}/> : <ArrowDownToLine size={14}/>}
      {flagged ? "Bỏ đánh giá ngầm" : "Đẩy xuống cuối"}
    </button>
    {flagged && <span className="basis-full text-xs font-normal text-[#667085]" role="status">Kém chất lượng · Chỉ admin thấy</span>}
    {(error || editor.qualityError) && <span className="admin-post-error" role="alert">{error || editor.qualityError}{editor.qualityError && <button type="button" onClick={editor.reloadQuality}>Thử lại</button>}</span>}
  </span>;
}
