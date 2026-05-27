import React from "react";
import APIVerificationPanel from "../APIVerificationPanel";
import type { VerificationSummary } from "../APIVerificationPanel";

export function VerificationSkeleton() {
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6 space-y-3 animate-pulse">
      <div className="h-3 w-44 bg-paper rounded" />
      <div className="space-y-2 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-paper rounded" />
        ))}
      </div>
    </section>
  );
}

export default async function VerificationSection({
  summary,
  flagCount,
}: {
  summary: VerificationSummary;
  flagCount: number;
}) {
  return (
    <section id="api-verification" className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="mb-5">
        <div className="flex items-baseline gap-2">
          <h2 className="section-title">API Cross-Verification</h2>
          {flagCount > 0 && (
            <span className="text-[12px] text-muted tabular-nums">({flagCount})</span>
          )}
        </div>
        <p className="section-sub mt-1 leading-snug">
          Rules-first accuracy checks: address deliverability, rent vs FMR, SUA tier, income OCR
          vs reported, OBBBA compliance.
        </p>
      </div>
      <APIVerificationPanel summary={summary} />
    </section>
  );
}
