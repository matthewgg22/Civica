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
import { akAllotmentZoneFor, AK_URBAN, AK_STANDARD_DEDUCTION, AK_SHELTER_CAP } from "./ak-allotment-zones";
import { VI_ALLOTMENT_TABLE } from "./vi-allotment-table";
import { HI_ALLOTMENT_TABLE } from "./hi-allotment-table";
import { GU_ALLOTMENT_TABLE } from "./gu-allotment-table";

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
   * HHS guideline. `hi` (#861) carries Hawaii's own real, higher HHS
   * guideline — populated now that HI's `StatePolicy` is registered
   * (constants/states.ts). Sourced from the SAME HHS Federal Register
   * notices #812 used for AK (each notice publishes 48-contiguous, AK, AND
   * HI guidelines together); HI's own monthly-rounding convention is
   * CEILING, same as AK's, confirmed by reproducing USDA's own FY2026 COLA
   * memo's published HI-specific income-eligibility table exactly at all 8
   * household sizes across all three FPL columns (100%/130%/165%) — see
   * fplMonthly()'s comment below. GU needs no entry here at all: its own
   * income-eligibility limits are confirmed NOT elevated (identical to the
   * 48-contiguous table per that same COLA memo), an asymmetric structure
   * both HI's and GU's corpus packs independently found — GU correctly
   * falls through to `contiguous` via fplRegionForState below, same as
   * every other non-AK/non-HI jurisdiction including VI.
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
  // 00796.pdf). Per-region (#812/#861): 48 contiguous + DC, Alaska, Hawaii
  // are published together in the same notice; AK's and HI's guidelines are
  // materially higher than the contiguous table ($18,810/$6,730 AK,
  // $17,310/$6,190 HI, vs $15,060/$5,380 contiguous).
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
    // #861: sourced directly from the SAME 2024 HHS notice (govinfo.gov
    // FR-2024-01-17/pdf/2024-00796.pdf), "2024 Poverty Guidelines for
    // Hawaii" table: $17,310 first person, +$6,190 each additional.
    // Rounding convention presumed CEILING (same as AK's, established via
    // FY26's own cross-check below) — not independently reconciled against
    // a published FY25 HI monthly table (none located), same disclosed
    // assumption AK's own FY25 entry made before any FY-specific check
    // existed for AK either.
    hi: {
      fpl_annual_first_person: new Decimal("17310"),
      fpl_annual_each_additional: new Decimal("6190"),
      monthly_rounding: "ceiling",
    },
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
  // 01377.pdf). Per-region (#812/#861): AK's and HI's guidelines are
  // materially higher than the contiguous table's $15,660/$5,500 below —
  // see RegionalFplTable's doc-comment for the derivation + AK-vs-published-
  // table reconciliation.
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
    // #861: sourced directly from the SAME 2025 HHS notice (90 FR 5917),
    // "2025 Poverty Guidelines for Hawaii" table: $17,990 first person,
    // +$6,330 each additional. Monthly-rounding convention CEILING,
    // confirmed by reproducing USDA FNS's own FY2026 COLA memo's published
    // HI-specific Net/Gross/165%-FPL income-eligibility tables EXACTLY at
    // all 8 household sizes across all three columns — e.g. HH1 net:
    // ceil($17,990/12) = $1,500, matching the memo's published figure
    // exactly (floor would give $1,499, off by $1, the same order of drift
    // AK's floor-vs-ceiling reconciliation caught). HH4 net: ceil($36,980/
    // 12) = $3,082, matches. All 8 sizes × 3 columns reconciled with 0
    // mismatches — the strongest possible confirmation short of HI DHS
    // republishing its own guideline separately (it does not; HI DHS's
    // consumer page states these SAME dollar figures directly, corroborating
    // the federal notice rather than contradicting it).
    hi: {
      fpl_annual_first_person: new Decimal("17990"),
      fpl_annual_each_additional: new Decimal("6330"),
      monthly_rounding: "ceiling",
    },
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
 * AK and HI (#861) each use their OWN annual guideline and their OWN
 * rounding convention (ceiling, not floor) — see RegionalFplTable's
 * doc-comment for the full AK-vs-published-table and HI-vs-published-table
 * reconciliations. Every other state, including GU (confirmed NOT
 * elevated — see gu-allotment-table.ts), uses the `contiguous` table.
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

/**
 * FNS standard deduction for a household size. `state` is OPTIONAL and,
 * for every state except AK/VI/HI/GU, changes NOTHING — behavior for
 * every other jurisdiction is byte-identical to before #866.
 *
 * #866: AK/HI/GU each have their OWN, higher, statewide standard-
 * deduction table (packages/snap-rules/src/constants/ak-allotment-zones.ts,
 * hi-allotment-table.ts, gu-allotment-table.ts — the SAME per-jurisdiction
 * constant files maxAllotmentFor()/minimumBenefitFor() already consult for
 * those states, #814/#861), UNDERSTATING those states' benefits pre-fix.
 * VI's own table is genuinely LOWER than the federal default at household
 * sizes 1-3 (identical at 4-6+) — vi-allotment-table.ts — the OPPOSITE
 * direction, OVERSTATING VI's benefits pre-fix. See issue #866 for the
 * full reconciliation and both directions' dollar figures.
 */
export function standardDeductionFor(size: number, asOf: Date, state?: string): Decimal {
  const s = snapshotFor(asOf); // still validates asOf has a loaded fiscal year, for every state

  if (state === "AK") {
    return size <= 5 ? AK_STANDARD_DEDUCTION.get(1)! : AK_STANDARD_DEDUCTION.get(6)!;
  }

  if (state === "VI") {
    if (size <= 2) return VI_ALLOTMENT_TABLE.standard_deduction.get(1)!;
    if (size === 3) return VI_ALLOTMENT_TABLE.standard_deduction.get(3)!;
    if (size === 4) return VI_ALLOTMENT_TABLE.standard_deduction.get(4)!;
    if (size === 5) return VI_ALLOTMENT_TABLE.standard_deduction.get(5)!;
    return VI_ALLOTMENT_TABLE.standard_deduction.get(6)!;
  }

  if (state === "HI") {
    if (size <= 4) return HI_ALLOTMENT_TABLE.standard_deduction.get(1)!;
    if (size === 5) return HI_ALLOTMENT_TABLE.standard_deduction.get(5)!;
    return HI_ALLOTMENT_TABLE.standard_deduction.get(6)!;
  }

  if (state === "GU") {
    if (size <= 3) return GU_ALLOTMENT_TABLE.standard_deduction.get(1)!;
    if (size === 4) return GU_ALLOTMENT_TABLE.standard_deduction.get(4)!;
    if (size === 5) return GU_ALLOTMENT_TABLE.standard_deduction.get(5)!;
    return GU_ALLOTMENT_TABLE.standard_deduction.get(6)!;
  }

  if (size <= 3) return s.standard_deduction.get(1)!;
  if (size === 4) return s.standard_deduction.get(4)!;
  if (size === 5) return s.standard_deduction.get(5)!;
  return s.standard_deduction.get(6)!;
}

/**
 * FNS max allotment for a household size. `state`/`countyFips` are OPTIONAL
 * and, for every state except Alaska, change NOTHING — this function's
 * behavior for the other 49 states + DC/territories is byte-identical to
 * before #814 (verified: git-stash diff comparison, see PR description).
 *
 * Alaska (#814): AK's real FNS maximum allotments are zone-specific
 * (Urban/Rural I/Rural II — packages/snap-rules/src/constants/
 * ak-allotment-zones.ts, sourced from USDA FNS's own AK-specific FY26
 * table), meaningfully higher than the 48-contiguous table this function
 * previously always returned for every state including AK. When
 * `state === "AK"`, this resolves the household's real zone from
 * `countyFips` FIRST (ak-allotment-zones.ts's akAllotmentZoneFor) and falls
 * back to the Urban zone — Alaska's most populous, per DOH's own framing —
 * only when `countyFips` is absent or unrecognized, the SAME two-tier
 * pattern benefit-calc.ts already uses for AK's SUA (#631) and the ABAWD
 * gate already uses for CA's waiver counties (#614).
 *
 * Virgin Islands (#858): VI's real FNS maximum allotments are also
 * genuinely elevated above the 48-contiguous table — but, UNLIKE AK, VI's
 * real table is a single FLAT national-territory table with no zone
 * geography at all (packages/snap-rules/src/constants/
 * vi-allotment-table.ts, sourced from USVI DHS's own FY2026 table). When
 * `state === "VI"`, this resolves straight to that one table —
 * `countyFips` is accepted but unused for VI, same call shape as every
 * other non-AK state.
 *
 * Hawaii and Guam (#861): both jurisdictions' real FNS maximum allotments
 * are ALSO genuinely elevated — HI ~70% above the 48-contiguous table, GU
 * ~47% — and, like VI, both are single FLAT tables with no zone geography
 * (packages/snap-rules/src/constants/hi-allotment-table.ts,
 * gu-allotment-table.ts, both sourced from USDA FNS's own FY2026 COLA
 * memo). `countyFips` is accepted but unused for both, same shape as VI.
 *
 * The `s.max_allotment` national snapshot lookup below is intentionally
 * UNCHANGED and still runs for every non-AK/non-VI state (and is still
 * what validates `asOf` falls within a loaded fiscal year via
 * snapshotFor, which neither the AK zone table nor the VI table
 * duplicates — both have only one FY26 figure set today, the same
 * simplification AK's other StatePolicy fields already accept, see
 * states.ts's AK/VI entries).
 */
export function maxAllotmentFor(size: number, asOf: Date, state?: string, countyFips?: string): Decimal {
  const s = snapshotFor(asOf); // still validates asOf has a loaded fiscal year, for every state
  if (size < 1) throw new Error("Household size must be >= 1");

  if (state === "AK") {
    const zone = akAllotmentZoneFor(countyFips) ?? AK_URBAN;
    const exactAk = zone.max_allotment.get(size);
    if (exactAk) return exactAk;
    const largestAk = Math.max(...zone.max_allotment.keys());
    if (size > largestAk) {
      const baseAk = zone.max_allotment.get(largestAk)!;
      return baseAk.add(zone.max_allotment_each_additional.mul(size - largestAk));
    }
    throw new Error(`No max_allotment for size ${size} (AK zone ${zone.zone})`);
  }

  if (state === "VI") {
    const exactVi = VI_ALLOTMENT_TABLE.max_allotment.get(size);
    if (exactVi) return exactVi;
    const largestVi = Math.max(...VI_ALLOTMENT_TABLE.max_allotment.keys());
    if (size > largestVi) {
      const baseVi = VI_ALLOTMENT_TABLE.max_allotment.get(largestVi)!;
      return baseVi.add(VI_ALLOTMENT_TABLE.max_allotment_each_additional.mul(size - largestVi));
    }
    throw new Error(`No max_allotment for size ${size} (VI)`);
  }

  if (state === "HI") {
    const exactHi = HI_ALLOTMENT_TABLE.max_allotment.get(size);
    if (exactHi) return exactHi;
    const largestHi = Math.max(...HI_ALLOTMENT_TABLE.max_allotment.keys());
    if (size > largestHi) {
      const baseHi = HI_ALLOTMENT_TABLE.max_allotment.get(largestHi)!;
      return baseHi.add(HI_ALLOTMENT_TABLE.max_allotment_each_additional.mul(size - largestHi));
    }
    throw new Error(`No max_allotment for size ${size} (HI)`);
  }

  if (state === "GU") {
    const exactGu = GU_ALLOTMENT_TABLE.max_allotment.get(size);
    if (exactGu) return exactGu;
    const largestGu = Math.max(...GU_ALLOTMENT_TABLE.max_allotment.keys());
    if (size > largestGu) {
      const baseGu = GU_ALLOTMENT_TABLE.max_allotment.get(largestGu)!;
      return baseGu.add(GU_ALLOTMENT_TABLE.max_allotment_each_additional.mul(size - largestGu));
    }
    throw new Error(`No max_allotment for size ${size} (GU)`);
  }

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

/**
 * FNS maximum excess shelter deduction cap. `state` is OPTIONAL and, for
 * every state except AK/VI/HI/GU, changes NOTHING — same no-op-for-other-
 * states shape as standardDeductionFor() above (#866).
 *
 * AK ($1,189) / HI ($1,003) / GU ($873) are each higher than the federal
 * $744 default (understating those states' benefits pre-fix). VI ($586)
 * is LOWER than federal (overstating VI's benefits pre-fix) — see issue
 * #866.
 */
export function shelterCapFor(asOf: Date, state?: string): Decimal {
  if (state === "AK") return AK_SHELTER_CAP;
  if (state === "VI") return VI_ALLOTMENT_TABLE.shelter_cap;
  if (state === "HI") return HI_ALLOTMENT_TABLE.shelter_cap;
  if (state === "GU") return GU_ALLOTMENT_TABLE.shelter_cap;
  return snapshotFor(asOf).shelter_cap;
}

/**
 * Federal minimum-benefit floor (HH1-2 eligible households), 48-contiguous
 * default unless `state === "AK"`, `"VI"`, `"HI"`, or `"GU"`. #814: Alaska
 * sets its OWN, higher, zone-specific minimum-benefit floor ($31 Urban / $39
 * Rural I / $48 Rural II FY26, vs. the $24 national default) per the same
 * USDA FNS "MINIMUM SNAP ALLOTMENTS" table ak-allotment-zones.ts's
 * max-allotment figures are sourced from. Same two-tier county_fips →
 * zone resolution as maxAllotmentFor above. #858: VI's own published
 * minimum allotment is also elevated ($31 for a 1-2 person HH, same
 * dollar figure as AK's Urban floor, coincidentally) — vi-allotment-
 * table.ts's single flat table, no county_fips involved. #861: HI's ($41)
 * and GU's ($35) own published minimum allotments are also elevated, same
 * single-flat-table shape as VI, sourced from the SAME "MINIMUM SNAP
 * ALLOTMENTS" section of USDA FNS's FY2026 COLA memo. `state`/`countyFips`
 * change nothing for any other state.
 */
export function minimumBenefitFor(asOf: Date, state?: string, countyFips?: string): Decimal {
  const s = snapshotFor(asOf);
  if (state === "AK") {
    const zone = akAllotmentZoneFor(countyFips) ?? AK_URBAN;
    return zone.minimum_benefit;
  }
  if (state === "VI") {
    return VI_ALLOTMENT_TABLE.minimum_benefit;
  }
  if (state === "HI") {
    return HI_ALLOTMENT_TABLE.minimum_benefit;
  }
  if (state === "GU") {
    return GU_ALLOTMENT_TABLE.minimum_benefit;
  }
  return s.minimum_benefit;
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
