"use client";

import { useEffect } from "react";

export function usePostAnchor(posts: readonly { id: number }[]) {
  useEffect(() => {
    const scroll = () => {
      const anchor = window.location.hash.slice(1);
      if (/^post-\d+$/.test(anchor)) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, [posts]);
}
