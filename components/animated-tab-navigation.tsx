"use client";

import { useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ClientNavigationLink } from "@/components/client-navigation-link";

type NavigationItem = readonly [label: string, href: string, icon: LucideIcon];

export function AnimatedTabNavigation({ items, activeIndex, className, label, mobile = false }: {
  items: readonly NavigationItem[];
  activeIndex: number;
  className: string;
  label: string;
  mobile?: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const highlightedIndex = hoveredIndex ?? focusedIndex ?? activeIndex;

  return <nav
    className={`animated-tab-nav ${className}`}
    aria-label={label}
    style={{ "--tab-count": items.length, "--tab-index": Math.max(0, highlightedIndex) } as CSSProperties}
    onPointerLeave={() => setHoveredIndex(null)}
    onPointerCancel={() => setHoveredIndex(null)}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocusedIndex(null);
    }}
  >
    <span className="tab-liquid-light" data-visible={highlightedIndex >= 0} aria-hidden="true" />
    {items.map(([itemLabel, href, Icon], index) => {
      const active = index === activeIndex;
      return <ClientNavigationLink
        key={href}
        href={href}
        title={itemLabel}
        aria-current={active ? "page" : undefined}
        data-highlighted={index === highlightedIndex}
        className={`animated-tab-link ${mobile ? "mobile-dock-link" : "desktop-tab-link"}`}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") setHoveredIndex(index);
        }}
        onFocus={() => setFocusedIndex(index)}
      >
        <Icon className="animated-tab-icon" size={mobile ? 20 : 23} strokeWidth={active ? 2.4 : 1.9} />
        <span className="animated-tab-label">{itemLabel}</span>
      </ClientNavigationLink>;
    })}
  </nav>;
}
