"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

type SearchResult = { title: string; copy: string; href: string; type: string };

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const normalized = initial.trim().toLocaleLowerCase("vi");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(Boolean(normalized));
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (normalized) {
      fetch("/api/search?q=" + encodeURIComponent(initial), { signal: controller.signal })
        .then(async response => {
          if (!response.ok) throw new Error("Chưa thể tìm kiếm. Vui lòng thử lại.");
          return response.json() as Promise<{ results: SearchResult[]; warning?: string }>;
        }).then(data => { setResults(data.results); setError(data.warning || ""); })
        .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tìm kiếm."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [initial, normalized, refresh]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    setLoading(Boolean(value));
    setError("");
    if (value === initial.trim()) setRefresh(current => current + 1);
    router.push(value ? "/tim-kiem?q=" + encodeURIComponent(value) : "/tim-kiem");
  };

  return <main className="mx-auto min-h-[calc(100vh-72px)] max-w-4xl px-4 py-8 lg:px-8">
    <h1 className="text-3xl font-extrabold tracking-[-.03em] text-[#0b2e59]">Tìm kiếm</h1>
    <form onSubmit={submit} className="relative mt-5"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#667085]"/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="h-13 w-full rounded-2xl border border-[#dce5ef] bg-white pl-12 pr-4 text-base outline-none focus:border-[#229ed9]" placeholder="Tìm mẫu nhà, bản vẽ, cẩm nang hoặc dịch vụ..."/></form>
    {!normalized && <div className="mt-8 rounded-2xl border border-dashed border-[#b8c5d3] bg-white p-10 text-center text-[#667085]">Nhập từ khóa để tìm trong toàn bộ danh mục.</div>}
    {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
    {normalized && <div className="mt-7"><p role="status" className="mb-3 text-sm font-semibold text-[#667085]">{loading ? "Đang tìm kiếm..." : `${results.length} kết quả cho “${initial}”`}</p><div className="space-y-3">{results.map((item, index) => <a key={`${item.href}:${index}`} href={item.href} className="block rounded-2xl border border-[#e3eaf2] bg-white p-5 transition hover:border-[#7bc8ea]"><span className="text-xs font-bold uppercase tracking-wide text-[#229ed9]">{item.type}</span><h2 className="mt-1 text-lg font-bold text-[#0b2e59]">{item.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#536273]">{item.copy}</p></a>)}</div>{!loading && !results.length && <div className="rounded-2xl bg-white p-10 text-center text-[#667085]">Không tìm thấy kết quả phù hợp.</div>}</div>}
  </main>;
}

export default function SearchPage() {
  return <Suspense fallback={<div className="p-10 text-center">Đang tải...</div>}><SearchEntry/></Suspense>;
}

function SearchEntry() {
  const params = useSearchParams();
  return <SearchContent key={params.get("q") || ""}/>;
}
