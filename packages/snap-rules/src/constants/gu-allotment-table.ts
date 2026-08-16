// Guam's real maximum SNAP allotment + minimum-benefit table (#861,
// following #858/#860's vi-allotment-table.ts pattern for the same class of
// gap — a jurisdiction whose real max-allotment table is genuinely elevated
// above the 48-contiguous default that `federal-tables.ts` previously forced
// onto every state).
//
// states.ts's `AllotmentTier` was a closed `"48" | "AK" | "VI"` union until
// this fix — there was no way to represent GU's own real, elevated table at
// all, and GU had no `StatePolicy` entry to begin with (plan doc §4/§5).
//
// ── Structural shape ─────────────────────────────────────────────────────
// AK's real max-allotment table is ZONE-based (Urban/Rural I/Rural II,
// resolved from county_fips via 7 CFR 272.7(b) — see ak-allotment-zones.ts).
// GU's is NOT — USDA FNS's own published FY2026 COLA memo's "Maximum SNAP
// Allotments for Guam" table is a SINGLE FLAT territory-wide table with no
// urban/rural subdivision at all. Guam has no counties or sub-territory
// administrative divisions either (per its Demeter corpus pack) — there is
// no sub-jurisdiction axis to model even if the table had one. This module
// mirrors vi-allotment-table.ts's flat shape, not ak-allotment-zones.ts's.
//
// ── Asymmetric structure vs. HI/AK/VI — GU's income-eligibility limits are
// NOT elevated (a genuine structural difference, confirmed not assumed) ──
// Unlike HI (states.ts's fpl_by_region.hi) and AK (fpl_by_region.ak), GU's
// own income-ELIGIBILITY guideline (net/gross FPL thresholds) is confirmed
// IDENTICAL to the 48-contiguous table — USDA's own FY2026 COLA memo groups
// "48 States, D.C., Guam, Virgin Islands" into ONE shared Income Eligibility
// Standards column. Only GU's BENEFIT-CALCULATION figures (this module's max
// allotment + minimum benefit, plus the disclosed-not-fixed standard
// deduction / shelter cap below) are territory-elevated. GU's own corpus
// pack (packages/demeter-engine/src/states/gu/) independently found and
// flagged this exact asymmetry as its flagship finding. No `fpl_by_region`
// entry exists for GU as a result — `fplRegionForState` in federal-tables.ts
// only special-cases AK and HI; every other state, including GU, correctly
// uses the `contiguous` table already.
//
// ── Source ───────────────────────────────────────────────────────────────
// USDA FNS's own current FY2026 (10/1/2025-9/30/2026) SNAP Cost-of-Living
// Adjustments memorandum, fetched directly (usda.gov/sites/default/files/
// guidance-documents/fns.snap-cola-fy26memo.pdf — same document #858/#860
// sourced VI's table from), quoted in full in issue #861. HH1-8 and the
// each-additional increment below are verbatim from that table's "Maximum
// SNAP Allotments for Guam" section.
//
// ── Minimum allotment ────────────────────────────────────────────────────
// #861 also confirmed GU's own $35 minimum allotment (1-2 person HH) vs. the
// federal FY26 default of $24 — fixed here too, mirroring HI's/VI's/AK's
// precedent through the same `minimumBenefitFor` function.
//
// ── What this does NOT fix (disclosed, matching #858's own framing) ─────
// GU's own table also carries a higher Standard Deduction ($420 sizes 1-3,
// $445 size 4, $522 size 5, $598 size 6+ vs. federal FY26's $209/$223/
// $261/$299) and a higher Maximum Excess Shelter Deduction ($873 vs.
// federal FY26's $744). `federal-tables.ts`'s `standardDeductionFor()`/
// `shelterCapFor()` have no per-state override slot at all (not even for
// AK) — extending them is a separate, larger schema change out of scope for
// this fix. Both gaps work in the household's favor if ever wrongly applied
// (they UNDER-state the deduction, not over-state it).

import { Decimal } from "../decimal";

export interface GuAllotmentTable {
  /** FNS max allotment by household size, GU's real (non-48-contiguous)
   *  table. */
  max_allotment: Map<number, Decimal>;
  max_allotment_each_additional: Decimal;
  /** GU's own minimum-benefit floor (1-2 person HH), higher than the
   *  federal default ($24 FY26) every other non-elevated-tier state uses. */
  minimum_benefit: Decimal;
}

// FY26 (10/1/2025-9/30/2026). Verbatim from USDA FNS's own FY2026 COLA
// memorandum, quoted in full in issue #861.
export const GU_ALLOTMENT_TABLE: GuAllotmentTable = {
  max_allotment: new Map<number, Decimal>([
    [1, new Decimal("439")],
    [2, new Decimal("806")],
    [3, new Decimal("1157")],
    [4, new Decimal("1465")],
    [5, new Decimal("1743")],
    [6, new Decimal("2095")],
    [7, new Decimal("2315")],
    [8, new Decimal("2637")],
  ]),
  max_allotment_each_additional: new Decimal("322"),
  minimum_benefit: new Decimal("35"),
};
