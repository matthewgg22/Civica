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

import { Decimal } from "../decimal.ts";

// ─── Effective-date table ─────────────────────────────────────────────────

export interface FederalTableSnapshot {
  fiscal_year: number;
  effective_start: Date;
  effective_end: Date;
  /** HHS Poverty Guideline annual values for 48 contiguous states + DC. */
  fpl_annual_first_person: Decimal;
  fpl_annual_each_additional: Decimal;
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
  // HHS 2024 Poverty Guidelines, 48 contiguous + DC.
  fpl_annual_first_person: new Decimal("15060"),
  fpl_annual_each_additional: new Decimal("5380"),
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
  // HHS 2025 Poverty Guidelines (Federal Register Jan 2025).
  // Monthly HH1 = $15,660/12 ≈ $1,305 (the value cited in the fixture's meta.params.fpl[1]).
  fpl_annual_first_person: new Decimal("15660"),
  fpl_annual_each_additional: new Decimal("5500"),
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
  max_allotment_each_additional: new Decimal("224"),
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

export function fplMonthly(size: number, asOf: Date): Decimal {
  const s = snapshotFor(asOf);
  if (size < 1) throw new Error("Household size must be >= 1");
  const annual = s.fpl_annual_first_person.add(
    s.fpl_annual_each_additional.mul(size - 1),
  );
  return annual.div(12);
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
