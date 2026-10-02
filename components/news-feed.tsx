"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FileText, Images, LoaderCircle, House, RefreshCw, Sofa } from "lucide-react";
import { NEWS_SOURCES, type NewsFeedResponse } from "@/lib/news-feed";
import { CatalogToolbar } from "@/components/catalog-toolbar";
import { NewsPostComposer } from "@/components/news-post-composer";
import { NewsPostCard } from "@/components/news-post-card";
import { ClientNavigationLink } from "@/components/client-navigation-link";

const sourceIcons = [House, Images, FileText, Sofa];

export function NewsFeed({ postId }: { postId?: number }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const selection = `${postId ?? ""}:${category}:${search}:${page}`;
  const [result, setResult] = useState<{ selection: string; data?: NewsFeedResponse; error?: string }>({ selection: "" });
  const [refreshing, setRefreshing] = useState(false);
  const current = result.selection === selection;
  const data = current ? result.data : undefined;
  const error = current ? result.error : undefined;
  const loading = !current;

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || controller.signal.aborted) return;
      pending = true;
      setRefreshing(true);
      try {
        const params = new URLSearchParams({ page: String(page), category, q: search });
        if (postId) params.set("postId", String(postId));
        const response = await fetch(`/api/news-feed?${params}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as NewsFeedResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Chưa thể tải bảng tin.");
        if (controller.signal.aborted) return;
        if (page > payload.totalPages) { setPage(payload.totalPages); return; }
        setResult({ selection, data: payload });
      } catch (cause) {
        if (!controller.signal.aborted) setResult(previous => ({
          selection,
          data: previous.selection === selection ? previous.data : undefined,
          error: cause instanceof Error ? cause.message : "Chưa thể tải bảng tin. Vui lòng thử lại.",
        }));
      } finally {
        pending = false;
        if (!controller.signal.aborted) setRefreshing(false);
      }
    };
    const update = () => { if (document.visibilityState === "visible") void refresh(); };
    // Queue the initial request; subsequent refreshes keep the current cards visible.
    void Promise.resolve().then(refresh);
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("tipook-content-changed", update);
    window.addEventListener("tipook-avatar-changed", update);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("tipook-content-changed", update);
      window.removeEventListener("tipook-avatar-changed", update);
    };
  }, [category, search, page, selection, revision, postId]);

  const filter = (value: string) => { setCategory(value); setPage(1); };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setSearch(query.trim()); setPage(1); };
  const changePage = (value: number) => { setPage(value); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <div className="min-h-screen bg-[#f0f2f5] text-[#1c1e21]">
    <main className="mx-auto max-w-[1060px] px-4 py-7 sm:py-10 lg:px-8">
      <h1 className="sr-only">Bảng tin</h1>
      <div className={`grid items-start gap-6 ${postId ? "mx-auto max-w-[680px]" : "lg:grid-cols-[240px_minmax(0,680px)]"}`}>
        {!postId && <aside className="rounded-2xl border border-[#e3eaf2] bg-white p-4 lg:sticky lg:top-24">
          <h2 className="px-2 text-sm font-extrabold">Khám phá bảng tin</h2>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col" role="group" aria-label="Lọc bảng tin">
            {[{ category: "", label: "Tất cả", Icon: House }, ...NEWS_SOURCES.map((source, index) => ({ ...source, Icon: sourceIcons[index] }))].map(item =>
              <button key={item.category} type="button" aria-pressed={category === item.category} onClick={() => filter(item.category)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition ${category === item.category ? "bg-[#e8f6fc] text-[#168ac0]" : "text-[#52677f] hover:bg-[#f4f7fb]"}`}><item.Icon size={18} />{item.label}</button>,
            )}
          </div>
          <p className="mt-4 hidden border-t border-[#e3eaf2] px-2 pt-4 text-xs leading-5 text-[#667085]">Bài công khai mới từ các trang sẽ tự xuất hiện tại đây.</p>
        </aside>}

        <section aria-label="Bài đăng mới" className="min-w-0">
          {postId && <ClientNavigationLink href="/" className="text-sm font-semibold text-[#168ac0] hover:underline">Quay lại bảng tin</ClientNavigationLink>}
          {!postId && <CatalogToolbar query={query} onQueryChange={setQuery} onSearch={submitSearch} onClear={() => { setQuery(""); setSearch(""); setPage(1); }} onPublish={() => setComposerOpen(true)} publishLabel="Đăng bài" publishTitle="Đăng bài lên bảng tin" searchLabel="Tìm bài trên bảng tin" placeholder="Tìm bài đăng, người chia sẻ..." />}
          {notice && <p role="status" className="mt-3 text-sm text-[#168ac0]">{notice}</p>}
          <div className="my-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">{postId ? "Bài viết" : search ? `Kết quả cho “${search}”` : "Bài đăng mới nhất"}{data && !postId ? <span className="ml-2 font-normal text-[#667085]">({data.total})</span> : null}</h2>
            <button type="button" disabled={refreshing} onClick={() => setRevision(value => value + 1)} className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#168ac0] disabled:opacity-60"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />Làm mới</button>
          </div>
          {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}<button type="button" onClick={() => setRevision(value => value + 1)} className="ml-2 font-bold underline">Thử lại</button></div>}
          {loading && <p role="status" className="flex justify-center gap-2 py-12 text-sm text-[#667085]"><LoaderCircle size={18} className="animate-spin" />Đang tải bảng tin...</p>}
          {data?.posts.length === 0 && <div className="rounded-2xl border border-dashed border-[#cfdeea] bg-white p-9 text-center"><House className="mx-auto text-[#8aa0b5]" size={36} /><h3 className="mt-4 font-extrabold">{search ? "Không tìm thấy bài đăng" : "Chưa có bài đăng"}</h3><p className="mt-2 text-sm leading-6 text-[#667085]">{search ? "Thử từ khóa khác hoặc xem tất cả danh mục." : "Khi có bài công khai mới, nội dung sẽ xuất hiện trên bảng tin."}</p>{(search || category) && <button type="button" onClick={() => { setQuery(""); setSearch(""); filter(""); }} className="mt-4 text-sm font-bold text-[#168ac0]">Xem tất cả</button>}</div>}
          <div className="space-y-4">{data?.posts.map(post => <NewsPostCard key={post.id} post={post} onFilter={postId ? undefined : filter} />)}</div>
          {data && data.totalPages > 1 && <nav aria-label="Phân trang bảng tin" className="mt-6 flex items-center justify-center gap-4"><button type="button" disabled={page === 1} onClick={() => changePage(page - 1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">Trước</button><span className="text-xs text-[#667085]">Trang {page} / {data.totalPages}</span><button type="button" disabled={page >= data.totalPages} onClick={() => changePage(page + 1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">Sau</button></nav>}
        </section>
      </div>
      <NewsPostComposer open={composerOpen} onOpenChange={setComposerOpen} onPublished={() => { setQuery(""); setSearch(""); setCategory(""); setPage(1); setRevision(value => value + 1); setNotice("Bài viết đã được đăng lên bảng tin."); }} />
    </main>
  </div>;
}
