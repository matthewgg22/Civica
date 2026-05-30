"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/**
 * Right-anchored "Share ↓" dropdown that holds the partner-facing surfaces
 * (Why Civica / Findings) demoted from the primary nav per
 * /plan-design-review D8.
 *
 * Mirrors MobileNavMenu's interaction model (outside-click closes,
 * Escape closes, role="menu" + menuitem semantics) so navigator muscle
 * memory transfers cleanly. Initial open state is always false so SSR +
 * hydration match. The active prop just highlights the trigger when the
 * current route is one of the contained items — the menu itself does NOT
 * auto-open on hydration (would surprise the user and break the
 * server-rendered HTML match).
 *
 * Per /plan-ceo-review Section 2.3 / D8: ALL interactivity gated behind
 * the open state so the server-rendered tree is a button + nothing else.
 */

type ShareItem = {
  key: string;
  href: string;
  label: string;
};

const SHARE_ITEMS: ShareItem[] = [
  { key: "compliance", href: "/compliance", label: "Why Civica" },
  { key: "findings", href: "/findings", label: "Findings" },
];

export default function ShareDropdown({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActiveInside = active === "compliance" || active === "findings";

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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="share-menu-panel"
        aria-current={isActiveInside ? "true" : undefined}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-[4px] text-[13px] font-semibold transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-white/30 ${
          isActiveInside
            ? "bg-white/15 text-white"
            : "text-white/55 hover:text-white hover:bg-white/10"
        }`}
      >
        Share
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div
          id="share-menu-panel"
          role="menu"
          className="absolute right-0 top-full mt-1 w-44 bg-pine border border-white/15 rounded-[4px] shadow-lg py-1.5 z-50"
        >
          {SHARE_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              aria-current={active === item.key ? "page" : undefined}
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
