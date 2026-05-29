"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type NavItem = { key: string; href: string; label: string };

/**
 * Mobile-only nav dropdown. Renders a hamburger button that pops a
 * pine-bg panel with the same nav items as the desktop tab strip.
 * Visible only at <md (768px); desktop hides this entirely via the
 * outer wrapper's `md:hidden` class.
 *
 * Mirrors the active-tab styling from AppHeader's <NavTab>: white/15
 * background on active, white/65 idle, white/10 hover.
 */
export default function MobileNavMenu({
  items,
  active,
}: {
  items: NavItem[];
  active: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="inline-flex items-center justify-center w-11 h-11 rounded-[4px] text-white/65 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M5 5l10 10M15 5L5 15" />
          ) : (
            <path d="M3 6h14M3 10h14M3 14h14" />
          )}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          role="menu"
          className="absolute right-0 top-full mt-1 w-56 bg-pine border border-white/15 rounded-[4px] shadow-lg py-1.5 z-50"
        >
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-[13px] font-semibold transition-colors ${
                active === item.key
                  ? "bg-white/15 text-white"
                  : "text-white/65 hover:text-white hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
