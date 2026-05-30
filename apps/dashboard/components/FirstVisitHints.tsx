"use client";

import { useState, useEffect } from "react";

/**
 * App-level first-visit hints, rendered just below the AppHeader. Each hint
 * has its own dismissal key + dismiss button so a user who dismisses one
 * still sees the others until they earn their dismiss.
 *
 * Currently surfaces:
 *   • nav-trim — explains where Why Civica + Findings went after PR2
 *     reduced the primary nav from 8 to 6 tabs.
 *   • palette  — discovers the ⌘K command palette (jump-to-packet).
 *
 * Per /plan-design-review E7 + T16 + /plan-ceo-review honest-deferral
 * follow-up: shipped as a NEW component rather than a variant of
 * FirstVisitCallout so it never touches that file's locked surface.
 *
 * SSR-safe: dismissed state initializes null until hydrated, so server
 * and client render the same empty output. localStorage reads/writes are
 * wrapped in try/catch because private-browsing modes throw SecurityError.
 */

const HINT_KEYS = {
  navTrim: "civica:nav-trim-hint-dismissed",
  palette: "civica:palette-hint-dismissed",
} as const;

type HintKey = keyof typeof HINT_KEYS;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private browsing — dismissal won't persist; UI still hides for session */
  }
}

export default function FirstVisitHints() {
  // null = not yet hydrated, true = dismissed, false = visible
  const [navTrim, setNavTrim] = useState<boolean | null>(null);
  const [palette, setPalette] = useState<boolean | null>(null);

  useEffect(() => {
    setNavTrim(safeGetItem(HINT_KEYS.navTrim) === "1");
    setPalette(safeGetItem(HINT_KEYS.palette) === "1");
  }, []);

  function dismiss(key: HintKey) {
    safeSetItem(HINT_KEYS[key], "1");
    if (key === "navTrim") setNavTrim(true);
    if (key === "palette") setPalette(true);
  }

  // Don't render until we know dismissal state (avoids SSR mismatch).
  if (navTrim === null || palette === null) return null;

  const showNavTrim = navTrim === false;
  const showPalette = palette === false;
  if (!showNavTrim && !showPalette) return null;

  return (
    <div className="bg-pine/5 border-b border-pine/15">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-2 space-y-1.5">
        {showNavTrim && (
          <Hint
            label="Welcome"
            body={
              <>
                Looking for <span className="font-semibold text-ink">Why Civica</span> or{" "}
                <span className="font-semibold text-ink">Findings</span>? They moved to the{" "}
                <span className="font-semibold text-ink">Share ↓</span> dropdown on the right.
              </>
            }
            onDismiss={() => dismiss("navTrim")}
          />
        )}
        {showPalette && (
          <Hint
            label="Tip"
            body={
              <>
                Press{" "}
                <kbd className="font-mono text-[11px] bg-surface border border-hairline rounded px-1 py-0.5">
                  ⌘K
                </kbd>{" "}
                to jump to any packet by name or ID — or run a quick navigator action.
              </>
            }
            onDismiss={() => dismiss("palette")}
          />
        )}
      </div>
    </div>
  );
}

function Hint({
  label,
  body,
  onDismiss,
}: {
  label: string;
  body: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      role="region"
      aria-label={`${label} message`}
      className="flex items-center gap-3"
    >
      <span className="text-[10px] uppercase tracking-wider font-bold text-pine shrink-0">
        {label}
      </span>
      <p className="text-[12px] text-graphite leading-snug flex-1 min-w-0">{body}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dismiss ${label.toLowerCase()} message`}
        className="text-pine/60 hover:text-pine transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-pine/30 rounded-[2px]"
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
