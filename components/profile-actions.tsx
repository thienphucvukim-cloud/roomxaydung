"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { ToggleActionButton } from "@/components/interactive-actions";

export function ProfileActions({ userId }: { userId: string }) {
  const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#c9d8e6] bg-white px-4 text-sm font-bold text-[#0b2e59] transition hover:border-[#229ed9] hover:bg-[#eef9fd]";

  return <div className="mt-5 flex flex-wrap gap-2">
    <ToggleActionButton actionType="follow" targetType="profile" targetId={userId} label="Theo dõi" activeLabel="Đang theo dõi" icon="follow" className={buttonClass}/>
    <ToggleActionButton actionType="friend" targetType="profile" targetId={userId} label="Kết bạn" activeLabel="Đã kết bạn" icon="follow" className={buttonClass}/>
    <Link href={`/chat?user=${encodeURIComponent(userId)}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#229ed9] px-4 text-sm font-bold text-white transition hover:bg-[#168ac0]"><MessageCircle size={17}/>Nhắn tin</Link>
  </div>;
}
