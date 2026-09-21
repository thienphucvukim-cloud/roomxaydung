"use client";

import { useEffect, useState } from "react";
import { Bookmark, FileText, MessageSquareText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Me = { user?: { name: string; email: string }; counts?: { posts: number; actions: number; requests: number } };
type Action = { id: number; actionType: string; targetType: string; targetId: string; createdAt: string };
type Request = { id: number; requestType: string; subject: string; status: string; createdAt: string };

export default function AccountPage() {
  const [me, setMe] = useState<Me>({});
  const [actions, setActions] = useState<Action[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((response) => response.json() as Promise<Me>),
      fetch("/api/actions").then((response) => response.json() as Promise<{ actions?: Action[] }>),
      fetch("/api/requests").then((response) => response.json() as Promise<{ requests?: Request[] }>),
    ]).then(([profile, actionData, requestData]) => {
      setMe(profile);
      setActions(actionData.actions ?? []);
      setRequests(requestData.requests ?? []);
    }).catch(() => {});
  }, []);

  const stats: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: "Bài đã đăng", value: me.counts?.posts ?? 0, Icon: MessageSquareText },
    { label: "Nội dung đã lưu", value: me.counts?.actions ?? 0, Icon: Bookmark },
    { label: "Yêu cầu đã gửi", value: me.counts?.requests ?? 0, Icon: FileText },
  ];

  return <main className="mx-auto min-h-[calc(100vh-72px)] max-w-5xl px-4 py-8 lg:px-8">
    <section className="flex flex-col gap-5 rounded-3xl bg-[#073b74] p-7 text-white sm:flex-row sm:items-center">
      <img src="/avatars/user-nguyen-van-a.png" alt={me.user?.name || "Thành viên"} className="size-24 rounded-full border-4 border-white/30 object-cover"/>
      <div><h1 className="text-3xl font-extrabold">{me.user?.name || "Thành viên ROOM"}</h1><p className="mt-1 text-white/75">{me.user?.email}</p></div>
    </section>
    <section className="mt-5 grid gap-3 sm:grid-cols-3">
      {stats.map(({ label, value, Icon }) => <div key={String(label)} className="rounded-2xl border border-[#e3eaf2] bg-white p-5"><Icon className="text-[#229ed9]" size={22}/><strong className="mt-3 block text-2xl text-[#0b2e59]">{String(value)}</strong><span className="text-sm text-[#667085]">{String(label)}</span></div>)}
    </section>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-[#e3eaf2] bg-white p-5"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><Bookmark size={20}/>Đã lưu và theo dõi</h2><div className="mt-4 space-y-2">{actions.map((item) => <div key={item.id} className="rounded-xl bg-[#f6f8fb] px-4 py-3"><p className="text-sm font-semibold text-[#182230]">{item.targetId}</p><p className="mt-1 text-xs text-[#667085]">{item.actionType} · {item.targetType}</p></div>)}{!actions.length && <p className="py-8 text-center text-sm text-[#667085]">Chưa lưu nội dung nào.</p>}</div></section>
      <section className="rounded-2xl border border-[#e3eaf2] bg-white p-5"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><FileText size={20}/>Yêu cầu của bạn</h2><div className="mt-4 space-y-2">{requests.map((item) => <div key={item.id} className="rounded-xl bg-[#f6f8fb] px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-[#182230]">{item.subject}</p><span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">{item.status === "pending" ? "Đang chờ" : item.status}</span></div><p className="mt-1 text-xs text-[#667085]">{item.requestType}</p></div>)}{!requests.length && <p className="py-8 text-center text-sm text-[#667085]">Chưa gửi yêu cầu nào.</p>}</div></section>
    </div>
  </main>;
}
