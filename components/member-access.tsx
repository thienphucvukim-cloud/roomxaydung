"use client";

import { useState, type SyntheticEvent, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientNavigationLink } from "@/components/client-navigation-link";
import { useCurrentMember } from "@/components/member-avatar";

function AccountLinks() {
  const pathname = usePathname();
  const returnTo = encodeURIComponent(pathname);
  return <div className="mt-4 flex flex-wrap gap-3"><ClientNavigationLink href={`/dang-ky?return_to=${returnTo}`} className="rounded-xl bg-[#229ed9] px-4 py-2.5 text-sm font-bold text-white">Đăng ký tài khoản</ClientNavigationLink><ClientNavigationLink href={`/dang-nhap?return_to=${returnTo}`} className="rounded-xl border border-[#d0d5dd] px-4 py-2.5 text-sm font-bold text-[#0b2e59]">Đã có tài khoản? Đăng nhập</ClientNavigationLink></div>;
}

export function MemberOnly({ children }: { children: React.ReactNode }) {
  const member = useCurrentMember();
  if (!member.loaded) return <div role="status" className="mx-auto max-w-3xl p-6 text-sm text-[#667085]">Đang kiểm tra tài khoản...</div>;
  if (member.authenticated) return children;
  return <section className="mx-auto my-6 max-w-3xl rounded-2xl border border-[#e3eaf2] bg-white p-6"><h2 className="text-xl font-bold text-[#0b2e59]">Đăng ký để sử dụng chức năng</h2><p className="mt-2 text-sm leading-6 text-[#667085]">Bạn có thể tham quan và xem nội dung công khai. Hãy đăng ký hoặc đăng nhập tài khoản để sử dụng chức năng này.</p><AccountLinks/></section>;
}

export function MemberAccessGate({ children }: { children: React.ReactNode }) {
  const member = useCurrentMember();
  const pathname = usePathname();
  const [requestedPath, setRequestedPath] = useState<string | null>(null);
  const capture = (event: SyntheticEvent) => {
    if (member.authenticated || !(event.target instanceof Element)) return;
    if (!event.target.closest('[data-requires-account], a[href^="/tai-khoan"]')) return;
    event.preventDefault();
    event.stopPropagation();
    setRequestedPath(pathname);
  };
  const keyCapture = (event: KeyboardEvent) => {
    if (event.key === "Tab" || event.key === "Escape" || event.key.startsWith("Arrow")) return;
    capture(event);
  };
  return <div className="contents" onClickCapture={capture} onSubmitCapture={capture} onKeyDownCapture={keyCapture}>
    {children}
    <Dialog open={requestedPath === pathname && !member.authenticated} onOpenChange={open => { if (!open) setRequestedPath(null); }}>
      <DialogContent className="rounded-2xl bg-white sm:max-w-md"><DialogHeader><DialogTitle>{member.loaded ? "Đăng ký để sử dụng chức năng" : "Đang kiểm tra tài khoản..."}</DialogTitle></DialogHeader>{member.loaded && <><p className="text-sm leading-6 text-[#667085]">Khách có thể tham quan website. Vui lòng đăng ký hoặc đăng nhập để tiếp tục.</p><AccountLinks/></>}</DialogContent>
    </Dialog>
  </div>;
}
