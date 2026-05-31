// Cohort-vs-published PER gap — the honest comparison layer for /findings/kpi.
//
// Pairs Civica's MEASURED served-cohort PER (kpi_snapshot.measured_per) against
// California's PUBLISHED total PER (per-history.ts, USDA FNS-380) and the
// national average. Both anchors are real, cited, merged figures; the cohort
// value is the engine's measured row (pending until QC reviews accrue).
//
// Deliberately NOT a §10105 cost-share / dollar view — that mechanism is
// counsel-flagged and its grounded module is not yet merged (TODO-43 keeps the
// dollar overlay deferred). This layer states only what the published data + the
// measured cohort support: how far our cohort's error rate sits from the bar.

import type { KpiView } from "./kpi-snapshot";

export interface PerGapSummary {
  /** True until the cohort PER is measured (n-gated) — render "pending". */
  pending: boolean;
  /** CA published total PER (the bar), percentage points. */
  caBaselinePct: number;
  /** National average total PER (context), percentage points. */
  nationalPct: number;
  /** Civica measured served-cohort PER; null until measured. */
  cohortPct: number | null;
  /** caBaseline − cohort (pp). Positive = cohort BELOW the state bar (better). Null until measured. */
  gapPp: number | null;
  /** QC reviews behind the cohort PER. */
  n: number;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Compose the gap summary. PURE. caBaselinePct / nationalPct come from the
 * published per-history anchors; `measured` is kpi_snapshot.measured_per.
 */
export function perGapSummary(
  measured: KpiView | null,
  caBaselinePct: number,
  nationalPct: number,
): PerGapSummary {
  const status = typeof measured?.meta?.status === "string" ? measured.meta.status : "";
  const n = measured?.n ?? 0;

  if (status === "measured" && measured?.valuePct != null) {
    const cohortPct = measured.valuePct;
    return {
      pending: false,
      caBaselinePct,
      nationalPct,
      cohortPct,
      gapPp: round1(caBaselinePct - cohortPct),
      n,
    };
  }

  return { pending: true, caBaselinePct, nationalPct, cohortPct: null, gapPp: null, n };
}
