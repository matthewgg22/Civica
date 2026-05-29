// Canonical error-rate snapshot builder — the "truth point" composer.
//
// Surfaced by docs/findings/2026-05-29-error-rate-truth-point.md.
//
// PURE, deterministic core: given today's live inputs (pillar coverage +
// measured QC counts) it returns the canonical metric rows persisted to
// snap_enrollment.error_rate_snapshot and read back via v_error_rate_current.
//
// Two layers of rows:
//   • TOP-LINE (slice_dim/slice_value null): baseline / projected /
//     engagement-implied / measured — the headline four.
//   • SLICED (slice_dim set): per-pillar gap attribution, income-group PER
//     cohorts, and USDA element shares — the depth that turns an insight from a
//     one-liner into real analysis. Every sliced row is an aggregate / published
//     figure (engine constants + the coverage we already read), so there is no
//     per-individual data and no re-identification risk.
//
// The engine owns every number; the caller supplies only the two live inputs.
// Two runs over the same inputs return identical rows — the anti-drift property.

import { ENGINE_VERSION } from "../version";
import {
  CA_BASELINE_PER,
  CA_BASELINE_FISCAL_YEAR,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  computeEngagementImpliedPER,
  pillarContribution,
  PILLAR_SHARES_UNNORMALIZED,
  PILLAR_MAX_DEFENSIBILITY_SHIFT,
  INCOME_GROUP_PER_FY23,
  CA_ELEMENT_ATTRIBUTION_FY23,
  type PillarCoverage,
} from "./error-risk";
import { wilsonInterval } from "./wilson";

export type ErrorRateMetric =
  | "baseline_ca"
  | "projected_full_engagement"
  | "engagement_implied"
  | "measured_overall"
  | "pillar_contribution"
  | "income_group_per"
  | "element_attribution";

export type ErrorRateSource =
  | "usda_fns_published"
  | "engine_projection"
  | "engine_engagement_implied"
  | "measured_qc_sample"
  | "engine_pillar_attribution"
  | "usda_income_group"
  | "usda_element_share";

/** One canonical metric row. Mirrors the snap_enrollment.error_rate_snapshot columns. */
export interface ErrorRateSnapshotRow {
  metric: ErrorRateMetric;
  /** Breakdown dimension for sub-metrics ('pillar'|'income_group'|'element'); null for top-line. */
  slice_dim: string | null;
  /** Value within slice_dim (e.g. 'utility_sua', 'wage_only', '363'); null for top-line. */
  slice_value: string | null;
  /** Point estimate in percentage points; null when not yet computable. */
  per_pct: number | null;
  /** 95% Wilson band (percentage points) for measured_overall; null otherwise. */
  ci_low: number | null;
  ci_high: number | null;
  /** Sample size for measured_overall; null otherwise. */
  n: number | null;
  /** Fiscal year for published rows (baseline, income-group, element); null otherwise. */
  fiscal_year: number | null;
  source: ErrorRateSource;
  meta: Record<string, unknown>;
  engine_version: string;
}

export interface MeasuredCounts {
  /** Completed QC reviews (denominator): qc_sampled AND error_found IS NOT NULL. */
  n: number;
  /** Confirmed errors (numerator): error_found = true. */
  errors: number;
}

export interface ErrorRateSnapshotInputs {
  /** Live pillar coverage (from v_qc_pillar_coverage). */
  coverage: PillarCoverage;
  /** Total non-deleted packets behind the coverage (context). */
  totalPackets: number;
  /** Completed QC review counts (from qc_outcomes). */
  measured: MeasuredCounts;
  /** Override the baseline FY label (defaults to the engine's CA_BASELINE_FISCAL_YEAR). */
  fiscalYear?: number;
  /** Min completed reviews before a measured PER is reported (default MEASURED_MIN_N). */
  measuredMinN?: number;
}

/** Minimum completed QC reviews before measured PER is reported (falsification gate, n >= 30). */
export const MEASURED_MIN_N = 30;

/** Stable pillar order for per-pillar attribution rows. */
const PILLAR_ORDER: (keyof PillarCoverage)[] = [
  "utility_sua",
  "gig_income",
  "shared_lease",
  "assets",
  "benefit_impact",
];

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * Compose the canonical error-rate snapshot rows. PURE + deterministic.
 *
 * Top-line: published CA baseline, engine projection, live engagement-implied,
 * measured (n-gated). Sliced: per-pillar gap attribution, income-group PER, USDA
 * element shares. The engine supplies every fixed number and every formula; the
 * caller supplies only the two live inputs (coverage + measured counts).
 */
export function buildErrorRateSnapshot(
  inputs: ErrorRateSnapshotInputs,
): ErrorRateSnapshotRow[] {
  const minN = inputs.measuredMinN ?? MEASURED_MIN_N;
  const fiscalYear = inputs.fiscalYear ?? CA_BASELINE_FISCAL_YEAR;
  const engagementImplied = computeEngagementImpliedPER(inputs.coverage);

  const rows: ErrorRateSnapshotRow[] = [
    topline({
      metric: "baseline_ca",
      per_pct: round3(CA_BASELINE_PER),
      fiscal_year: fiscalYear,
      source: "usda_fns_published",
      meta: { label: "CA total PER (USDA FNS-380)" },
    }),
    topline({
      metric: "projected_full_engagement",
      per_pct: round3(PROJECTED_PER_AT_FULL_ENGAGEMENT),
      source: "engine_projection",
      meta: { baseline_ca_per: CA_BASELINE_PER },
    }),
    topline({
      metric: "engagement_implied",
      per_pct: round3(engagementImplied),
      source: "engine_engagement_implied",
      meta: { coverage: inputs.coverage, total_packets: inputs.totalPackets },
    }),
    buildMeasuredRow(inputs.measured, minN),
  ];

  // ── Sliced: per-pillar gap attribution ────────────────────────────────────
  // How many pp of the engagement-implied reduction each pillar earns at TODAY's
  // coverage. At full coverage these sum to (baseline - projected) ~= 5.48 pp.
  for (const pillar of PILLAR_ORDER) {
    rows.push({
      metric: "pillar_contribution",
      slice_dim: "pillar",
      slice_value: pillar,
      per_pct: round3(pillarContribution(pillar, inputs.coverage[pillar])),
      ci_low: null,
      ci_high: null,
      n: null,
      fiscal_year: null,
      source: "engine_pillar_attribution",
      meta: {
        coverage: inputs.coverage[pillar],
        usda_share: PILLAR_SHARES_UNNORMALIZED[pillar],
        max_defensibility_shift: PILLAR_MAX_DEFENSIBILITY_SHIFT[pillar],
        unit: "reduction_pp",
      },
      engine_version: ENGINE_VERSION,
    });
  }

  // ── Sliced: income-group PER cohorts (national FY23) — the TAM story ───────
  for (const [group, per] of Object.entries(INCOME_GROUP_PER_FY23)) {
    rows.push({
      metric: "income_group_per",
      slice_dim: "income_group",
      slice_value: group,
      per_pct: round3(per),
      ci_low: null,
      ci_high: null,
      n: null,
      fiscal_year: 2023,
      source: "usda_income_group",
      meta: { scope: "national", unit: "per_pct" },
      engine_version: ENGINE_VERSION,
    });
  }

  // ── Sliced: USDA element attribution (CA FY23) — where errors live ─────────
  // per_pct here is the SHARE of errored cases citing the element, NOT a PER —
  // the meta.unit disambiguates (source = usda_element_share also signals it).
  for (const [code, { label, share_pct }] of Object.entries(CA_ELEMENT_ATTRIBUTION_FY23)) {
    rows.push({
      metric: "element_attribution",
      slice_dim: "element",
      slice_value: code,
      per_pct: round3(share_pct),
      ci_low: null,
      ci_high: null,
      n: null,
      fiscal_year: 2023,
      source: "usda_element_share",
      meta: { label, unit: "share_of_errored_cases_pct" },
      engine_version: ENGINE_VERSION,
    });
  }

  return rows;
}

/** Helper for the top-line (un-sliced) rows. */
function topline(p: {
  metric: ErrorRateMetric;
  per_pct: number | null;
  source: ErrorRateSource;
  meta: Record<string, unknown>;
  fiscal_year?: number | null;
}): ErrorRateSnapshotRow {
  return {
    metric: p.metric,
    slice_dim: null,
    slice_value: null,
    per_pct: p.per_pct,
    ci_low: null,
    ci_high: null,
    n: null,
    fiscal_year: p.fiscal_year ?? null,
    source: p.source,
    meta: p.meta,
    engine_version: ENGINE_VERSION,
  };
}

function buildMeasuredRow(
  measured: MeasuredCounts,
  minN: number,
): ErrorRateSnapshotRow {
  const { n, errors } = measured;

  // Below the gate: report n but no rate — honest "insufficient sample".
  if (n < minN) {
    return {
      metric: "measured_overall",
      slice_dim: null,
      slice_value: null,
      per_pct: null,
      ci_low: null,
      ci_high: null,
      n,
      fiscal_year: null,
      source: "measured_qc_sample",
      meta: { errors, min_n: minN, status: "insufficient_sample" },
      engine_version: ENGINE_VERSION,
    };
  }

  // At/above the gate: point estimate + 95% Wilson band, scaled to percentage.
  const ci = wilsonInterval(errors, n);
  return {
    metric: "measured_overall",
    slice_dim: null,
    slice_value: null,
    per_pct: round3(ci.rate * 100),
    ci_low: round3(ci.lower * 100),
    ci_high: round3(ci.upper * 100),
    n,
    fiscal_year: null,
    source: "measured_qc_sample",
    meta: { errors, min_n: minN, status: "measured" },
    engine_version: ENGINE_VERSION,
  };
}
