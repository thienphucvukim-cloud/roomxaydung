"use client";

import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { startTransition } from "react";

type ClientNavigationLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
};

export function ClientNavigationLink({ href, onClick, target, children, ...props }: ClientNavigationLinkProps) {
  const router = useRouter();

  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === "_blank"
    ) return;

    event.preventDefault();
    startTransition(() => router.push(href));
  };

  return <a {...props} href={href} target={target} onClick={navigate}>{children}</a>;
}
