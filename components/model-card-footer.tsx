"use client";

import { MessageCircle } from "lucide-react";
import { RequestActionButton } from "@/components/interactive-actions";

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
    <div className="mt-3 flex items-center justify-between border-t border-[#e8eef5] pt-2 text-[11px] text-[#667085]"><span>{comments} bình luận</span><span>{expertQuestions} câu hỏi</span></div>
    <div className="mt-1 grid grid-cols-2 border-t border-[#edf1f5] pt-1">
      <button type="button" onClick={onToggleComments} aria-label="Bình luận" aria-expanded={commentOpen} title="Bình luận" className={`grid place-items-center rounded-lg py-2.5 hover:bg-[#f2f4f7] ${commentOpen ? "text-[#168ac0]" : "text-[#475467]"}`}><MessageCircle size={19}/></button>
      <RequestActionButton requestType="expert-question" targetType={targetType} targetId={targetId} label="Hỏi chuyên gia" title={"Hỏi chuyên gia: " + title} description={"Mẫu tham khảo: " + meta + ". Hãy nhập câu hỏi bạn muốn chuyên gia giải đáp."} allowFile iconOnly="expert" recipientUserId={recipientUserId} onSuccess={onQuestionSent} className="grid place-items-center rounded-lg py-2.5 text-[#475467] hover:bg-[#f2f4f7]"/>
    </div>
  </>;
}
