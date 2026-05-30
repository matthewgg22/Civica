"use client";

import { useEffect, useState } from "react";

/**
 * OutreachWelcomeBanner — a dismissible "how this queue works" card on
 * /outreach. Helps first-time navigators orient. Once dismissed, never
 * shown again for that browser (localStorage).
 *
 * SSR-safe: returns null until `mounted` flips to true in useEffect, so the
 * server never renders the banner and the client matches that empty initial
 * render before checking localStorage. No flash of unstyled content.
 *
 * Persistence is per-browser (not per-user-server-side) on purpose: this is
 * a UX nicety, not a settings record. If a navigator clears storage they
 * see the banner again — that's fine.
 *
 * Future: replace with a fuller onboarding tour. This is the foundation.
 */
const STORAGE_KEY = "civica.outreach.welcomeDismissed";

export default function OutreachWelcomeBanner() {
  // mounted=false on first render so SSR matches the client's empty render.
  // dismissed=true initially so we don't flash the banner before reading
  // localStorage.
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setDismissed(stored === "dismissed");
    } catch {
      // localStorage can throw (Safari private mode, etc.). Treat as
      // not-dismissed — showing the banner is the conservative default.
      setDismissed(false);
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      // If storage fails the dismiss-this-mount still works; the banner
      // will reappear on next navigation. Acceptable degradation.
    }
  }

  if (!mounted) return null;
  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="How the outreach queue works"
      className="relative bg-surface border border-hairline rounded-[4px] p-5 md:p-6 mb-6"
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss welcome banner"
        className="absolute top-3 right-3 text-muted hover:text-ink transition-colors text-[18px] leading-none w-6 h-6 flex items-center justify-center rounded-[4px] hover:bg-paper"
      >
        ×
      </button>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-graphite mb-2">
        How this queue works
      </p>
      <p className="text-[14px] text-ink leading-relaxed pr-6">
        Welcome to your queue. Each row is an applicant Civica has paged you
        to follow up with. The colored badges show urgency: red = overdue,
        amber = due within 2 hours, gray = on track.
      </p>
      <div className="mt-4">
        <button
          type="button"
          onClick={handleDismiss}
          className="px-3 py-1.5 rounded-[4px] text-[13px] font-semibold bg-ink text-paper hover:bg-graphite transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
