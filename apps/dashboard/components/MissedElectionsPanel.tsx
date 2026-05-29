/**
 * MissedElectionsPanel — surfaces deductions and elections the household
 * qualifies for but hasn't claimed.
 *
 * Server component. Receives the computed missed elections from the packet
 * detail page (which calls detectMissedElections() server-side). Renders
 * a hero dollar amount and per-election action cards.
 */

import type { MissedElection } from "@civica/snap-qc-engine";

interface Props {
  elections: MissedElection[];
  totalMonthlyValue: number;
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high:   "bg-red-50 border-red-200 text-red-700",
  medium: "bg-amber/10 border-amber/30 text-amber-dark",
  low:    "bg-gray-50 border-gray-200 text-gray-500",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  high:   "bg-red-100 text-red-800",
  medium: "bg-amber/20 text-amber-dark",
  low:    "bg-gray-100 text-gray-600",
};

const KIND_ICON: Record<string, string> = {
  homeless_deduction:                   "🏚️",
  sua_tier_upward:                      "⚡",
  actual_utility_election:              "🔌",
  dependent_care_deduction:             "👶",
  medical_deduction_elderly_disabled:   "🏥",
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function MissedElectionsPanel({ elections, totalMonthlyValue }: Props) {
  if (elections.length === 0) {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 flex items-center gap-3">
        <span className="text-teal-600 text-lg">✓</span>
        <p className="text-sm text-teal-800 font-medium">
          All applicable elections and deductions appear to be claimed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Hero */}
      <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-red-500 mb-0.5">
            Potential unclaimed benefit
          </p>
          <p className="text-2xl font-bold text-red-700 tabular-nums">
            {fmtUsd(totalMonthlyValue)}
            <span className="text-base font-normal text-red-500 ml-1">/mo</span>
          </p>
          <p className="text-xs text-red-600 mt-1">
            {elections.length} missed election{elections.length > 1 ? "s" : ""} detected —
            {" "}annualized value{" "}
            <span className="font-semibold">{fmtUsd(totalMonthlyValue * 12)}/yr</span>
          </p>
        </div>
        <div className="text-4xl opacity-60">📋</div>
      </div>

      {/* Per-election cards */}
      {elections.map((e) => (
        <div
          key={e.kind}
          className={`rounded-lg border px-4 py-3 ${CONFIDENCE_STYLE[e.confidence] ?? CONFIDENCE_STYLE.low}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <span className="text-lg shrink-0 mt-0.5">
                {KIND_ICON[e.kind] ?? "📌"}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{e.label}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${CONFIDENCE_BADGE[e.confidence] ?? CONFIDENCE_BADGE.low}`}>
                    {e.confidence} confidence
                  </span>
                </div>
                <p className="text-xs mt-1 opacity-80">{e.reason}</p>
                {e.action_required && (
                  <p className="text-xs mt-1.5 font-medium">
                    → {e.action_required}
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold tabular-nums whitespace-nowrap">
                {fmtUsd(e.estimated_monthly_value_usd)}
              </p>
              <p className="text-xs opacity-70">/mo</p>
            </div>
          </div>

          {e.citation && (
            <p className="text-xs opacity-60 mt-2 border-t border-current/10 pt-2">
              {e.citation}
            </p>
          )}
        </div>
      ))}

      <p className="text-xs text-gray-400 px-1">
        Values are estimates based on CA FFY2026 SUA rates and 7 CFR 273.9 deduction rules.
        Dollar amounts are potential monthly benefit impact, not guaranteed eligibility increases.
      </p>
    </div>
  );
}
