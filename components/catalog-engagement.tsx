"use client";

import { useEffect, useState } from "react";
import { Eye, Star } from "lucide-react";
import type { CatalogEngagement, CatalogTarget } from "@/lib/catalog-engagement";

const changedEvent = "tipook-catalog-engagement";
type Change = CatalogTarget & { stats: CatalogEngagement };

export async function recordCatalogView(target: CatalogTarget) {
  try {
    const response = await fetch("/api/catalog-engagement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, action: "view" }) });
    if (!response.ok) return;
    const stats = await response.json() as CatalogEngagement;
    window.dispatchEvent(new CustomEvent<Change>(changedEvent, { detail: { ...target, stats } }));
  } catch { /* Opening the gallery still works when statistics are unavailable. */ }
}

export function CatalogEngagementStats({ targetType, targetId, mode, layout = "inline" }: CatalogTarget & { mode: "views" | "rating"; layout?: "inline" | "stacked" | "compact" }) {
  const [stats, setStats] = useState<CatalogEngagement | null>(null);
  const [hovered, setHovered] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog-engagement?" + new URLSearchParams({ targetType, targetId }), { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() as Promise<CatalogEngagement> : Promise.reject())
      .then(setStats).catch(() => {});
    const update = (event: Event) => {
      const change = (event as CustomEvent<Change>).detail;
      if (change.targetType === targetType && change.targetId === targetId) {
        controller.abort();
        setStats(change.stats);
      }
    };
    window.addEventListener(changedEvent, update);
    return () => { controller.abort(); window.removeEventListener(changedEvent, update); };
  }, [targetType, targetId]);

  const rate = async (rating: number) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/catalog-engagement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, action: "rate", rating }) });
      const data = await response.json() as CatalogEngagement & { error?: string };
      if (!response.ok) throw new Error(data.error || "Chưa thể gửi đánh giá.");
      setStats(data);
      window.dispatchEvent(new CustomEvent<Change>(changedEvent, { detail: { targetType, targetId, stats: data } }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Chưa thể gửi đánh giá."); }
    finally { setBusy(false); }
  };

  if (mode === "views") {
    const views = stats ? stats.views.toLocaleString("vi-VN") : "—";
    if (layout === "compact") return <span className="inline-flex items-center gap-1.5 text-xs text-[#667085]" aria-label={`Lượt xem (${views})`} title="Lượt xem · Mỗi người xem được tính một lần khi mở bộ ảnh"><Eye size={15} aria-hidden="true"/><span className="tabular-nums">{views}</span></span>;
    if (layout === "stacked") return <span className="flex flex-col items-center justify-center gap-1 py-2.5 text-[#475467]" aria-label={`Lượt xem (${views})`} title="Lượt xem · Mỗi người xem được tính một lần khi mở bộ ảnh"><Eye size={19} aria-hidden="true"/><span className="text-[11px] leading-4 tabular-nums">{views}</span></span>;
    return <span className="inline-flex items-center gap-1 text-xs text-[#667085]" title="Mỗi người xem được tính một lần khi mở bộ ảnh"><Eye size={14} aria-hidden="true"/>{views} lượt xem</span>;
  }
  return <div className="mt-3 border-t border-[#e8eef5] pt-2">
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <div data-requires-account role="group" aria-label="Đánh giá sao" className="flex" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" disabled={busy} onClick={() => void rate(value)} onMouseEnter={() => setHovered(value)} onFocus={() => setHovered(value)} onBlur={() => setHovered(0)} aria-label={`Đánh giá ${value} sao`} aria-pressed={stats?.myRating === value} title={`Đánh giá ${value} sao`} className="grid size-8 place-items-center rounded text-[#d99016] hover:bg-[#fff7e6] focus-visible:outline-2 focus-visible:outline-[#d99016] disabled:opacity-50"><Star size={18} aria-hidden="true" className={value <= (hovered || stats?.myRating || Math.round(stats?.rating ?? 0)) ? "fill-current" : ""}/></button>)}
      </div>
      <span aria-live="polite" className="text-xs text-[#667085]">{stats ? stats.ratingCount ? `${stats.rating?.toFixed(1)}/5 (${stats.ratingCount})` : "Chưa có đánh giá" : "Đang tải..."}</span>
    </div>
    {stats?.myRating && <p className="mt-1 text-xs text-[#667085]">Bạn đã đánh giá {stats.myRating} sao</p>}
    {error && <p role="alert" className="mt-1 text-xs text-rose-600">{error}</p>}
  </div>;
}
