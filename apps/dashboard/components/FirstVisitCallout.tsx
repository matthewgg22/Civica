"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "civica:dashboard-welcome-dismissed";

/**
 * FirstVisitCallout — dismissible welcome banner shown above the
 * dashboard UrgentBanner on a navigator's first visit. Explains the
 * morning-briefing pattern (org-wide urgency on the left, "Mine
 * Today" personal activity on the right) so a new hire doesn't have
 * to infer the layout from context.
 *
 * Persists dismissal in localStorage so the callout shows exactly
 * once per browser per user. SSR-safe: renders nothing during
 * hydration (when dismissed state is still null) so the server HTML
 * and client HTML match.
 */
export default function FirstVisitCallout() {
  // null = not yet hydrated; true = dismissed; false = show
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Render nothing during SSR / pre-hydration, and after dismissal.
  if (dismissed !== false) return null;

  return (
    <div
      role="region"
      aria-label="Welcome message"
      className="bg-pine/8 border border-pine/25 rounded-[4px] px-4 py-2 flex items-center gap-3"
    >
      <span className="text-[11px] uppercase tracking-wider font-bold text-pine shrink-0">
        Welcome
      </span>
      <p className="text-[12px] text-graphite leading-snug flex-1 min-w-0">
        Left = org-wide priorities. Right = your activity today. Click any number to drill in.
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss welcome message"
        className="text-pine/60 hover:text-pine transition-colors shrink-0"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
