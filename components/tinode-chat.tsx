"use client";
/* Tinode 0.25 ships without TypeScript declarations; SDK objects are typed dynamically here. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle, LogIn, MessageCircle, Plus, RefreshCw, Send, UserPlus, Wifi } from "lucide-react";

type TinodeModule = { Tinode: new (config: Record<string, unknown>) => any; Drafty: { toPlainText: (content: unknown) => string } };
type ChatContact = { name: string; title: string; note: string; online: boolean; unread: number };
type ChatMessage = { seq: number; from: string; text: string; ts: string };

const DEFAULT_HOST = process.env.NEXT_PUBLIC_TINODE_HOST || "sandbox.tinode.co";
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_TINODE_API_KEY || "AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K";

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "text" in error) return String((error as { text: unknown }).text);
  return "Không thể kết nối trò chuyện.";
}

export function TinodeChat() {
  const tinodeRef = useRef<any>(null);
  const meRef = useRef<any>(null);
  const topicRef = useRef<any>(null);
  const draftyRef = useRef<TinodeModule["Drafty"] | null>(null);
  const host = DEFAULT_HOST;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [status, setStatus] = useState<"offline" | "connecting" | "online">("offline");
  const [notice, setNotice] = useState("");
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [active, setActive] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [currentUser, setCurrentUser] = useState("");

  const refreshContacts = () => {
    const me = meRef.current;
    if (!me) return;
    const next: ChatContact[] = [];
    me.contacts((topic: any) => {
      const title = topic.public?.fn || topic.public?.title || topic.private?.comment || topic.name;
      const preview = topic.latestMessage?.() || topic._messages?.getLast?.();
      next.push({
        name: topic.name,
        title,
        note: preview?.content ? (draftyRef.current?.toPlainText(preview.content) || String(preview.content)) : "Chưa có tin nhắn",
        online: Boolean(topic.online),
        unread: Math.max(0, Number(topic.seq || 0) - Number(topic.read || 0)),
      });
    });
    next.sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || a.title.localeCompare(b.title, "vi"));
    setContacts(next);
  };

  const loadMessages = (topic: any) => {
    const next: ChatMessage[] = [];
    topic.messages((message: any) => {
      next.push({
        seq: Number(message.seq || Date.now()),
        from: message.from || "",
        text: draftyRef.current?.toPlainText(message.content) || String(message.content || ""),
        ts: message.ts ? new Date(message.ts).toLocaleString("vi-VN") : "Vừa xong",
      });
    });
    setMessages(next);
    if (topic.maxMsgSeq?.()) topic.noteRead?.(topic.maxMsgSeq());
    refreshContacts();
  };

  const attachMe = async (tinode: any) => {
    const me = tinode.getMeTopic();
    meRef.current = me;
    me.onMetaSub = refreshContacts;
    me.onContactUpdate = refreshContacts;
    me.onPres = refreshContacts;
    await me.subscribe({ get: { desc: {}, sub: {} } });
    refreshContacts();
  };

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true); setNotice(""); setStatus("connecting");
    try {
      const sdk = await import("tinode-sdk") as unknown as TinodeModule;
      draftyRef.current = sdk.Drafty;
      const tinode = new sdk.Tinode({ appName: "ROOM XAY DUNG/1.0", host, apiKey: DEFAULT_API_KEY, transport: "ws", secure: !host.includes("localhost"), persist: true });
      tinodeRef.current = tinode;
      tinode.onDisconnect = (error: unknown) => { setStatus("offline"); if (error) setNotice(errorText(error)); };
      tinode.onConnect = () => setStatus("online");
      await tinode.connect();
      if (mode === "register") {
        await tinode.createAccountBasic(username.trim(), password, { public: { fn: displayName.trim() || username.trim() } });
      } else {
        await tinode.loginBasic(username.trim(), password);
      }
      await attachMe(tinode);
      setCurrentUser(tinode.getCurrentUserID?.() || "");
      setStatus("online");
    } catch (error) {
      setStatus("offline");
      setNotice(errorText(error));
      tinodeRef.current?.disconnect?.();
      tinodeRef.current = null;
    } finally { setBusy(false); }
  };

  const openTopic = async (contact: ChatContact) => {
    setBusy(true); setNotice("");
    try {
      if (topicRef.current?.name !== contact.name && topicRef.current?.isSubscribed?.()) await topicRef.current.leave(false).catch(() => {});
      const topic = tinodeRef.current.getTopic(contact.name);
      topicRef.current = topic;
      topic.onData = () => loadMessages(topic);
      topic.onPres = refreshContacts;
      await topic.subscribe({ get: { desc: {}, data: { limit: 50 }, sub: {} } });
      setActive(contact);
      loadMessages(topic);
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  };

  const openByTopic = async (event: FormEvent) => {
    event.preventDefault();
    const name = newTopic.trim();
    if (!name) return;
    const contact = { name, title: name, note: "Cuộc trò chuyện mới", online: false, unread: 0 };
    if (!contacts.some((item) => item.name === name)) setContacts((current) => [contact, ...current]);
    setNewTopic("");
    await openTopic(contact);
  };

  const send = async () => {
    const value = draft.trim();
    const topic = topicRef.current;
    if (!value || !topic || busy) return;
    setBusy(true); setNotice("");
    try {
      await topic.publish(value);
      setDraft("");
      loadMessages(topic);
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  };

  const logout = () => {
    topicRef.current?.leave?.(false).catch(() => {});
    tinodeRef.current?.disconnect?.();
    tinodeRef.current = null; meRef.current = null; topicRef.current = null;
    setStatus("offline"); setCurrentUser(""); setContacts([]); setMessages([]); setActive(null); setPassword(""); setNotice("");
  };

  useEffect(() => () => tinodeRef.current?.disconnect?.(), []);

  if (status !== "online") return <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-6xl place-items-center px-4 py-10">
    <div className="grid w-full overflow-hidden rounded-3xl border border-[#dce5ef] bg-white shadow-[0_24px_70px_rgba(11,46,89,.12)] lg:grid-cols-[1.05fr_.95fr]">
      <section className="hidden bg-gradient-to-br from-[#063a75] to-[#168ac0] p-10 text-white lg:block"><MessageCircle size={42}/><h1 className="mt-8 text-4xl font-extrabold tracking-[-.04em]">Kết nối cùng cộng đồng xây dựng</h1><p className="mt-4 max-w-md text-base leading-7 text-white/80">Trao đổi riêng tư với chủ nhà, kiến trúc sư, kỹ sư và nhà thầu ngay trong ROOM XÂY DỰNG.</p><div className="mt-10 space-y-4 text-sm"><p className="flex items-center gap-3"><CheckCircle2 size={18}/>Tin nhắn được đồng bộ an toàn</p><p className="flex items-center gap-3"><CheckCircle2 size={18}/>Trạng thái trực tuyến và chưa đọc</p><p className="flex items-center gap-3"><CheckCircle2 size={18}/>Trò chuyện liền mạch trên mọi thiết bị</p></div></section>
      <section className="p-6 sm:p-10"><div className="flex items-center gap-3 text-[#0b3264]"><span className="grid size-11 place-items-center rounded-2xl bg-[#e8f6fc] text-[#168ac0]"><MessageCircle/></span><div><h2 className="text-2xl font-extrabold">{mode === "login" ? "Đăng nhập ROOM Chat" : "Tạo tài khoản ROOM Chat"}</h2><p className="text-sm text-[#667085]">Nhắn tin trực tiếp với cộng đồng</p></div></div>
        <form onSubmit={connect} className="mt-7 space-y-4">{mode === "register" && <label className="block text-sm font-bold text-[#344054]">Tên hiển thị<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#d0d5dd] px-3 outline-none focus:border-[#229ed9]" required/></label>}<label className="block text-sm font-bold text-[#344054]">Tên đăng nhập<input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#d0d5dd] px-3 outline-none focus:border-[#229ed9]" autoComplete="username" required/></label><label className="block text-sm font-bold text-[#344054]">Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#d0d5dd] px-3 outline-none focus:border-[#229ed9]" autoComplete={mode === "login" ? "current-password" : "new-password"} required/></label>{notice && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{notice}</p>}<button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ed9] font-bold text-white hover:bg-[#168ac0] disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={18}/> : mode === "login" ? <LogIn size={18}/> : <UserPlus size={18}/>} {busy ? "Đang kết nối..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button></form>
        <button type="button" onClick={() => { setMode((value) => value === "login" ? "register" : "login"); setNotice(""); }} className="mt-4 w-full text-sm font-bold text-[#168ac0]">{mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}</button><p className="mt-5 rounded-xl bg-[#f6f8fb] p-3 text-xs leading-5 text-[#667085]">Tài khoản dùng thử: <b>alice</b> / <b>alice123</b>.</p>
      </section>
    </div>
  </div>;

  return <main className="mx-auto h-[calc(100vh-72px)] max-w-[1568px] p-3 lg:p-5"><div className="grid h-full overflow-hidden rounded-2xl border border-[#dce5ef] bg-white shadow-sm md:grid-cols-[330px_1fr]">
    <aside className={(active ? "hidden md:flex" : "flex") + " min-h-0 flex-col border-r border-[#e4eaf1]"}><header className="flex items-center justify-between border-b border-[#e4eaf1] p-4"><div><h1 className="text-xl font-extrabold text-[#0b3264]">Tin nhắn</h1><p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600"><Wifi size={13}/>Đang hoạt động</p></div><button onClick={logout} className="rounded-lg px-3 py-2 text-xs font-bold text-[#667085] hover:bg-[#f3f5f8]">Đăng xuất</button></header><form onSubmit={openByTopic} className="flex gap-2 border-b border-[#e4eaf1] p-3"><input value={newTopic} onChange={(event) => setNewTopic(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl bg-[#f1f5f9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#7bc8ea]" placeholder="Nhập tên người bạn muốn tìm..."/><button className="grid size-10 place-items-center rounded-xl bg-[#229ed9] text-white" aria-label="Mở cuộc trò chuyện"><Plus size={19}/></button></form><div className="min-h-0 flex-1 overflow-y-auto">{contacts.map((contact) => <button key={contact.name} onClick={() => void openTopic(contact)} className="flex w-full items-center gap-3 border-b border-[#edf1f5] p-4 text-left hover:bg-[#f6f9fc]"><span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-[#d9f1fb] font-extrabold text-[#168ac0]">{contact.title.charAt(0).toUpperCase()}{contact.online && <i className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500"/>}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm text-[#182230]">{contact.title}</b><small className="mt-1 block truncate text-xs text-[#667085]">{contact.note}</small></span>{contact.unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-[#229ed9] px-1.5 py-0.5 text-[10px] font-bold text-white">{contact.unread}</span>}</button>)}{contacts.length === 0 && <div className="p-8 text-center text-sm text-[#667085]"><MessageCircle className="mx-auto mb-2"/>Chưa có hội thoại. Hãy tìm một người để bắt đầu trò chuyện.</div>}</div></aside>
    <section className={(active ? "flex" : "hidden md:flex") + " min-h-0 flex-col bg-[#f5f8fc]"}>{active ? <><header className="flex h-[72px] items-center gap-3 border-b border-[#e4eaf1] bg-white px-4"><button onClick={() => setActive(null)} className="grid size-9 place-items-center rounded-full hover:bg-[#f1f5f9] md:hidden"><ArrowLeft size={19}/></button><span className="grid size-10 place-items-center rounded-full bg-[#d9f1fb] font-extrabold text-[#168ac0]">{active.title.charAt(0).toUpperCase()}</span><div className="min-w-0"><h2 className="truncate font-extrabold text-[#0b3264]">{active.title}</h2><p className="text-xs text-[#667085]">{active.online ? "Đang hoạt động" : active.name}</p></div><button onClick={() => void openTopic(active)} className="ml-auto grid size-9 place-items-center rounded-full hover:bg-[#f1f5f9]" aria-label="Làm mới"><RefreshCw size={17}/></button></header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">{messages.map((message) => { const mine = message.from === currentUser; return <div key={message.seq} className={"flex " + (mine ? "justify-end" : "justify-start")}><div className={"max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm " + (mine ? "rounded-br-md bg-[#229ed9] text-white" : "rounded-bl-md bg-white text-[#25364a]")}><p className="whitespace-pre-wrap leading-6">{message.text}</p><small className={"mt-1 block text-[10px] " + (mine ? "text-white/70" : "text-[#98a2b3]")}>{message.ts}</small></div></div>})}{messages.length === 0 && <div className="grid h-full place-items-center text-center text-sm text-[#667085]"><div><MessageCircle className="mx-auto mb-2"/>Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện.</div></div>}</div><div className="border-t border-[#dce5ef] bg-white p-3 sm:p-4"><div className="flex items-end gap-2 rounded-2xl bg-[#f0f2f5] p-2 pl-4"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none" placeholder="Nhập tin nhắn..."/><button onClick={() => void send()} disabled={busy || !draft.trim()} className="grid size-10 shrink-0 place-items-center rounded-full bg-[#229ed9] text-white disabled:bg-[#b9dff0]"><Send size={18}/></button></div>{notice && <p className="mt-2 text-xs text-rose-600">{notice}</p>}</div></> : <div className="grid h-full place-items-center text-center text-[#667085]"><div><span className="mx-auto grid size-20 place-items-center rounded-full bg-[#e8f6fc] text-[#168ac0]"><MessageCircle size={36}/></span><h2 className="mt-4 text-xl font-extrabold text-[#0b3264]">ROOM Chat</h2><p className="mt-1 text-sm">Chọn một hội thoại để bắt đầu nhắn tin.</p></div></div>}</section>
  </div></main>;
}