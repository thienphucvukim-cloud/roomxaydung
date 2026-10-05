"use client";
import { postHref } from "@/lib/post-url";
import { ClientNavigationLink } from "@/components/client-navigation-link";
import { NEWS_SOURCES } from "@/lib/news-feed";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, FileText, Info, Mail, MapPin } from "lucide-react";
import { MyPosts } from "@/components/my-posts";
import { OwnerPostControls } from "@/components/site-editor";
import { ProfileActions } from "@/components/profile-actions";
import { MemberAvatar } from "@/components/member-avatar";
import type { PublicProfileData as Profile } from "@/lib/public-profile-data";
export function PublicProfile({ id: userId, initialProfile }: { id: string; initialProfile?: Profile }) {
  const [result, setResult] = useState<{ id:string; profile?:Profile; error?:string } | null>(initialProfile ? { id: userId, profile: initialProfile } : null);
  useEffect(() => {
    const controller=new AbortController();
    fetch('/api/public-profile/'+encodeURIComponent(userId),{cache:'no-store',signal:controller.signal}).then(async response => {
      const data=await response.json() as Profile & {error?:string};
      if(!response.ok) throw new Error(data.error || 'Chưa thể tải hồ sơ.');
      if(!controller.signal.aborted) setResult({id:userId,profile:data});
    }).catch(error => {if(!controller.signal.aborted) setResult({id:userId,error:error instanceof Error ? error.message : 'Chưa thể tải hồ sơ.'});});
    return () => controller.abort();
  }, [userId]);
  if(result?.id !== userId) return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8" role="status">Đang tải hồ sơ…</main>;
  if(!result.profile) return <main className="mx-auto min-h-screen max-w-5xl px-4 py-8" role="alert">{result.error}</main>;
  const {displayName,avatarUrl,profession,bio,location,own,authoredPosts}=result.profile;

  return <main className="mx-auto min-h-[calc(100vh-72px)] max-w-5xl px-4 py-8 lg:px-8">
    <section className="overflow-hidden rounded-3xl border border-[#dfe8f1] bg-white shadow-sm">
      <div className="h-36 bg-gradient-to-r from-[#073b74] via-[#0d6594] to-[#229ed9] sm:h-48"/>
      <div className="px-5 pb-6 sm:px-8"><div className="-mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-end gap-3"><MemberAvatar name={displayName} src={avatarUrl} className="size-24 border-4 border-white text-4xl shadow-sm"/><h1 className="pb-2 text-xl font-extrabold text-[#0b2e59]">{displayName}</h1></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#667085]"><span className="flex items-center gap-2"><BriefcaseBusiness size={16}/>{profession}</span>{location && <span className="flex items-center gap-2"><MapPin size={16}/>{location}</span>}<span className="flex items-center gap-2"><FileText size={16}/>{authoredPosts.length} bài đăng</span></div></div></div><p className="mt-4 max-w-2xl leading-7 text-[#536273]">{bio}</p>{!own && <ProfileActions userId={userId}/>}</div>
    </section>

    <section className="mt-6 grid gap-5 md:grid-cols-2">
      <article className="rounded-2xl border border-[#e3eaf2] bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><Info size={20}/>Thông tin giới thiệu</h2><p className="mt-3 text-sm leading-7 text-[#667085]">{bio}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#536273]"><span className="rounded-full bg-[#f1f5f9] px-3 py-1.5">{profession}</span>{location && <span className="rounded-full bg-[#f1f5f9] px-3 py-1.5">{location}</span>}</div></article>
      <article className="rounded-2xl border border-[#e3eaf2] bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-bold text-[#0b2e59]"><Mail size={20}/>Thông tin liên hệ</h2><p className="mt-3 text-sm leading-7 text-[#667085]">Thông tin liên hệ cá nhân được bảo vệ. Hãy dùng biểu mẫu yêu cầu trên từng nội dung để liên hệ đúng mục đích.</p></article>
    </section>

    {own && <MyPosts/>}
    <section className="mt-6"><h1 className="text-xl font-extrabold text-[#0b2e59]">Bài viết của {displayName}</h1>{authoredPosts.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{authoredPosts.map((post) => { const image = post.imageUrl; return <article key={post.id} className="overflow-hidden rounded-2xl border border-[#e3eaf2] bg-white shadow-sm">{image ? <img src={image} alt={post.title} className="aspect-[4/3] w-full object-cover"/> : <div className="grid aspect-[4/3] place-items-center bg-[#f3f6f9] text-[#8aa0b5]"><FileText size={38}/></div>}<div className="p-4"><p className="text-xs font-bold text-[#168ac0]">{post.category}</p><OwnerPostControls postId={post.id} authorId={post.userId}/><h2 className="mt-1 line-clamp-2 font-extrabold text-[#182230]">{NEWS_SOURCES.some(source => source.category === post.category) ? <ClientNavigationLink href={postHref(post)} className="hover:text-[#168ac0] hover:underline">{post.title}</ClientNavigationLink> : post.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#667085]">{post.content}</p></div></article>; })}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#d0d5dd] bg-white py-14 text-center text-sm text-[#667085]">Người dùng này chưa có bài đăng công khai.</div>}</section>
  </main>;
}

