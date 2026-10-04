"use client";

import { SITE_EVENTS } from "@/lib/site-events";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Bookmark, BriefcaseBusiness, ChevronRight, ExternalLink, FileText, Heart, Info, LoaderCircle, Mail, MessageCircle, Settings, ShieldCheck, UserPlus, Users, WalletCards } from "lucide-react";
import { WalletPanel } from "@/components/wallet-panel";
import { PasswordChange } from "@/components/password-change";
import { MyPosts } from "@/components/my-posts";
import { InboxPanel } from "@/components/inbox-panel";
import { AvatarEditor } from "@/components/avatar-editor";
import { MemberAvatar } from "@/components/member-avatar";
import "./profile.css";

type Me = { user?: { id: string; name: string; email: string | null; avatarUrl?: string | null; hasCustomAvatar?: boolean; username?: string | null; authenticated?: boolean; isAdmin?: boolean; passwordAccount?: boolean; accountType?: string; profession?: string | null }; counts?: { posts: number; actions: number; requests: number } };
type Action = { id: number; actionType: string; targetType: string; targetId: string; createdAt: string };
type Member = { id: string; name: string; avatarUrl?: string | null };
type UserRequest = { id: number; requestType: string; subject: string; status: string; createdAt: string };
type DeliveryProfile = { zaloUserId?: string | null; messengerPsid?: string | null; telegramChatId?: string | null };
const tabs = [
  { id: "bai-viet-cua-toi", label: "Bài viết", Icon: FileText },
  { id: "mau-ua-thich", label: "Đã lưu", Icon: Bookmark },
  { id: "ket-noi", label: "Kết nối", Icon: Users },
  { id: "tin-nhan", label: "Tin nhắn", Icon: MessageCircle },
  { id: "vi-nhadepchat", label: "Ví NhàĐẹpChất", Icon: WalletCards },
  { id: "cai-dat", label: "Cài đặt", Icon: Settings },
] as const;
type Tab = typeof tabs[number]["id"];
function tabForHash(hash: string): Tab {
  const id = hash.replace(/^#/, "");
  if (id === "vi-tipook") return "vi-nhadepchat";
  if (["bao-mat", "kenh-nhan-tin", "yeu-cau"].includes(id)) return "cai-dat";
  if (id.startsWith("my-post-")) return "bai-viet-cua-toi";
  return tabs.find(tab => tab.id === id)?.id ?? "bai-viet-cua-toi";
}
const actionLabels: Record<string, string> = { save: "Đã lưu", follow: "Đang theo dõi", friend: "Kết bạn", like: "Đã thích" };
const targetLabels: Record<string, string> = { "house-model": "Mẫu nhà", drawing: "Bản vẽ", interior: "Nội thất", post: "Bài viết", profile: "Thành viên" };
const statusLabels: Record<string, string> = { pending: "Đang chờ", approved: "Đã duyệt", rejected: "Từ chối", completed: "Hoàn tất", processing: "Đang xử lý", sent: "Đã gửi", delivered: "Đã gửi", failed: "Chưa gửi được", closed: "Đã đóng", cancelled: "Đã hủy" };
const requestLabels: Record<string, string> = { "admin-help": "Hỗ trợ từ admin", "drawing-file-request": "Yêu cầu bản vẽ", "drawing-purchase": "Mua bản vẽ", "expert-question": "Hỏi chuyên gia", consultation: "Tư vấn", contact: "Liên hệ" };

function EmptyState({ icon: Icon, title, children }: { icon: typeof Bookmark; title: string; children: ReactNode }) {
  return <div className="profile-empty"><span><Icon size={26}/></span><h3>{title}</h3><p>{children}</p></div>;
}

export default function AccountPage() {
  const [me, setMe] = useState<Me>({});
  const [actions, setActions] = useState<Action[]>([]);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [delivery, setDelivery] = useState<DeliveryProfile>({});
  const [deliveryNotice, setDeliveryNotice] = useState("");
  const [deliveryLoaded, setDeliveryLoaded] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("bai-viet-cua-toi");
  const [visited, setVisited] = useState<Set<Tab>>(new Set(["bai-viet-cua-toi"]));
  const [connectionFilter, setConnectionFilter] = useState<"all" | "follow" | "friend">("all");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncHash = () => {
      const tab = tabForHash(window.location.hash);
      setActiveTab(tab);
      setVisited(current => new Set([...current, tab]));
    };
    const timer = window.setTimeout(syncHash, 0);
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => { window.clearTimeout(timer); window.removeEventListener("hashchange", syncHash); window.removeEventListener("popstate", syncHash); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const read = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      const data = await response.json() as T & { error?: string };
      if (!response.ok) throw new Error(data.error || "Chưa thể tải thông tin hồ sơ.");
      return data as T;
    };
    void Promise.resolve().then(async () => {
      setLoading(true); setError("");
      const results = await Promise.allSettled([
        read<Me>("/api/me"),
        read<{ actions?: Action[]; members?: Member[] }>("/api/actions?withProfiles=true"),
        read<{ requests?: UserRequest[] }>("/api/requests"),
        read<{ profile?: DeliveryProfile }>("/api/delivery-profile"),
      ]);
      if (controller.signal.aborted) return;
      const [profile, activity, requestData, deliveryData] = results;
      if (profile.status === "fulfilled") setMe(profile.value);
      if (activity.status === "fulfilled") { setActions(activity.value.actions ?? []); setMembers(activity.value.members ?? []); }
      if (requestData.status === "fulfilled") setRequests(requestData.value.requests ?? []);
      if (deliveryData.status === "fulfilled") { setDelivery(deliveryData.value.profile ?? {}); setDeliveryLoaded(true); }
      if (results.some(result => result.status === "rejected")) setError("Một số thông tin chưa tải được. Bạn có thể thử lại.");
      setLoading(false);
    });
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener(SITE_EVENTS.contentChanged, refresh);
    return () => { controller.abort(); window.removeEventListener(SITE_EVENTS.contentChanged, refresh); };
  }, [revision]);

  useEffect(() => {
    // A hash target can be inside a panel that was hidden when the link was followed.
    if (!window.location.hash) return;
    const timer = window.setTimeout(() => {
      const id = window.location.hash.slice(1);
      if (id !== activeTab) document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loading]);

  function selectTab(tab: Tab, hash: string = tab, scroll = false) {
    setActiveTab(tab);
    setVisited(current => new Set([...current, tab]));
    if (window.location.hash !== `#${hash}`) window.history.pushState(null, "", `#${hash}`);
    if (scroll) window.requestAnimationFrame(() => {
      const target = hash === tab ? contentRef.current : document.getElementById(hash);
      target?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }

  const saveDelivery = async () => {
    if (savingDelivery || !deliveryLoaded) return;
    setSavingDelivery(true); setDeliveryNotice("");
    try {
      const response = await fetch("/api/delivery-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(delivery) });
      const data = await response.json() as { error?: string; profile?: DeliveryProfile };
      if (!response.ok) throw new Error(data.error || "Chưa thể lưu.");
      setDelivery(data.profile ?? delivery); setDeliveryNotice("Đã lưu kênh nhận tin.");
    } catch (cause) { setDeliveryNotice(cause instanceof Error ? cause.message : "Chưa thể lưu kênh nhận tin."); }
    finally { setSavingDelivery(false); }
  };

  const saved = actions.filter(item => item.actionType === "save");
  const favoriteModels = saved.filter(item => ["house-model", "drawing", "interior"].includes(item.targetType));
  const following = actions.filter(item => item.actionType === "follow" && item.targetType === "profile");
  const friends = actions.filter(item => item.actionType === "friend" && item.targetType === "profile");
  const connections = Array.from(new Set([...following, ...friends].map(item => item.targetId))).map(id => ({
    id, member: members.find(member => member.id === id),
    following: following.some(item => item.targetId === id), friend: friends.some(item => item.targetId === id),
  })).filter(item => connectionFilter === "all" || (connectionFilter === "follow" ? item.following : item.friend));
  const name = me.user?.name || (loading ? "Đang tải hồ sơ…" : "Thành viên NhàĐẹpChất");
  const profession = me.user?.profession || (me.user?.accountType === "engineer" ? "Kỹ sư" : me.user?.accountType === "architect" ? "Kiến trúc sư" : "Thành viên");
  const bio = me.user?.profession ? `${profession} · Chia sẻ kinh nghiệm và ý tưởng thiết kế, xây dựng nhà ở.` : "Cùng cộng đồng NhàĐẹpChất tìm ý tưởng và chia sẻ kinh nghiệm xây nhà.";
  const actionHref = (item: Action) => item.targetType === "profile" ? `/nguoi-dung/${encodeURIComponent(item.targetId)}` : `/tim-kiem?q=${encodeURIComponent(item.targetId)}`;
  const panel = (tab: Tab, children: ReactNode) => <div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} hidden={activeTab !== tab} tabIndex={0} className="profile-panel">{visited.has(tab) && children}</div>;

  return <main className="account-profile">
    <section className="profile-header" aria-label="Hồ sơ của bạn">
      <div className="profile-cover" aria-hidden="true"><div className="profile-cover-grid"/><div className="profile-cover-house"/><span className="profile-cover-caption">Không gian của bạn trên NhàĐẹpChất</span></div>
      <div className="profile-identity">
        <div className="profile-avatar"><AvatarEditor name={me.user?.name || ""} avatarUrl={me.user?.avatarUrl ?? null} hasCustomAvatar={Boolean(me.user?.hasCustomAvatar)} authenticated={Boolean(me.user?.authenticated)} onChange={avatar => setMe(current => ({ ...current, user: current.user ? { ...current.user, ...avatar } : undefined }))}/></div>
        <div className="profile-name"><div className="profile-name-line"><h1>{name}</h1><span className="profile-profession"><BriefcaseBusiness size={13}/>{profession}</span></div>{me.user?.username && <p className="profile-handle">@{me.user.username}</p>}<p className="profile-bio">{bio}</p><div className="profile-counts"><button type="button" onClick={() => selectTab("bai-viet-cua-toi")}><b>{me.counts?.posts ?? 0}</b> bài viết</button><button type="button" onClick={() => { setConnectionFilter("follow"); selectTab("ket-noi"); }}><b>{following.length}</b> đang theo dõi</button><button type="button" onClick={() => { setConnectionFilter("friend"); selectTab("ket-noi"); }}><b>{friends.length}</b> bạn bè</button></div></div>
        <div className="profile-header-actions"><button type="button" className="profile-button profile-button-primary" onClick={() => selectTab("cai-dat", "cai-dat", true)}><Settings size={16}/>Cài đặt hồ sơ</button>{me.user?.id && <a className="profile-button" href={`/nguoi-dung/${encodeURIComponent(me.user.id)}`}><ExternalLink size={16}/>Xem hồ sơ công khai</a>}</div>
      </div>
      <div className="profile-tabs" role="tablist" aria-label="Nội dung hồ sơ">{tabs.map(({ id, label, Icon }, index) => <button key={id} ref={element => { tabRefs.current[index] = element; }} type="button" role="tab" id={`tab-${id}`} aria-selected={activeTab === id} aria-controls={`panel-${id}`} tabIndex={activeTab === id ? 0 : -1} onClick={() => selectTab(id)} onKeyDown={event => {
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault(); selectTab(tabs[next].id); tabRefs.current[next]?.focus();
      }}><Icon size={18}/><span>{label}</span>{id === "mau-ua-thich" && saved.length > 0 && <small>{saved.length}</small>}</button>)}</div>
    </section>

    {error && <div role="alert" className="profile-load-error">{error}<button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Thử lại</button></div>}
    <div className="profile-body" ref={contentRef}>
      <aside className="profile-sidebar">
        <section className="profile-card"><h2><Info size={18}/>Giới thiệu</h2><p className="profile-muted profile-intro">{bio}</p><div className="profile-intro-row"><BriefcaseBusiness size={17}/><span>{profession} tại cộng đồng NhàĐẹpChất</span></div>{me.user?.email && <div className="profile-intro-row"><Mail size={17}/><span className="break-all">{me.user.email}</span></div>}<button type="button" className="profile-button profile-button-full" onClick={() => selectTab("cai-dat", "cai-dat", true)}>Thông tin tài khoản<ChevronRight size={15}/></button></section>
        <section className="profile-card"><div className="profile-card-heading"><h2><Heart size={18} className="text-rose-500"/>Mẫu ưa thích</h2><button type="button" onClick={() => selectTab("mau-ua-thich", "mau-ua-thich", true)}>Xem tất cả</button></div>{favoriteModels.length ? <div className="profile-favorites-preview">{favoriteModels.slice(0, 3).map(item => <a key={item.id} href={actionHref(item)}><span className="profile-favorite-icon"><Heart size={16}/></span><span>{item.targetId}<small>{targetLabels[item.targetType] || "Nội dung"}</small></span><ChevronRight size={15}/></a>)}</div> : <p className="profile-muted profile-intro">Lưu mẫu nhà bạn thích để dễ tìm lại khi cần.</p>}</section>
        <section className="profile-card profile-shortcuts"><h2>Truy cập nhanh</h2><button type="button" onClick={() => selectTab("vi-nhadepchat", "vi-nhadepchat", true)}><WalletCards size={18}/><span>Ví & lịch sử giao dịch</span><ChevronRight size={15}/></button><button type="button" onClick={() => selectTab("cai-dat", "yeu-cau", true)}><FileText size={18}/><span>Yêu cầu của bạn</span><small>{requests.length}</small></button>{me.user?.passwordAccount && <button type="button" onClick={() => selectTab("cai-dat", "bao-mat", true)}><ShieldCheck size={18}/><span>Mật khẩu & bảo mật</span><ChevronRight size={15}/></button>}</section>
        <p className="profile-sidebar-note">Trang cá nhân · Cộng đồng NhàĐẹpChất</p>
      </aside>

      <div className="profile-content" aria-busy={loading}>
        {panel("bai-viet-cua-toi", <MyPosts author={me.user}/>)}
        {panel("mau-ua-thich", <section id="mau-ua-thich" className="profile-card"><div className="profile-card-heading"><h2><Bookmark size={20}/>Nội dung đã lưu</h2><span className="profile-total">{saved.length} nội dung</span></div><p className="profile-muted">Những ý tưởng và nội dung bạn muốn xem lại.</p><div className="profile-saved-grid">{saved.map(item => <a className="profile-saved-item" key={item.id} href={actionHref(item)}><span className="profile-saved-symbol"><Bookmark size={24}/></span><span className="min-w-0"><small>{targetLabels[item.targetType] || "Nội dung"}</small><strong>{item.targetId}</strong></span><ArrowRight size={17}/></a>)}</div>{!saved.length && <EmptyState icon={Bookmark} title="Lưu lại ý tưởng bạn yêu thích">Nhấn biểu tượng lưu hoặc trái tim trên nội dung để thêm vào đây. <a href="/kho-mau-nha-dep-chat">Khám phá mẫu nhà<ArrowRight size={14}/></a></EmptyState>}</section>)}
        {panel("ket-noi", <section id="ket-noi" className="profile-card"><h2><Users size={20}/>Kết nối của bạn</h2><p className="profile-muted">Những thành viên bạn kết bạn và theo dõi trên NhàĐẹpChất.</p><div className="profile-filters" aria-label="Lọc kết nối">{([{ id: "all", label: "Tất cả" }, { id: "follow", label: `Đang theo dõi (${following.length})` }, { id: "friend", label: `Bạn bè (${friends.length})` }] as const).map(item => <button key={item.id} type="button" aria-pressed={connectionFilter === item.id} onClick={() => setConnectionFilter(item.id)}>{item.label}</button>)}</div><div className="profile-connections">{connections.map(item => <a key={item.id} href={`/nguoi-dung/${encodeURIComponent(item.id)}`}><MemberAvatar name={item.member?.name || "Thành viên"} src={item.member?.avatarUrl} className="size-12 text-lg"/><span className="min-w-0"><strong>{item.member?.name || "Thành viên NhàĐẹpChất"}</strong><small>{[item.following ? "Đang theo dõi" : "", item.friend ? "Bạn bè" : ""].filter(Boolean).join(" · ")}</small></span><ChevronRight size={17}/></a>)}</div>{!connections.length && <EmptyState icon={UserPlus} title="Mở rộng kết nối của bạn">Theo dõi hoặc kết bạn trên hồ sơ thành viên để giữ liên lạc và xem thêm nội dung.</EmptyState>}</section>)}
        {panel("tin-nhan", <InboxPanel active={activeTab === "tin-nhan"}/>)}
        {panel("vi-nhadepchat", <WalletPanel/>)}
        {panel("cai-dat", <div className="profile-settings">
          <section id="cai-dat" className="profile-card"><h2><Settings size={20}/>Thông tin tài khoản</h2><p className="profile-muted">Thông tin liên hệ và các tùy chọn dành riêng cho bạn.</p><dl className="profile-details"><div><dt>Họ và tên</dt><dd>{me.user?.name || "Chưa cập nhật"}</dd></div><div><dt>Tên người dùng</dt><dd>{me.user?.username ? `@${me.user.username}` : "Chưa cập nhật"}</dd></div><div><dt>Email</dt><dd>{me.user?.email || "Chưa cập nhật"}</dd></div><div><dt>Loại tài khoản</dt><dd>{profession}</dd></div></dl></section>
          <section id="kenh-nhan-tin" className="profile-card"><h2><Mail size={20}/>Kênh nhận tin</h2><p className="profile-muted">Chọn kênh để nhận phản hồi và nội dung được gửi cho bạn.</p><form onSubmit={event => { event.preventDefault(); void saveDelivery(); }}><div className="profile-delivery-fields">{([{ key: "zaloUserId", label: "Zalo", placeholder: "Zalo User ID" }, { key: "messengerPsid", label: "Messenger", placeholder: "Messenger PSID" }, { key: "telegramChatId", label: "Telegram", placeholder: "Telegram Chat ID" }] as const).map(field => <label key={field.key}>{field.label}<input disabled={savingDelivery || loading || !deliveryLoaded} value={delivery[field.key] ?? ""} onChange={event => setDelivery(current => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder}/></label>)}</div><details className="profile-delivery-help"><summary>Cách lấy thông tin kênh nhận tin</summary><p>Dùng ID do Zalo OA, Messenger hoặc Telegram Bot cung cấp để kết nối kênh. Bạn có thể để trống những kênh chưa sử dụng.</p></details><div className="profile-save-row"><p role="status">{deliveryNotice}</p><button disabled={savingDelivery || loading || !deliveryLoaded} className="profile-button profile-button-primary">{savingDelivery && <LoaderCircle size={16} className="animate-spin"/>}{savingDelivery ? "Đang lưu…" : "Lưu kênh nhận tin"}</button></div></form></section>
          {me.user?.passwordAccount && <section id="bao-mat" className="profile-card"><h2><ShieldCheck size={20}/>Mật khẩu & bảo mật</h2><div className="mt-4"><PasswordChange admin={me.user.isAdmin}/></div></section>}
          <section id="yeu-cau" className="profile-card"><div className="profile-card-heading"><h2><FileText size={20}/>Yêu cầu của bạn</h2><span className="profile-total">{requests.length} yêu cầu</span></div><div className="profile-request-list">{requests.map(item => <article key={item.id}><div><h3>{item.subject}</h3><p>{requestLabels[item.requestType] || "Yêu cầu hỗ trợ"}{item.createdAt && ` · ${new Date(item.createdAt).toLocaleDateString("vi-VN")}`}</p></div><span className="profile-status" data-status={item.status}>{statusLabels[item.status] || "Đã tiếp nhận"}</span></article>)}</div>{!requests.length && <EmptyState icon={FileText} title="Chưa có yêu cầu">Các yêu cầu tư vấn, hỗ trợ và nhận tài liệu sẽ xuất hiện tại đây.</EmptyState>}</section>
          <section className="profile-card"><h2>Hoạt động gần đây</h2><div className="profile-activity">{actions.slice(0, 10).map(item => <a key={item.id} href={actionHref(item)}><span className="profile-activity-dot"/><span><strong>{item.targetType === "profile" ? members.find(member => member.id === item.targetId)?.name || "Thành viên NhàĐẹpChất" : item.targetId}</strong><small>{actionLabels[item.actionType] || "Đã tương tác"} · {targetLabels[item.targetType] || "Nội dung"}</small></span><ChevronRight size={15}/></a>)}</div>{!actions.length && <p className="profile-muted profile-intro">Chưa có hoạt động gần đây.</p>}</section>
        </div>)}
      </div>
    </div>
  </main>;
}
