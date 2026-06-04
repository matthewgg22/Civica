"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "civica.county-outcome-roadmap-acknowledged";

/**
 * CountyOutcomeRoadmapCard — dismissible banner that surfaces the Payment
 * Integrity Engine's "built but dormant, awaiting county handshake" state to
 * caseworkers and demo audiences.
 *
 * Placement: TOP of the packet detail page, above all <Section> and
 * <EvidenceSection> blocks. Explains that once counties send outcomes via the
 * /county/outcome webhook, the engine will reconcile each determination against
 * the county's authoritative answer — turning eligibility consistency (verified
 * internally) into measured payment accuracy (verified externally).
 *
 * Copy is LOCKED from CEO review addendum 2026-06-04. Do not modify.
 *
 * Design decisions:
 *   D2 (design) = A: Top banner using FirstVisitCallout pattern.
 *   D3 (design) = A: Sticky-acknowledged via localStorage.
 *   D5 (CEO)    = C: Frame as "awaiting county handshake" (no live counter,
 *                    no zero-count question).
 *
 * SSR-safe: renders null pre-hydration (dismissed === null) to prevent Next.js
 * hydration mismatch. Matches FirstVisitCallout pattern exactly.
 */
export default function CountyOutcomeRoadmapCard() {
  // null = not yet hydrated; true = dismissed; false = show
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Render nothing during SSR / pre-hydration, and after dismissal.
  if (dismissed !== false) return null;

  return (
    <aside
      role="region"
      aria-label="County outcomes will land here"
      className="bg-surface border border-hairline rounded-[4px] p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="section-title">County outcomes will land here</h3>
          <p className="section-sub mt-1">
            Once they flow, the Payment Integrity Engine will reconcile each
            determination against the county&#39;s authoritative answer — turning
            eligibility consistency (verified internally) into measured payment
            accuracy (verified externally).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "1");
            setDismissed(true);
          }}
          aria-label="Dismiss county outcome roadmap"
          className="text-muted hover:text-graphite transition-colors shrink-0 mt-0.5"
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
    </aside>
  );
}
