"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function PostCommentPanel({ open, onOpenChange, title, image, meta, content, children, postId, modelQuery }: {
  postId?: number;
  modelQuery?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  image?: string;
  meta?: string;
  content?: string;
  children: ReactNode;
}) {
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent data-auth-post-id={postId} data-auth-model-query={modelQuery} side="right" showCloseButton={false} className="h-dvh w-full gap-0 overflow-hidden bg-white p-0 sm:max-w-[480px]">
      <SheetHeader className="shrink-0 border-b border-[#e3eaf2] pr-14">
        <SheetTitle className="text-lg font-extrabold text-[#0b2e59]">{title}</SheetTitle>
        <SheetDescription>Bài viết và bình luận</SheetDescription>
        <SheetClose className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-[#eef1f4] text-[#475467] hover:bg-[#e4e6eb]" aria-label="Đóng bình luận"><X size={18}/></SheetClose>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-3 border-b border-[#e3eaf2] p-4">
          {image && <img src={image} alt={title} className="max-h-[35dvh] w-full rounded-xl bg-[#f4f7fb] object-contain"/>}
          {meta && <p className="text-sm text-[#667085]">{meta}</p>}
          {content && <p className="whitespace-pre-wrap text-sm leading-6 text-[#344054]">{content}</p>}
        </div>
        <section aria-label="Bình luận" className="space-y-3 bg-[#fbfcfd] p-4">
          <h2 className="text-sm font-bold text-[#182230]">Bình luận</h2>
          {children}
        </section>
      </div>
    </SheetContent>
  </Sheet>;
}
