"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

type Post = { id: number; title: string; content: string; category: string; createdAt: string };
const resources = [
  { title: "Mẫu nhà đẹp", copy: "Thư viện mẫu nhà phố, nhà vườn và thiết kế hiện đại.", href: "/kho-mau-nha-dep-tipook", type: "Danh mục" },
  { title: "Mặt bằng công năng", copy: "Mặt bằng tham khảo theo chiều ngang, số tầng và nhu cầu.", href: "/mat-bang-cong-nang", type: "Danh mục" },
  { title: "Kho bản vẽ", copy: "Bản vẽ CAD, hồ sơ thi công và tài liệu xây dựng.", href: "/file-ban-ve-nha-dep-tipook", type: "Danh mục" },
  { title: "Hỏi chuyên gia", copy: "Gửi câu hỏi về kiến trúc, kết cấu, dự toán và thi công.", href: "/hoi-chuyen-gia", type: "Dịch vụ" },
  { title: "Tính vật tư xây dựng", copy: "Tính khối lượng bê tông, xây tường, trát, lát gạch và sơn nước.", href: "/tinh-vat-tu-tipook", type: "Tiện ích" },
  { title: "Cẩm nang xây nhà", copy: "Kiến thức chuẩn bị ngân sách, hợp đồng và nghiệm thu.", href: "/cam-nang", type: "Nội dung" },
];

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch("/api/posts").then((response) => response.ok ? response.json() as Promise<{ posts?: Post[] }> : Promise.reject()).then((data) => setPosts(data.posts ?? [])).catch(() => {});
  }, []);

  const normalized = initial.trim().toLocaleLowerCase("vi");
  const results = useMemo(() => {
    if (!normalized) return [];
    const postResults = posts.filter((post) => (post.title + " " + post.content + " " + post.category).toLocaleLowerCase("vi").includes(normalized)).map((post) => ({ title: post.title, copy: post.content, href: "/?post=" + post.id, type: "Bài viết" }));
    const resourceResults = resources.filter((item) => (item.title + " " + item.copy).toLocaleLowerCase("vi").includes(normalized));
    return [...postResults, ...resourceResults];
  }, [normalized, posts]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? "/tim-kiem?q=" + encodeURIComponent(value) : "/tim-kiem");
  };

  return <main className="mx-auto min-h-[calc(100vh-72px)] max-w-4xl px-4 py-8 lg:px-8">
    <h1 className="text-3xl font-extrabold tracking-[-.03em] text-[#0b2e59]">Tìm kiếm</h1>
    <form onSubmit={submit} className="relative mt-5"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#667085]"/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="h-13 w-full rounded-2xl border border-[#dce5ef] bg-white pl-12 pr-4 text-base outline-none focus:border-[#229ed9]" placeholder="Tìm bài viết, mẫu nhà, bản vẽ, nhà thầu..."/></form>
    {!normalized && <div className="mt-8 rounded-2xl border border-dashed border-[#b8c5d3] bg-white p-10 text-center text-[#667085]">Nhập từ khóa để tìm trong bài viết và toàn bộ danh mục.</div>}
    {normalized && <div className="mt-7"><p className="mb-3 text-sm font-semibold text-[#667085]">{results.length} kết quả cho “{initial}”</p><div className="space-y-3">{results.map((item, index) => <Link key={item.href + index} href={item.href} className="block rounded-2xl border border-[#e3eaf2] bg-white p-5 transition hover:border-[#7bc8ea]"><span className="text-xs font-bold uppercase tracking-wide text-[#229ed9]">{item.type}</span><h2 className="mt-1 text-lg font-bold text-[#0b2e59]">{item.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#536273]">{item.copy}</p></Link>)}</div>{!results.length && <div className="rounded-2xl bg-white p-10 text-center text-[#667085]">Không tìm thấy kết quả phù hợp.</div>}</div>}
  </main>;
}

export default function SearchPage() {
  return <Suspense fallback={<div className="p-10 text-center">Đang tải...</div>}><SearchContent/></Suspense>;
}
