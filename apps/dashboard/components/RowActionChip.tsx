"use client";

import { useState } from "react";
import { logAction } from "../lib/action-log";

// Stage-aware action button used in /enrollments LifecycleStage. Click swaps
// the label to a confirmation for 2.5s then reverts. Demo-grade: no backend
// wiring yet, so the click is purely local UI state.
//
// Urgency colors mirror the bucket palettes elsewhere on /enrollments:
//   brick    = critical (overdue / interview missed / 7-day cadence)
//   warning  = action soon (verification open / 30/14-day cadence)
//   amber    = neutral progress (60-day cadence)
//   indigo   = positive scheduled (interview pending)
//
// Component is `"use client"` so it can hold the post-click confirmation
// state — embedding it inside a server component (page.tsx) is fine; React
// Server Components allow client components as children.

type Urgency = "brick" | "warning" | "amber" | "indigo";

const URGENCY_CLASSES: Record<Urgency, { idle: string; confirmed: string }> = {
  brick:   { idle: "bg-brick/10 text-brick hover:bg-brick/20 active:bg-brick/30",            confirmed: "bg-brick text-paper" },
  warning: { idle: "bg-warning/10 text-warning hover:bg-warning/20 active:bg-warning/30",    confirmed: "bg-warning text-paper" },
  amber:   { idle: "bg-amber/10 text-amber hover:bg-amber/20 active:bg-amber/30",            confirmed: "bg-amber text-paper" },
  indigo:  { idle: "bg-indigo/10 text-indigo hover:bg-indigo/20 active:bg-indigo/30",        confirmed: "bg-indigo text-paper" },
};

export default function RowActionChip({
  label,
  confirmedLabel,
  urgency,
  ariaLabel,
  applicantName,
}: {
  label: string;
  confirmedLabel: string;
  urgency: Urgency;
  ariaLabel?: string;
  applicantName?: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const classes = URGENCY_CLASSES[urgency];

  const handleClick = (e: React.MouseEvent) => {
    // The row is a Link, so the chip's click would bubble and navigate the
    // page away. Stop both bubbling and default to keep the click local.
    e.stopPropagation();
    e.preventDefault();
    if (confirmed) return;
    setConfirmed(true);
    logAction(label, applicantName ?? "—");
    setTimeout(() => setConfirmed(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel ?? label}
      className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold px-2 py-1 rounded-[3px] mt-1.5 transition-colors ${
        confirmed ? classes.confirmed : classes.idle
      }`}
    >
      {confirmed ? (
        <>
          <span aria-hidden>✓</span>
          <span>{confirmedLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
