// U.S. Virgin Islands' real maximum SNAP allotment + minimum-benefit table
// (#858, following #814's ak-allotment-zones.ts pattern for the same class
// of gap — a jurisdiction whose real max-allotment table is genuinely
// elevated above the 48-contiguous default that `federal-tables.ts`
// previously forced onto every state).
//
// states.ts's `AllotmentTier` was a closed `"48" | "AK"` union until this
// fix — there was no way to represent VI's own real, elevated table at all,
// so VI's StatePolicy entry shipped with `allotment_tier: "48"` (the only
// value the type allowed) and `benefit: null` authored for all 92
// `expected_by_state.VI` oracle rows specifically to avoid locking in the
// resulting ~28.5-28.9%-understated dollar figure. See #858.
//
// ── Structural difference from AK's fix ─────────────────────────────────
// AK's real max-allotment table is ZONE-based (Urban/Rural I/Rural II,
// resolved from county_fips via 7 CFR 272.7(b) — see ak-allotment-zones.ts).
// VI's is NOT — USVI DHS's own published "Monthly Allotments and
// Deductions" table is a SINGLE FLAT national-territory table with no
// urban/rural subdivision at all (confirmed by reading the source PDF in
// full for #858: one "Maximum Allotment" column, no zone/region axis
// anywhere in the document). This module is deliberately simpler than
// ak-allotment-zones.ts as a result — no county_fips lookup, no zone
// geography reconciliation, just one table.
//
// ── Source ───────────────────────────────────────────────────────────────
// USVI DHS's own current FY2026 (10/1/2025-9/30/2026) "Monthly Allotments
// and Deductions" table, fetched directly (dhs.vi.gov/wp-content/uploads/
// 2025/10/DFA_FY-2026-COLA-ADJUSTMENTS-AND-DEDUCTIONS-TABLE.pdf,
// pdftotext -layout), as quoted in full in issue #858. HH1-8 and the
// each-additional increment below are verbatim from that table.
//
// ── Minimum allotment ────────────────────────────────────────────────────
// #858 also flagged VI's own $31 minimum allotment (1-2 person HH) vs. the
// federal FY26 default of $24 — fixed here too, since `minimumBenefitFor`
// already takes the same `state`/`countyFips` parameters this fix wires
// VI into (the AK precedent fixes both axes through the same two
// functions; VI mirrors that exactly).
//
// ── Standard deduction + shelter cap (#866 — FIXES the gap this file's
// #858 header used to disclose as unfixed) ──────────────────────────────
// VI's own table also carries a Standard Deduction that differs from the
// 48-contiguous table at household sizes 1-3 ($184 for 1-2, $185 for 3 —
// LOWER than federal FY26's $209 — identical to federal at sizes 4-6+:
// $223/$261/$299) and a LOWER Maximum Shelter Deduction ($586 vs. federal
// FY26's $744). Both figures verbatim from USVI DHS's own FY2026 (10/1/
// 2025-9/30/2026) "Monthly Allotments and Deductions" table
// (dhs.vi.gov/wp-content/uploads/2025/10/DFA_FY-2026-COLA-ADJUSTMENTS-AND-
// DEDUCTIONS-TABLE.pdf), quoted in full in issue #858 and re-confirmed in
// this repo at packages/demeter-engine/src/states/vi/supplements.json:138
// and vi/pack.json:67. UNLIKE AK/HI/GU (all elevated, understating
// benefits pre-fix), VI's own SD/shelter-cap figures are LOWER than the
// federal defaults at the sizes where they differ — the pre-#866 engine
// therefore OVER-stated some VI households' benefits (using the federal
// $209 SD instead of VI's own $184/$185, and the federal $744 cap instead
// of VI's own $586), the opposite direction from AK/HI/GU. See issue #866
// for the full before/after reconciliation.

import { Decimal } from "../decimal";

export interface ViAllotmentTable {
  /** FNS max allotment by household size, VI's real (non-48-contiguous)
   *  table. */
  max_allotment: Map<number, Decimal>;
  max_allotment_each_additional: Decimal;
  /** VI's own minimum-benefit floor (1-2 person HH), higher than the
   *  federal default ($24 FY26) every other non-elevated-tier state uses. */
  minimum_benefit: Decimal;
  /** VI's own standard deduction table (#866) — LOWER than the federal
   *  48-contiguous table at sizes 1-3, identical at sizes 4-6+. */
  standard_deduction: Map<number, Decimal>;
  /** VI's own maximum excess shelter deduction cap (#866) — LOWER than
   *  the federal 48-contiguous $744. */
  shelter_cap: Decimal;
}

// ── Dated-snapshot structure (#803 FY27 prep) ───────────────────────────
//
// Prior to this refactor, VI_ALLOTMENT_TABLE was a single plain constant
// with NO effective-date banding — unlike federal-tables.ts's
// `FederalTableSnapshot`/`SNAPSHOTS` array, which already carries
// `effective_start`/`effective_end` and explicitly warns against editing a
// published table in place. `ViAllotmentSnapshot` extends `ViAllotmentTable`
// with the same fiscal-year/date-range fields, so FY27 can be appended to
// `VI_SNAPSHOTS` as a NEW entry instead of overwriting FY26's figures.
//
// `viAllotmentTableFor(asOf)`'s out-of-range fallback is deliberately
// PERMISSIVE (returns the latest snapshot) rather than throwing — same
// reasoning as ak-allotment-zones.ts's `akAllotmentSnapshotFor()`: this
// table had NO date check at all before this refactor (every real caller's
// `asOf` is already validated by federal-tables.ts's own `snapshotFor()`
// first), so throwing here would be a NEW failure mode outside this
// refactor's authorized (behavior-preserving) scope. With exactly one
// snapshot (FY26) in the array today, this resolves to that same snapshot
// for EVERY `asOf` — byte-identical to the pre-refactor constant. See
// docs/plans/fy27-cola-refresh-checklist.md.
export interface ViAllotmentSnapshot extends ViAllotmentTable {
  fiscal_year: number;
  effective_start: Date;
  effective_end: Date;
}

// FY26 (10/1/2025-9/30/2026). Verbatim from USVI DHS's own published table,
// quoted in full in issue #858 (max_allotment/minimum_benefit) and #866
// (standard_deduction/shelter_cap).
const VI_FY26: ViAllotmentSnapshot = {
  fiscal_year: 2026,
  effective_start: new Date(Date.UTC(2025, 9, 1)),
  effective_end: new Date(Date.UTC(2026, 8, 30)),
  max_allotment: new Map<number, Decimal>([
    [1, new Decimal("383")],
    [2, new Decimal("703")],
    [3, new Decimal("1009")],
    [4, new Decimal("1278")],
    [5, new Decimal("1521")],
    [6, new Decimal("1827")],
    [7, new Decimal("2019")],
    [8, new Decimal("2300")],
  ]),
  max_allotment_each_additional: new Decimal("281"),
  minimum_benefit: new Decimal("31"),
  standard_deduction: new Map<number, Decimal>([
    [1, new Decimal("184")],
    [2, new Decimal("184")],
    [3, new Decimal("185")],
    [4, new Decimal("223")],
    [5, new Decimal("261")],
    [6, new Decimal("299")],
  ]),
  shelter_cap: new Decimal("586"),
};

/**
 * FY27 refresh: append a new `ViAllotmentSnapshot` here (`fiscal_year:
 * 2027`, real `effective_start`/`effective_end`) and add it to
 * `VI_SNAPSHOTS` below. Never edit `VI_FY26` in place once FY27 exists.
 */
const VI_SNAPSHOTS: ViAllotmentSnapshot[] = [VI_FY26];

/**
 * Resolve VI's dollar-figure snapshot for `asOf`. See the header note
 * above for why out-of-range falls back to the latest snapshot instead of
 * throwing (deliberately behavior-preserving pre-FY27).
 */
export function viAllotmentTableFor(asOf?: Date): ViAllotmentSnapshot {
  if (!asOf) return VI_SNAPSHOTS[VI_SNAPSHOTS.length - 1]!;
  for (const s of VI_SNAPSHOTS) {
    if (asOf >= s.effective_start && asOf <= s.effective_end) return s;
  }
  return VI_SNAPSHOTS[VI_SNAPSHOTS.length - 1]!;
}

// Backward-compatible export — same name, same values as before this
// refactor. Every existing call site/test that references this directly
// (no `asOf` awareness) keeps working unchanged, pinned to the current
// (FY26) snapshot. New date-aware callers should prefer
// `viAllotmentTableFor(asOf)` instead.
export const VI_ALLOTMENT_TABLE: ViAllotmentTable = VI_FY26;
