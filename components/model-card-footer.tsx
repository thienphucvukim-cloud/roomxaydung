"use client";

import { MessageCircle } from "lucide-react";
import { RequestActionButton, ShareActionButton, ToggleActionButton } from "@/components/interactive-actions";
import { CatalogEngagementStats } from "@/components/catalog-engagement";
import { houseModelHref } from "@/lib/house-model-links";

export function ModelCardFooter({ title, meta, targetType, targetId, recipientUserId, comments, expertQuestions, commentOpen, onToggleComments, onQuestionSent }: {
  title: string;
  meta: string;
  targetType: "house-model" | "post";
  targetId: string;
  recipientUserId: string;
  comments: number;
  expertQuestions: number;
  commentOpen: boolean;
  onToggleComments: () => void;
  onQuestionSent: () => void;
}) {
  return <>
    <div className="mt-1 flex items-center gap-3 text-xs text-[#667085]">
      <CatalogEngagementStats targetType={targetType} targetId={targetId} mode="views" layout="compact"/>
      <button type="button" onClick={onToggleComments} aria-label={`Bình luận (${comments})`} aria-expanded={commentOpen} title="Bình luận" className={`inline-flex min-h-8 items-center gap-1.5 rounded-md hover:text-[#168ac0] ${commentOpen ? "text-[#168ac0]" : "text-[#667085]"}`}><MessageCircle size={15} aria-hidden="true"/><span className="tabular-nums">{comments}</span></button>
      <ToggleActionButton actionType="like" targetType={targetType} targetId={targetId} label="Yêu thích" activeLabel="Bỏ yêu thích" icon="heart" showCount className="inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs text-[#667085] hover:text-rose-500 disabled:opacity-50 [&>svg]:size-[15px]"/>
      <ShareActionButton title={title} url={targetType === "post" ? `/bai-viet/${targetId}` : houseModelHref(title)} targetType={targetType} targetId={targetId} iconOnly className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[#667085] hover:bg-[#eef9fd] hover:text-[#168ac0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168ac0] disabled:opacity-50 [&>svg]:size-[15px]"/>
      <RequestActionButton requestType="expert-question" targetType={targetType} targetId={targetId} label={`Hỏi chuyên gia (${expertQuestions})`} title={"Hỏi chuyên gia: " + title} description={"Mẫu tham khảo: " + meta + ". Hãy nhập câu hỏi bạn muốn chuyên gia giải đáp."} allowFile iconOnly="expert" recipientUserId={recipientUserId} onSuccess={onQuestionSent} className="ml-auto grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f0f9ff] to-[#dbeafe] text-[#0284c7] shadow-[0_2px_5px_rgba(2,132,199,.10)] ring-1 ring-inset ring-[#bae6fd] transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 hover:from-white hover:to-[#e0f2fe] hover:shadow-[0_4px_9px_rgba(2,132,199,.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284c7] motion-reduce:transform-none [&>svg]:size-6"/>
    </div>
  </>;
}
