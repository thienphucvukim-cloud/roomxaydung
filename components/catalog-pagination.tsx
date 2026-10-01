"use client";

import { ClientNavigationLink } from "@/components/client-navigation-link";
import { catalogPageHref } from "@/lib/catalog-pagination";

export function CatalogPagination({ basePath, page, totalPages, total, query, label }: {
  basePath: string; page: number; totalPages: number; total: number; query: string; label: string;
}) {
  const numbers = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter(number => number >= 1 && number <= totalPages).sort((a, b) => a - b);
  const href = (number: number) => catalogPageHref(basePath, number, query);

  return <nav aria-label={`Phân trang ${label}`} className="mt-6 flex flex-wrap items-center justify-center gap-2">
    {page > 1 && <ClientNavigationLink href={href(page - 1)} rel="prev" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Trước</ClientNavigationLink>}
    {numbers.map((number, index) => <span key={number} className="flex items-center gap-2">
      {index > 0 && number - numbers[index - 1] > 1 && <span aria-hidden="true">…</span>}
      <ClientNavigationLink href={href(number)} aria-label={`Trang ${number}`} aria-current={number === page ? "page" : undefined} className={`grid size-10 place-items-center rounded-lg border text-sm font-bold ${number === page ? "border-[#229ed9] bg-[#229ed9] text-white" : "bg-white text-[#0b2e59] hover:border-[#229ed9]"}`}>{number}</ClientNavigationLink>
    </span>)}
    {page < totalPages && <ClientNavigationLink href={href(page + 1)} rel="next" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Sau</ClientNavigationLink>}
    <p className="w-full text-center text-xs text-[#667085]">Trang {page} / {totalPages} · {total} {label}</p>
  </nav>;
}
