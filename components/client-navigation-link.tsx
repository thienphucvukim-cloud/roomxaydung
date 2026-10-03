"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type ClientNavigationLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export function ClientNavigationLink({ prefetch = false, onNavigate, ...props }: ClientNavigationLinkProps) {
  const router = useRouter();
  return <Link {...props} prefetch={prefetch} onNavigate={event => {
    let cancelled = false;
    onNavigate?.({ preventDefault: () => { cancelled = true; event.preventDefault(); } });
    if (cancelled) return;
    event.preventDefault();
    // Programmatic transitions safely supersede an ongoing content refresh.
    if (props.replace) router.replace(props.href, { scroll: props.scroll });
    else router.push(props.href, { scroll: props.scroll });
  }} />;
}
