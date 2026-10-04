"use client";

import { useEffect, useRef } from "react";

export function usePostAnchor(posts: readonly { id: number }[]) {
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    const scroll = () => {
      const href = window.location.pathname + window.location.search + window.location.hash;
      if (scrolledTo.current === href) return;
      const anchor = window.location.hash.slice(1);
      const post = /^post-\d+$/.test(anchor) || anchor.startsWith("model-") ? document.getElementById(anchor) : null;
      if (post) { post.scrollIntoView({ block: "start" }); scrolledTo.current = href; }
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, [posts]);
}
