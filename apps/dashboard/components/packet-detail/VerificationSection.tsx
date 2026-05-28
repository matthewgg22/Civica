import React from "react";
import APIVerificationPanel from "../APIVerificationPanel";
import type { VerificationSummary } from "../APIVerificationPanel";

/**
 * Chromeless body — wrapped by <EvidenceSection> on /packets/[id].
 */
export function VerificationSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 w-44 bg-surface rounded" />
      <div className="space-y-2 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-surface rounded" />
        ))}
      </div>
    </div>
  );
}

export default async function VerificationSection({
  summary,
}: {
  summary: VerificationSummary;
  /** Retained for compatibility with prior call sites; surface chrome lives on the wrapper now. */
  flagCount?: number;
}) {
  return (
    <div id="api-verification">
      <p className="section-sub leading-snug -mt-1 mb-4">
        Rules-first accuracy checks: address deliverability, rent vs FMR, SUA tier, income OCR vs
        reported, OBBBA compliance.
      </p>
      <APIVerificationPanel summary={summary} />
    </div>
  );
}
