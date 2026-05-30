// ---------------------------------------------------------------------------
// §10105 — OBBBA SNAP payment-error cost-share exposure (REAL public data)
//
// OBBBA §10105 ties a state's share of SNAP *benefit* cost to its payment
// error rate (PER). This module computes a state's exposure from PUBLISHED
// federal data, replacing the earlier all-demo placeholders:
//
//   • PER by state, FY2024 — USDA FNS QC Payment Error Rates
//   • State SNAP issuance, FY2024 — FNS National/State Monthly Data (the base
//     the cost-share percentage applies to)
//   • 65/35 operational/client error split — docs/findings/2026-05-29-usda-qc-ca-grounding
//
// Both data inputs are bundled in per-by-state-fy24.json.
//
// ⚠ CORRECTION vs the prior demo: the trigger is ABSOLUTE PER tiers, not
// "≥105% of the national average." The real FY2024 national PER is 10.93% —
// California, at 10.98%, sits at the MEDIAN (1.005× national). A
// relative-to-national trigger therefore gives CA ~zero exposure; it is the
// ABSOLUTE tier (CA ≥10% → top band) that actually exposes CA. The prior demo
// assumed an 8.6% national average and a relative trigger — both wrong.
//
// ⚠ STATUTORY PARAMETER: the exact tier thresholds, share percentages, and the
// effective fiscal year are set by statute. TIER_SCHEDULE encodes the
// commonly-cited structure; CONFIRM IT AGAINST THE ENACTED TEXT (and the
// FY2025/2026 lookback rule) before any dollar figure leaves the building.
// ---------------------------------------------------------------------------

import perByState from "./per-by-state-fy24.json";

interface PerByStateFile {
  fiscal_year: number;
  national_avg_per: number;
  source: string;
  states: { state: string; fips: number; per: number; fy24_issuance_usd: number }[];
}

const DATA = perByState as PerByStateFile;

/** Operational (agency-side, Civica-addressable) vs client (applicant-side,
 *  irreducible by a bridge) share of error dollars. 65/35, QC FY2023 CA. */
export const OPERATIONAL_SHARE = 0.65;
export const CLIENT_SHARE = 0.35;

/** Real FY2024 national average PER (USDA FNS QC). NOT the 8.6% the demo used. */
export const NATIONAL_AVG_PER = DATA.national_avg_per;

/** OBBBA §10105 benefit cost-share tiers (absolute PER → state share of
 *  benefit cost). ⚠ STATUTORY — confirm thresholds/shares/effective FY. */
export const TIER_SCHEDULE: readonly { maxPer: number; sharePct: number }[] = [
  { maxPer: 6, sharePct: 0 },
  { maxPer: 8, sharePct: 5 },
  { maxPer: 10, sharePct: 10 },
  { maxPer: Infinity, sharePct: 15 },
];

/** State share of benefit cost (%) for a given PER, per TIER_SCHEDULE. */
export function tierShare(per: number): number {
  return TIER_SCHEDULE.find((t) => per < t.maxPer)!.sharePct;
}

// 2-letter code → FIPS for the lookups consumers pass ("CA", "MA", …).
const CODE_TO_FIPS: Record<string, number> = {
  AL: 1, AK: 2, AZ: 4, AR: 5, CA: 6, CO: 8, CT: 9, DE: 10, DC: 11, FL: 12,
  GA: 13, HI: 15, ID: 16, IL: 17, IN: 18, IA: 19, KS: 20, KY: 21, LA: 22,
  ME: 23, MD: 24, MA: 25, MI: 26, MN: 27, MS: 28, MO: 29, MT: 30, NE: 31,
  NV: 32, NH: 33, NJ: 34, NM: 35, NY: 36, NC: 37, ND: 38, OH: 39, OK: 40,
  OR: 41, PA: 42, RI: 44, SC: 45, SD: 46, TN: 47, TX: 48, UT: 49, VT: 50,
  VA: 51, WA: 53, WV: 54, WI: 55, WY: 56,
};

export interface NextTierCrossing {
  /** PER you must get below to drop a tier. */
  targetPer: number;
  /** PER reduction (pp) required from the current rate. */
  requiredReductionPP: number;
  /** State share (%) after the crossing. */
  sharePctAfter: number;
  /** Annual $ saved by the crossing (issuance × share delta). */
  dollarsSaved: number;
  /** Is the required cut within the operationally-addressable headroom? */
  achievableWithinOperationalHeadroom: boolean;
}

export interface PERExposure {
  stateCode: string;
  statewidePER: number; // real, FY2024 FNS QC
  nationalAvgPER: number; // real, 10.93
  /** Operationally-addressable best-case PER = the client-error floor a bridge
   *  cannot reach (statewidePER × CLIENT_SHARE). The lowest PER Civica could
   *  drive a cohort to IF it removed *all* operational error — a modeled
   *  ceiling, NOT a measured cohort result. (Was a fabricated 4.2 in the demo.) */
  civicaCohortPER: number;
  /** Real FY2024 SNAP issuance — the cost-share base. */
  fy24IssuanceUsd: number;
  /** Current §10105 state benefit-cost share (%) at this PER. */
  currentTierSharePct: number;
  /** Annual §10105 exposure = issuance × current tier share. */
  penaltyExposureDollars: number;
  /** Operationally-addressable headroom (pp) = statewidePER × OPERATIONAL_SHARE. */
  operationalHeadroomPP: number;
  /** Irreducible client-error floor (pp). */
  clientFloorPER: number;
  /** statewidePER / national avg. */
  relativeToNational: number;
  /** Is the state a relative-to-national outlier (≥105% of avg)? CA: false. */
  isRelativeOutlier: boolean;
  /** The cheapest tier the state can drop into, and what it saves. null if none. */
  nextTierCrossing: NextTierCrossing | null;
  /** PER + issuance are real; the tier schedule is a statutory assumption. */
  statutoryAssumption: boolean;
  /** Inputs are real published data (not invented). */
  demoMode: boolean;
}

function compute(
  stateCode: string,
  row: { per: number; fy24_issuance_usd: number },
): PERExposure {
  const per = row.per;
  const issuance = row.fy24_issuance_usd;
  const share = tierShare(per);
  const clientFloor = +(per * CLIENT_SHARE).toFixed(2);
  const operationalHeadroom = +(per * OPERATIONAL_SHARE).toFixed(2);

  // The next lower tier boundary below the current PER (e.g. CA 10.98 → 10).
  const lowerBoundary = TIER_SCHEDULE.map((t) => t.maxPer)
    .filter((m) => m < per && Number.isFinite(m))
    .sort((a, b) => b - a)[0];

  let nextTierCrossing: NextTierCrossing | null = null;
  if (lowerBoundary !== undefined) {
    const shareAfter = tierShare(lowerBoundary - 0.0001);
    const requiredReduction = +(per - lowerBoundary).toFixed(2);
    nextTierCrossing = {
      targetPer: lowerBoundary,
      requiredReductionPP: requiredReduction,
      sharePctAfter: shareAfter,
      dollarsSaved: Math.round((issuance * (share - shareAfter)) / 100),
      achievableWithinOperationalHeadroom: requiredReduction <= operationalHeadroom,
    };
  }

  return {
    stateCode,
    statewidePER: per,
    nationalAvgPER: NATIONAL_AVG_PER,
    civicaCohortPER: clientFloor,
    fy24IssuanceUsd: issuance,
    currentTierSharePct: share,
    penaltyExposureDollars: Math.round((issuance * share) / 100),
    operationalHeadroomPP: operationalHeadroom,
    clientFloorPER: clientFloor,
    relativeToNational: +(per / NATIONAL_AVG_PER).toFixed(3),
    isRelativeOutlier: per >= NATIONAL_AVG_PER * 1.05,
    nextTierCrossing,
    statutoryAssumption: true,
    demoMode: false,
  };
}

/**
 * §10105 exposure for a state, from real FY2024 PER + issuance.
 *
 * Falls back to California when the code is unknown — preserving the prior
 * contract that a county-demo page never renders NaN/undefined into a $-figure.
 *
 * @param stateCode — 2-letter code, e.g. "CA".
 */
export function perExposure(stateCode: string): PERExposure {
  const fips = CODE_TO_FIPS[stateCode.toUpperCase()];
  const row = DATA.states.find((s) => s.fips === fips);
  if (!row) {
    const ca = DATA.states.find((s) => s.fips === 6)!;
    return { ...compute("CA", ca), stateCode };
  }
  return compute(stateCode.toUpperCase(), row);
}
