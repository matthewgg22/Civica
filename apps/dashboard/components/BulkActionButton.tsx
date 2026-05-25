"use client";

import { useState } from "react";
import { logAction } from "../lib/action-log";

// Cadence-stage batch executor. Renders inside a Recert Cadence sub-card and,
// on click, fires logAction() once per applicant in that stage — incrementing
// the top-of-page ActionsTakenToday counter by N and writing N entries to the
// per-day log. Confirmation flips for 2.5s then reverts.
//
// The parent sub-card is a Link to the filtered list, so this button uses
// stopPropagation() to keep the click from navigating.

type Urgency = "brick" | "warning" | "amber" | "indigo";

const URGENCY_CLASSES: Record<Urgency, { idle: string; confirmed: string }> = {
  brick:   { idle: "bg-brick text-paper hover:bg-brick/90 active:bg-brick/80",       confirmed: "bg-brick/15 text-brick" },
  warning: { idle: "bg-warning text-paper hover:bg-warning/90 active:bg-warning/80", confirmed: "bg-warning/15 text-warning" },
  amber:   { idle: "bg-amber text-paper hover:bg-amber/90 active:bg-amber/80",       confirmed: "bg-amber/15 text-amber" },
  indigo:  { idle: "bg-indigo text-paper hover:bg-indigo/90 active:bg-indigo/80",    confirmed: "bg-indigo/15 text-indigo" },
};

export default function BulkActionButton({
  label,             // e.g. "Send all 2 notices"
  confirmedLabel,    // e.g. "2 notices queued"
  individualAction,  // per-row label written to the action log (e.g. "Send first notice")
  applicantNames,
  urgency,
}: {
  label: string;
  confirmedLabel: string;
  individualAction: string;
  applicantNames: string[];
  urgency: Urgency;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const classes = URGENCY_CLASSES[urgency];

  if (applicantNames.length === 0) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirmed) return;
    // Fire one log entry per applicant so the daily counter + downstream
    // analytics see real per-household actions rather than a single rollup.
    for (const name of applicantNames) {
      logAction(individualAction, name);
    }
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={`mt-2 w-full inline-flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider font-bold px-2 py-1.5 rounded-[3px] transition-colors ${
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
