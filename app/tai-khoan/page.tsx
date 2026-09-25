"use client";

import { useEffect, useState } from "react";
import { Bookmark, FileText, MessageCircle, MessageSquareText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Me = { user?: { name: string; email: string }; counts?: { posts: number; actions: number; requests: number } };
type Action = { id: number; actionType: string; targetType: string; targetId: string; createdAt: string };
type Request = { id: number; requestType: string; subject: string; status: string; createdAt: string };
type DirectMessage = { id: number; senderName: string; subject: string; content: string; createdAt: string };
type DeliveryProfile = { zaloUserId?: string | null; messengerPsid?: string | null; telegramChatId?: string | null };

export default function AccountPage() {
  const [me, setMe] = useState<Me>({});
  const [actions, setActions] = useState<Action[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [delivery, setDelivery] = useState<DeliveryProfile>({});
  const [deliveryNotice, setDeliveryNotice] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((response) => response.json() as Promise<Me>),
      fetch("/api/actions").then((response) => response.json() as Promise<{ actions?: Action[] }>),
      fetch("/api/requests").then((response) => response.json() as Promise<{ requests?: Request[] }>),
      fetch("/api/messages").then((response) => response.json() as Promise<{ messages?: DirectMessage[] }>),
      fetch("/api/delivery-profile").then((response) => response.json() as Promise<{ profile?: DeliveryProfile }>),
    ]).then(([profile, actionData, requestData, messageData, deliveryData]) => {
      setMe(profile);
      setActions(actionData.actions ?? []);
      setRequests(requestData.requests ?? []);
      setMessages(messageData.messages ?? []);
      setDelivery(deliveryData.profile ?? {});
    }).catch(() => {});
  }, []);

  const saveDelivery = async () => {
    setDeliveryNotice("Đang lưu...");
    try {
      const response = await fetch("/api/delivery-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(delivery) });
      const data = await response.json() as { error?: string; profile?: DeliveryProfile };
      if (!response.ok) throw new Error(data.error || "Chưa thể lưu.");
      setDelivery(data.profile ?? delivery);
      setDeliveryNotice("Đã lưu cấu hình nhận tin.");
    } catch (error) { setDeliveryNotice(error instanceof Error ? error.message : "Chưa thể lưu cấu hình."); }
  };
  const stats: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: "Bài đã đăng", value: me.counts?.posts ?? 0, Icon: MessageSquareText },
    { label: "Nội dung đã lưu", value: me.counts?.actions ?? 0, Icon: Bookmark },
    { label: "Yêu cầu đã gửi", value: me.counts?.requests ?? 0, Icon: FileText },
  ];

  return <main className="mx-auto min-h-[calc(100vh-72px)] max-w-5xl px-4 py-8 lg:px-8">
    <section className="flex flex-col gap-5 rounded-3xl bg-[#073b74] p-7 text-white sm:flex-row sm:items-center">
      <img src="/avatars/user-nguyen-van-a.png" alt={me.user?.name || "Thành viên"} className="size-24 rounded-full border-4 border-white/30 object-cover"/>
      <div><h1 className="text-3xl font-extrabold">{me.user?.name || "Thành viên Tipook"}</h1><p className="mt-1 text-white/75">{me.user?.email}</p></div>
    </section>
    <section className="mt-5 grid gap-3 sm:grid-cols-3">
      {stats.map(({ label, value, Icon }) => <div key={String(label)} className="rounded-2xl border border-[#e3eaf2] bg-white p-5"><Icon className="text-[#229ed9]" size={22}/><strong className="mt-3 block text-2xl text-[#0b2e59]">{String(value)}</strong><span className="text-sm text-[#667085]">{String(label)}</span></div>)}
    </section>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-[#e3eaf2] bg-white p-5"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><Bookmark size={20}/>Đã lưu và theo dõi</h2><div className="mt-4 space-y-2">{actions.map((item) => <div key={item.id} className="rounded-xl bg-[#f6f8fb] px-4 py-3"><p className="text-sm font-semibold text-[#182230]">{item.targetId}</p><p className="mt-1 text-xs text-[#667085]">{item.actionType} · {item.targetType}</p></div>)}{!actions.length && <p className="py-8 text-center text-sm text-[#667085]">Chưa lưu nội dung nào.</p>}</div></section>
      <section className="rounded-2xl border border-[#e3eaf2] bg-white p-5"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><FileText size={20}/>Yêu cầu của bạn</h2><div className="mt-4 space-y-2">{requests.map((item) => <div key={item.id} className="rounded-xl bg-[#f6f8fb] px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-[#182230]">{item.subject}</p><span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">{item.status === "pending" ? "Đang chờ" : item.status}</span></div><p className="mt-1 text-xs text-[#667085]">{item.requestType}</p></div>)}{!requests.length && <p className="py-8 text-center text-sm text-[#667085]">Chưa gửi yêu cầu nào.</p>}</div></section>
    </div>
    <section className="mt-5 rounded-2xl border border-[#e3eaf2] bg-white p-5"><h2 className="text-lg font-bold text-[#0b2e59]">Kênh nhận tin trực tiếp</h2><p className="mt-1 text-sm text-[#667085]">Cấu hình ID do Zalo OA, Messenger Platform và Telegram Bot cung cấp. Không nhập mật khẩu hoặc token cá nhân.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><input value={delivery.zaloUserId ?? ""} onChange={(event) => setDelivery((current) => ({ ...current, zaloUserId: event.target.value }))} className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Zalo User ID"/><input value={delivery.messengerPsid ?? ""} onChange={(event) => setDelivery((current) => ({ ...current, messengerPsid: event.target.value }))} className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Messenger PSID"/><input value={delivery.telegramChatId ?? ""} onChange={(event) => setDelivery((current) => ({ ...current, telegramChatId: event.target.value }))} className="h-11 rounded-xl border px-3 text-sm outline-none focus:border-[#229ed9]" placeholder="Telegram Chat ID"/></div><div className="mt-3 flex items-center justify-between gap-3"><p className="text-sm text-[#667085]">{deliveryNotice}</p><button type="button" onClick={() => void saveDelivery()} className="rounded-xl bg-[#229ed9] px-4 py-2.5 text-sm font-bold text-white">Lưu kênh nhận tin</button></div></section>
    <section className="mt-5 rounded-2xl border border-[#e3eaf2] bg-white p-5"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><MessageCircle size={20}/>Tin nhắn web nội bộ</h2><div className="mt-4 space-y-3">{messages.map((item) => <article key={item.id} className="rounded-xl bg-[#f6f8fb] px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm text-[#182230]">{item.senderName}</b><time className="text-xs text-[#98a2b3]">{new Date(item.createdAt).toLocaleString("vi-VN")}</time></div><p className="mt-1 text-sm font-semibold text-[#0b2e59]">{item.subject}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#667085]">{item.content}</p></article>)}{!messages.length && <p className="py-8 text-center text-sm text-[#667085]">Chưa có tin nhắn gửi trực tiếp đến bạn.</p>}</div></section>
  </main>;
}
