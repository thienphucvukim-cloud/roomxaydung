"use client";

import { useEffect, useState, type CSSProperties } from "react";
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
  const [prefetchIndex, setPrefetchIndex] = useState<number | null>(null);
  const [previousActiveIndex, setPreviousActiveIndex] = useState(activeIndex);
  // Pointer focus can outlive a route change (including Back/Forward).
  if (previousActiveIndex !== activeIndex) {
    setPreviousActiveIndex(activeIndex);
    setFocusedIndex(null);
  }
  const highlightedIndex = hoveredIndex ?? focusedIndex ?? activeIndex;
  const intentIndex = mobile ? null : hoveredIndex ?? focusedIndex;

  useEffect(() => {
    if (intentIndex === null || intentIndex === activeIndex) return;
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    if (connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType ?? "")) return;
    // A brief dwell avoids warming every page while moving across the menu.
    const timer = window.setTimeout(() => setPrefetchIndex(intentIndex), 180);
    return () => window.clearTimeout(timer);
  }, [intentIndex, activeIndex]);

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
        prefetch={intentIndex === index && prefetchIndex === index && !active}
        title={itemLabel}
        aria-label={itemLabel}
        aria-current={active ? "page" : undefined}
        data-highlighted={index === highlightedIndex}
        className={`animated-tab-link ${mobile ? "mobile-dock-link" : "desktop-tab-link"}`}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") setHoveredIndex(index);
        }}
        onFocus={() => setFocusedIndex(index)}
      >
        <Icon className="animated-tab-icon" size={mobile ? 22 : 23} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
        <span className={mobile ? "sr-only" : "animated-tab-label"}>{itemLabel}</span>
      </ClientNavigationLink>;
    })}
  </nav>;
}
