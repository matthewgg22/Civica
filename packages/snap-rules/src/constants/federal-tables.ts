// FY26 federal SNAP tables — ported from backend/civic_api/snap/rules/
// poverty_guidelines.py (Phase A skeleton, FY25 baseline) and extended
// with FY26 values published in the FNS COLA memo (August 2025) and HHS
// 2025 Poverty Guidelines (Federal Register, January 2025).
//
// Data integrity rule (same as Python source): never edit a published
// table after its effective_end passes. If FNS publishes a correction,
// add a new effective-date entry.
//
// This module is the SOLE source-of-truth for TS-side federal constants.
// Both the verdict composer (verdict.ts) and any consumer that needs to
// surface engine params (e.g. PARAMS_MISMATCH detection in the harness)
// reads from here. No constant lives in two places.

import { Decimal } from "../decimal";

// ─── Per-region FPL table (#812) ───────────────────────────────────────────
//
// HHS publishes THREE separate poverty-guideline sets in the same annual
// Federal Register notice: 48 contiguous states + DC, Alaska, and Hawaii —
// Alaska's and Hawaii's are materially HIGHER than the contiguous table.
// fplMonthly() used to apply the single contiguous table to every state,
// including AK, which quietly narrowed AK eligibility below what federal
// policy allows (every gross/net income test screened against a lower FPL
// than AK households are actually entitled to). This axis fixes that.

export type FplMonthlyRounding = "floor" | "ceiling";

/**
 * HHS Poverty Guideline annual values for one geographic region, plus the
 * rounding convention that region's own published SNAP income-standards
 * table uses when deriving the monthly figure — applied BEFORE the BBCE/
 * 130%/100% multipliers, same step as the pre-existing 48-contiguous logic.
 */
export interface RegionalFplTable {
  fpl_annual_first_person: Decimal;
  fpl_annual_each_additional: Decimal;
  /**
   * "floor" — 48-contiguous states + DC convention. Reconciled against
   *   CDSS ACIN I-46-25 (FFY2026) Attachment I (see fplMonthly()'s comment
   *   below for the full HH2/HH3/HH4 walk-through).
   * "ceiling" — Alaska's OWN convention, confirmed by reproducing Alaska
   *   DOH's current SNAP Standards table (FSP 77, rev 09/25, "effective
   *   October 1, 2025 - September 30, 2026") EXACTLY at three independent
   *   income columns, using the FY26 AK annual figures below ($19,550 /
   *   $6,880 per additional):
   *     100% (net, HH1):  ceil($19,550 / 12)          = $1,630 ✓
   *     100% (net, HH4):  ceil($40,190 / 12)          = $3,350 ✓
   *     130% (gross, HH1): ceil($19,550 × 1.30 / 12)  = $2,118 ✓
   *     130% (gross, HH4): ceil($40,190 × 1.30 / 12)  = $4,354 ✓
   *     165% (elderly/disabled separate-HH test, HH1):
   *                        ceil($19,550 × 1.65 / 12)  = $2,689 ✓
   *   All five figures matched AK's own published table exactly (0 of 5
   *   off by even $1) — floor() at those same inputs would have missed
   *   every one of them by $1. AK's 200%-BBCE column ($3,260 HH1, $6,700
   *   HH4) is not derived this way at all — it is exactly the state's own
   *   rounded 100%/net monthly figure DOUBLED ($1,630 × 2 = $3,260;
   *   $3,350 × 2 = $6,700), which is exactly what fplMonthly() callers
   *   already do downstream (fpl.mul(ratio) in gates/income-tests.ts), so
   *   that column reproduces exactly too without any special-casing.
   *   Figures cross-sourced: annual guideline from the 2025 HHS Poverty
   *   Guidelines for Alaska (Federal Register Vol. 90 No. 11, Jan 17,
   *   2025, 90 FR 5917 — govinfo.gov/content/pkg/FR-2025-01-17/pdf/2025-
   *   01377.pdf — the SAME notice the FY26 contiguous table below cites);
   *   published monthly figures from
   *   packages/demeter-engine/src/states/ak/supplements.json
   *   (income-and-bbce supplement), itself sourced from Alaska DOH's own
   *   SNAP Standards PDF, cross-checked there against USDA FNS's national
   *   FY2026 table.
   */
  monthly_rounding: FplMonthlyRounding;
}

export class NoFplTableForRegionError extends Error {
  constructor(region: string, state: string) {
    super(
      `No FPL table sourced for region "${region}" (state ${state}). ` +
        `Add the region's HHS Poverty Guideline figures to federal-tables.ts ` +
        `before running determinations for that state.`,
    );
  }
}

/** AK and HI get HHS's separate, higher guidelines; every other state uses
 * the 48-contiguous + DC table. */
function fplRegionForState(state: string): "ak" | "hi" | "contiguous" {
  const s = state.toUpperCase();
  if (s === "AK") return "ak";
  if (s === "HI") return "hi";
  return "contiguous";
}

// ─── Effective-date table ─────────────────────────────────────────────────

export interface FederalTableSnapshot {
  fiscal_year: number;
  effective_start: Date;
  effective_end: Date;
  /**
   * Per-region FPL table axis (#812). `contiguous` is the 48-contiguous +
   * DC table this snapshot always had. `ak` carries Alaska's real, higher
   * HHS guideline. `hi` is `null` — Hawaii has NO StatePolicy registered in
   * constants/states.ts yet (a future HI build), so there is no real
   * consumer for this slot today; it is left `null` (NOT a copy of the
   * contiguous figures) rather than silently wrong, and fplMonthly() below
   * throws a clear error if it's ever reached before HI is sourced.
   */
  fpl_by_region: {
    contiguous: RegionalFplTable;
    ak: RegionalFplTable;
    hi: RegionalFplTable | null;
  };
  /** FNS max allotment, by household size (48 contiguous + DC). */
  max_allotment: Map<number, Decimal>;
  max_allotment_each_additional: Decimal;
  /** Federal standard deduction by HH size band. */
  standard_deduction: Map<number, Decimal>;
  /** FY shelter cap; null for E/D households (uncapped). */
  shelter_cap: Decimal;
  /** Federal minimum benefit (1-2 person eligible HH). */
  minimum_benefit: Decimal;
  /** Federal homeless household shelter deduction substitute. */
  homeless_deduction: Decimal;
  /** Asset limit, non-E/D. */
  asset_limit_household: Decimal;
  /** Asset limit, E/D. */
  asset_limit_elderly_disabled: Decimal;
  /** Earned income deduction rate (statutory; 0.20). */
  earned_income_deduction_rate: Decimal;
  /** 7 CFR 273.9(d)(3) medical-deduction floor for E/D HHs. */
  medical_floor: Decimal;
}

// FY25 (10/01/2024 - 09/30/2025) — Python source-of-truth values.
const FY25: FederalTableSnapshot = {
  fiscal_year: 2025,
  effective_start: new Date(Date.UTC(2024, 9, 1)),
  effective_end: new Date(Date.UTC(2025, 8, 30)),
  // HHS 2024 Poverty Guidelines (Federal Register Vol. 89 No. 11, Jan 17,
  // 2024, 89 FR 2961-63 — govinfo.gov/content/pkg/FR-2024-01-17/pdf/2024-
  // 00796.pdf). Per-region (#812): 48 contiguous + DC, Alaska, Hawaii are
  // published together in the same notice; AK's guideline is materially
  // higher ($18,810/$6,730 vs $15,060/$5,380).
  fpl_by_region: {
    contiguous: {
      fpl_annual_first_person: new Decimal("15060"),
      fpl_annual_each_additional: new Decimal("5380"),
      monthly_rounding: "floor",
    },
    ak: {
      fpl_annual_first_person: new Decimal("18810"),
      fpl_annual_each_additional: new Decimal("6730"),
      monthly_rounding: "ceiling",
    },
    hi: null, // not yet sourced — HI has no StatePolicy registered (#812 scope note)
  },
  // FNS FY25 COLA memo (effective 10/01/2024).
  max_allotment: new Map<number, Decimal>([
    [1, new Decimal("292")],
    [2, new Decimal("536")],
    [3, new Decimal("768")],
    [4, new Decimal("975")],
    [5, new Decimal("1158")],
    [6, new Decimal("1390")],
    [7, new Decimal("1536")],
    [8, new Decimal("1756")],
  ]),
  max_allotment_each_additional: new Decimal("220"),
  // FY25 standard deduction (HH 1-3 share, then HH4, HH5, HH6+).
  standard_deduction: new Map<number, Decimal>([
    [1, new Decimal("204")],
    [2, new Decimal("204")],
    [3, new Decimal("204")],
    [4, new Decimal("217")],
    [5, new Decimal("254")],
    [6, new Decimal("291")],
  ]),
  shelter_cap: new Decimal("712"),
  minimum_benefit: new Decimal("23"),
  // FY25 homeless household shelter deduction substitute (FNS COLA).
  homeless_deduction: new Decimal("179.66"),
  asset_limit_household: new Decimal("3000"),
  asset_limit_elderly_disabled: new Decimal("4500"),
  earned_income_deduction_rate: new Decimal("0.20"),
  medical_floor: new Decimal("35"),
};

// FY26 (10/01/2025 - 09/30/2026) — FNS COLA August 2025, HHS January 2025
// Federal Register. These are the production-ready FY26 values; the
// Python source-of-truth has a deployment TODO to load them.
const FY26: FederalTableSnapshot = {
  fiscal_year: 2026,
  effective_start: new Date(Date.UTC(2025, 9, 1)),
  effective_end: new Date(Date.UTC(2026, 8, 30)),
  // HHS 2025 Poverty Guidelines (Federal Register Vol. 90 No. 11, Jan 17,
  // 2025, 90 FR 5917 — govinfo.gov/content/pkg/FR-2025-01-17/pdf/2025-
  // 01377.pdf). Per-region (#812): AK's guideline is materially higher
  // ($19,550/$6,880 vs the contiguous table's $15,660/$5,500 below — see
  // RegionalFplTable's doc-comment for the derivation + AK-vs-published-
  // table reconciliation).
  // Monthly HH1 (contiguous) = $15,660/12 ≈ $1,305 (the value cited in the
  // fixture's meta.params.fpl[1]).
  fpl_by_region: {
    contiguous: {
      fpl_annual_first_person: new Decimal("15660"),
      fpl_annual_each_additional: new Decimal("5500"),
      monthly_rounding: "floor",
    },
    ak: {
      fpl_annual_first_person: new Decimal("19550"),
      fpl_annual_each_additional: new Decimal("6880"),
      monthly_rounding: "ceiling",
    },
    hi: null, // not yet sourced — HI has no StatePolicy registered (#812 scope note)
  },
  // FNS FY26 COLA memo.
  max_allotment: new Map<number, Decimal>([
    [1, new Decimal("298")],
    [2, new Decimal("546")],
    [3, new Decimal("785")],
    [4, new Decimal("994")],
    [5, new Decimal("1183")],
    [6, new Decimal("1421")],
    [7, new Decimal("1571")],
    [8, new Decimal("1789")],
  ]),
  // FNS COLA FY26 memo (verified live 2026-06-02): +$218 per additional
  // member beyond HH8. Prior value "224" was a $6 over-credit; dormant
  // in test scope because Python generator stops at HH8 and v0.6
  // fixture tops at HH7 (profile P60). Surfaced during the oracle
  // contamination sanity check
  // (docs/findings/2026-06-02-snap-oracle-contamination-sanity-check.md).
  max_allotment_each_additional: new Decimal("218"),
  standard_deduction: new Map<number, Decimal>([
    [1, new Decimal("209")],
    [2, new Decimal("209")],
    [3, new Decimal("209")],
    [4, new Decimal("223")],
    [5, new Decimal("261")],
    [6, new Decimal("299")],
  ]),
  shelter_cap: new Decimal("744"),
  minimum_benefit: new Decimal("24"),
  homeless_deduction: new Decimal("198.99"),
  asset_limit_household: new Decimal("3000"),
  asset_limit_elderly_disabled: new Decimal("4500"),
  earned_income_deduction_rate: new Decimal("0.20"),
  medical_floor: new Decimal("35"),
};

const SNAPSHOTS: FederalTableSnapshot[] = [FY25, FY26];

// ─── Income test ratios (statutory, don't vary by year) ───────────────────

export const GROSS_INCOME_TEST_RATIO = new Decimal("1.30"); // 130% FPL
export const NET_INCOME_TEST_RATIO = new Decimal("1.00"); // 100% FPL

// ─── Lookup ───────────────────────────────────────────────────────────────

export class NoTableForDateError extends Error {
  constructor(asOf: Date) {
    super(
      `No federal SNAP table loaded for ${asOf.toISOString().slice(0, 10)}. Add FNS values for that fiscal year before running determinations.`,
    );
  }
}

export function snapshotFor(asOf: Date): FederalTableSnapshot {
  for (const s of SNAPSHOTS) {
    if (asOf >= s.effective_start && asOf <= s.effective_end) return s;
  }
  throw new NoTableForDateError(asOf);
}

/**
 * Monthly FPL for `size` at `asOf`, for `state`'s region (#812).
 *
 * `state` selects the region (48-contiguous+DC / AK / HI) via
 * fplRegionForState — every state other than AK and HI gets the exact same
 * `contiguous` table and `floor` rounding this function always used, so
 * behavior for those states is unchanged byte-for-byte (see
 * federal-tables.test.ts's cross-state regression check).
 *
 * FNS / CalFresh convention for the 48-contiguous table: FLOOR the monthly
 * value before applying BBCE / 130% / 100% multipliers. Verified against
 * CDSS ACIN I-46-25 (FFY 2026) Attachment I via the 2026-06-02 audit
 * reconciliation:
 *
 *   Annual FPL HH1 = $15,660; each add'l = $5,500.
 *   HH2 monthly raw = $21,160/12 = $1,763.33 → floor = $1,763
 *     × 2.0 (BBCE-200) = $3,526 ✓ matches ACIN
 *   HH3 monthly raw = $26,660/12 = $2,221.67 → floor = $2,221
 *     × 2.0 = $4,442 ✓ matches ACIN
 *   HH4 monthly raw = $32,160/12 = $2,680.00 (exact, no fractional)
 *     × 2.0 = $5,360 ✓ matches ACIN
 *   HH5/6/8 similar — all floor reconciles to published table.
 *
 * Prior implementation used `roundDollar()` (Math.round, HALF_UP) which
 * produced +$1 drift at HH2/3/5/6/8 vs the published BBCE-200, 130% gross,
 * and 100% net thresholds — flipping borderline cases. The fix: floor at
 * the monthly step so all derived thresholds match the FNS-published
 * rounding convention.
 *
 * AK uses its OWN annual guideline and its OWN rounding convention
 * (ceiling, not floor) — see RegionalFplTable's doc-comment for the full
 * AK-vs-published-table reconciliation. HI has no table sourced yet and
 * throws NoFplTableForRegionError if ever reached (no HI StatePolicy
 * exists to reach it today).
 */
export function fplMonthly(size: number, asOf: Date, state: string): Decimal {
  const s = snapshotFor(asOf);
  if (size < 1) throw new Error("Household size must be >= 1");
  const region = fplRegionForState(state);
  const table = s.fpl_by_region[region];
  if (!table) throw new NoFplTableForRegionError(region, state);
  const annual = table.fpl_annual_first_person.add(
    table.fpl_annual_each_additional.mul(size - 1),
  );
  const monthly = annual.div(12);
  return table.monthly_rounding === "ceiling" ? monthly.ceilDollar() : monthly.floorDollar();
}

export function standardDeductionFor(size: number, asOf: Date): Decimal {
  const s = snapshotFor(asOf);
  if (size <= 3) return s.standard_deduction.get(1)!;
  if (size === 4) return s.standard_deduction.get(4)!;
  if (size === 5) return s.standard_deduction.get(5)!;
  return s.standard_deduction.get(6)!;
}

export function maxAllotmentFor(size: number, asOf: Date): Decimal {
  const s = snapshotFor(asOf);
  if (size < 1) throw new Error("Household size must be >= 1");
  const exact = s.max_allotment.get(size);
  if (exact) return exact;
  const largest = Math.max(...s.max_allotment.keys());
  if (size > largest) {
    const base = s.max_allotment.get(largest)!;
    return base.add(s.max_allotment_each_additional.mul(size - largest));
  }
  throw new Error(`No max_allotment for size ${size}`);
}

export function assetLimitFor(isED: boolean, asOf: Date): Decimal {
  const s = snapshotFor(asOf);
  return isED ? s.asset_limit_elderly_disabled : s.asset_limit_household;
}

export function shelterCapFor(asOf: Date): Decimal {
  return snapshotFor(asOf).shelter_cap;
}

export function minimumBenefitFor(asOf: Date): Decimal {
  return snapshotFor(asOf).minimum_benefit;
}

export function homelessDeductionFor(asOf: Date): Decimal {
  return snapshotFor(asOf).homeless_deduction;
}

export function earnedIncomeDeductionRateFor(asOf: Date): Decimal {
  return snapshotFor(asOf).earned_income_deduction_rate;
}

export function medicalFloorFor(asOf: Date): Decimal {
  return snapshotFor(asOf).medical_floor;
}
