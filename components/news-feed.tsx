"use client";

import { SITE_EVENTS } from "@/lib/site-events";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { DraftingCompass, Flame, LoaderCircle, House, MessageCircle, RefreshCw, Sofa } from "lucide-react";
import { HouseGalleryIcon } from "@/components/house-gallery-icon";
import { NEWS_SOURCES, type NewsFeedResponse } from "@/lib/news-feed";
import { CatalogToolbar } from "@/components/catalog-toolbar";
import { NewsPostComposer } from "@/components/news-post-composer";
import { NewsPostCard } from "@/components/news-post-card";
import { ClientNavigationLink } from "@/components/client-navigation-link";
import { formatPriceDescription } from "@/lib/price-description";
import { usePostAnchor } from "@/components/use-post-anchor";
import { useRouter } from "next/navigation";
import { postHref } from "@/lib/post-url";

const sourceIcons = [House, HouseGalleryIcon, DraftingCompass, Sofa];

export function NewsFeed({ postId, postSlug, initialData }: { postId?: number; postSlug?: string; initialData?: NewsFeedResponse }) {
  const detail = Boolean(postId || postSlug);
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const scope = JSON.stringify([postId ?? postSlug ?? null, category, search]);
  const selection = `${scope}:${page}`;
  const [result, setResult] = useState<{ selection: string; scope: string; data?: NewsFeedResponse; error?: string }>(initialData ? { selection, scope, data: initialData } : { selection: "", scope: "" });
  const [refreshing, setRefreshing] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadedPages = useRef<{ scope: string; batches: NewsFeedResponse[] } | null>(null);
  const current = result.selection === selection;
  const data = result.scope === scope ? result.data : undefined;
  usePostAnchor(data?.posts ?? []);
  const error = current ? result.error : undefined;
  const loading = !current && !data;
  const featuredPosts = [...(data?.posts ?? [])]
    .sort((a, b) => b.comments - a.comments || b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .slice(0, 5);

  // Numeric links loaded through an RSC shell resolve to their permanent URL.
  const resolvedPost = detail ? data?.posts[0] : undefined;
  const resolvedHref = resolvedPost?.slug ? postHref(resolvedPost) : undefined;
  useEffect(() => {
    if (resolvedHref && (/^\/bai-viet\/[1-9]\d*$/.test(window.location.pathname) || /^#post-\d+$/.test(window.location.hash))) router.replace(resolvedHref);
  }, [resolvedHref, router]);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = async (force = false) => {
      if (pending || controller.signal.aborted) return;
      pending = true;
      setRefreshing(true);
      try {
        const readPage = async (number: number) => {
          const params = new URLSearchParams({ page: String(number), category, q: search });
          if (postId) params.set("postId", String(postId));
          else if (postSlug) params.set("slug", postSlug);
          const response = await fetch(`/api/news-feed?${params}`, { signal: controller.signal, cache: "no-store" });
          const payload = await response.json() as NewsFeedResponse & { error?: string };
          if (!response.ok) throw new Error(payload.error || "Chưa thể tải bảng tin.");
          return payload;
        };
        const previous = loadedPages.current;
        const append = !force && previous?.scope === scope && previous.batches.length === page - 1 && page > 1;
        const batches = append ? [...previous.batches, await readPage(page)] : [];
        if (!append) {
          // Explicit refreshes update loaded posts with at most two concurrent requests.
          for (let number = 1; number <= page; number += 2) {
            if (controller.signal.aborted) return;
            batches.push(...await Promise.all([readPage(number), ...(number < page ? [readPage(number + 1)] : [])]));
            if (page > batches[0].totalPages) break;
          }
        }
        const payload = batches[batches.length - 1];
        if (controller.signal.aborted) return;
        if (page > payload.totalPages) { loadedPages.current = null; setPage(payload.totalPages); return; }
        loadedPages.current = { scope, batches };
        const posts = [...new Map(batches.flatMap(batch => batch.posts).map(post => [post.id, post])).values()]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
        setResult({ selection, scope, data: { ...payload, posts, page } });
      } catch (cause) {
        if (!controller.signal.aborted) setResult(previous => ({
          selection,
          scope,
          data: previous.scope === scope ? previous.data : undefined,
          error: cause instanceof Error ? cause.message : "Chưa thể tải bảng tin. Vui lòng thử lại.",
        }));
      } finally {
        pending = false;
        if (!controller.signal.aborted) setRefreshing(false);
      }
    };
    // Deep scrolling must not trigger an ever-growing background request burst.
    const update = () => { if (document.visibilityState === "visible" && page === 1) void refresh(true); };
    const updateContent = () => { if (document.visibilityState === "visible") void refresh(true); };
    // Queue the initial request; subsequent refreshes keep the current cards visible.
    void Promise.resolve().then(() => refresh());
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener(SITE_EVENTS.contentChanged, updateContent);
    window.addEventListener(SITE_EVENTS.avatarChanged, updateContent);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener(SITE_EVENTS.contentChanged, updateContent);
      window.removeEventListener(SITE_EVENTS.avatarChanged, updateContent);
    };
  }, [category, search, page, selection, scope, revision, postId, postSlug]);

  useEffect(() => {
    if (!current || refreshing || error || !data || page >= data.totalPages || !loadMoreRef.current || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); setPage(value => value + 1); }
    }, { rootMargin: "400px" });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [current, refreshing, error, data, page]);

  const filter = (value: string) => { setCategory(value); setPage(1); };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setSearch(query.trim()); setPage(1); };

  return <div className="min-h-screen bg-[#f0f2f5] text-[#1c1e21]">
    <main className="mx-auto max-w-[1320px] px-4 py-5 lg:px-8">
      <h1 className="sr-only">Bảng tin</h1>
      <div className={`grid grid-cols-1 items-start gap-6 ${detail ? "" : "lg:grid-cols-[220px_minmax(0,1fr)_220px] xl:grid-cols-[240px_minmax(0,1fr)_240px]"}`}>
        {!detail && <aside className="min-w-0 rounded-2xl border border-[#e3eaf2] bg-white p-4 lg:sticky lg:top-24">
          <h2 className="px-2 text-sm font-extrabold">Khám phá bảng tin</h2>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col" role="group" aria-label="Lọc bảng tin">
            {[{ category: "", label: "Tất cả", Icon: House }, ...NEWS_SOURCES.map((source, index) => ({ ...source, Icon: sourceIcons[index] }))].map(item =>
              <button key={item.category} type="button" aria-pressed={category === item.category} onClick={() => filter(item.category)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition ${category === item.category ? "bg-[#e8f6fc] text-[#168ac0]" : "text-[#52677f] hover:bg-[#f4f7fb]"}`}><item.Icon size={18} />{item.label}</button>,
            )}
          </div>
          <p className="mt-4 hidden border-t border-[#e3eaf2] px-2 pt-4 text-xs leading-5 text-[#667085]">Bài công khai mới từ các trang sẽ tự xuất hiện tại đây.</p>
        </aside>}

        <section aria-label="Bài đăng mới" className="min-w-0">
          {detail && <ClientNavigationLink href="/" className="text-sm font-semibold text-[#168ac0] hover:underline">Quay lại bảng tin</ClientNavigationLink>}
          {!detail && <CatalogToolbar query={query} onQueryChange={setQuery} onSearch={submitSearch} onClear={() => { setQuery(""); setSearch(""); setPage(1); }} onPublish={() => setComposerOpen(true)} publishLabel="Đăng bài" publishTitle="Đăng bài lên bảng tin" searchLabel="Tìm bài trên bảng tin" placeholder="Tìm bài đăng, người chia sẻ..." />}
          {notice && <p role="status" className="mt-3 text-sm text-[#168ac0]">{notice}</p>}
          <div className="my-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">{detail ? "Bài viết" : search ? `Kết quả cho “${search}”` : "Bài đăng mới nhất"}{data && !detail ? <span className="ml-2 font-normal text-[#667085]">({data.total})</span> : null}</h2>
            <button type="button" disabled={refreshing} onClick={() => setRevision(value => value + 1)} className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#168ac0] disabled:opacity-60"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />Làm mới</button>
          </div>
          {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}<button type="button" onClick={() => setRevision(value => value + 1)} className="ml-2 font-bold underline">Thử lại</button></div>}
          {loading && <p role="status" className="flex justify-center gap-2 py-12 text-sm text-[#667085]"><LoaderCircle size={18} className="animate-spin" />Đang tải bảng tin...</p>}
          {data?.posts.length === 0 && <div className="rounded-2xl border border-dashed border-[#cfdeea] bg-white p-9 text-center"><House className="mx-auto text-[#8aa0b5]" size={36} /><h3 className="mt-4 font-extrabold">{search ? "Không tìm thấy bài đăng" : "Chưa có bài đăng"}</h3><p className="mt-2 text-sm leading-6 text-[#667085]">{search ? "Thử từ khóa khác hoặc xem tất cả danh mục." : "Khi có bài công khai mới, nội dung sẽ xuất hiện trên bảng tin."}</p>{(search || category) && <button type="button" onClick={() => { setQuery(""); setSearch(""); filter(""); }} className="mt-4 text-sm font-bold text-[#168ac0]">Xem tất cả</button>}</div>}
          <div className="space-y-4">{data?.posts.map(post => <NewsPostCard key={post.id} post={post} detail={Boolean(detail)} onFilter={detail ? undefined : filter} />)}</div>
          {data && !detail && <div ref={loadMoreRef} className="mt-6 flex flex-col items-center gap-3 py-4">
            {refreshing && !current && <p role="status" className="flex items-center gap-2 text-sm text-[#667085]"><LoaderCircle size={18} className="animate-spin" />Đang tải thêm bài đăng...</p>}
            {data.page < data.totalPages ? <button type="button" disabled={refreshing || !current} onClick={() => { if (error || page > data.page) setRevision(value => value + 1); else setPage(value => value + 1); }} className="rounded-xl border bg-white px-5 py-2 text-sm font-semibold disabled:opacity-40">{error ? "Thử tải thêm bài đăng" : "Xem thêm bài đăng"}</button> : data.posts.length > 0 && <p className="text-xs text-[#667085]">Bạn đã xem hết bài đăng{search || category ? " phù hợp" : " hiện tại"}.</p>}
          </div>}
        </section>
        {!detail && <aside aria-labelledby="featured-news-heading" className="hidden rounded-2xl border border-[#e3eaf2] bg-white p-4 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
          <h2 id="featured-news-heading" className="flex items-center gap-2 px-2 text-sm font-extrabold"><Flame size={18} className="shrink-0 text-[#168ac0]" aria-hidden="true" />Tin nổi bật</h2>
          <p className="mt-2 px-2 text-xs leading-5 text-[#667085]">Những bài đăng được thảo luận nhiều trên bảng tin.</p>
          {loading && <p role="status" className="mt-4 flex items-center gap-2 px-2 text-xs text-[#667085]"><LoaderCircle size={16} className="animate-spin" />Đang tải tin nổi bật...</p>}
          {!loading && featuredPosts.length === 0 && <p className="mt-4 px-2 text-xs leading-5 text-[#667085]">{error ? "Chưa thể tải tin nổi bật. Hãy thử làm mới bảng tin." : "Chưa có tin nổi bật."}</p>}
          {featuredPosts.length > 0 && <div className="mt-3 space-y-2">
            {featuredPosts.map(post => <ClientNavigationLink key={post.id} href={postHref(post)} className="block rounded-xl p-2 transition hover:bg-[#f4f7fb] focus-visible:outline-2 focus-visible:outline-[#229ed9]">
              <div className="flex items-start gap-3">
                {post.images[0] && <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-[#f0f2f5]"><Image src={post.images[0].url} alt="" fill sizes="56px" className="object-cover" /></div>}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#168ac0]">{post.sourceLabel}</span>
                  <h3 className="mt-1 line-clamp-3 break-words text-xs font-bold leading-5">{formatPriceDescription(post.title || post.content) || "Bài đăng của " + post.authorName}</h3>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#667085]">
                <span className="truncate">{post.authorName}</span>
                <span className="flex shrink-0 items-center gap-1"><MessageCircle size={12} aria-hidden="true" />{post.comments} bình luận</span>
              </div>
            </ClientNavigationLink>)}
          </div>}
        </aside>}
      </div>
      <NewsPostComposer open={composerOpen} onOpenChange={setComposerOpen} onPublished={() => { setQuery(""); setSearch(""); setCategory(""); setPage(1); setRevision(value => value + 1); setNotice("Bài viết đã được đăng lên bảng tin."); }} />
    </main>
  </div>;
}
