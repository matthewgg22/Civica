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
      className="bg-pine/8 border border-pine/25 rounded-[4px] px-5 py-3.5 flex items-start gap-4"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-bold text-pine mb-1">
          Welcome to Civica
        </p>
        <p className="text-[13px] text-graphite leading-relaxed">
          Below: counts on the left are org-wide priorities; counts on the right are
          your activity today. Click any number to drill in.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss welcome message"
        className="text-pine/60 hover:text-pine transition-colors shrink-0 -mt-0.5"
      >
        <svg
          width="16"
          height="16"
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
