// Hawaii's real maximum SNAP allotment + minimum-benefit table (#861,
// following #858/#860's vi-allotment-table.ts pattern for the same class of
// gap — a jurisdiction whose real max-allotment table is genuinely elevated
// above the 48-contiguous default that `federal-tables.ts` previously forced
// onto every state).
//
// states.ts's `AllotmentTier` was a closed `"48" | "AK" | "VI"` union until
// this fix — there was no way to represent HI's own real, elevated table at
// all, and HI had no `StatePolicy` entry to begin with (plan doc §4/§5).
//
// ── Structural shape ─────────────────────────────────────────────────────
// AK's real max-allotment table is ZONE-based (Urban/Rural I/Rural II,
// resolved from county_fips via 7 CFR 272.7(b) — see ak-allotment-zones.ts).
// HI's is NOT — USDA FNS's own published FY2026 COLA memo's "Maximum SNAP
// Allotments for Hawaii" table is a SINGLE FLAT statewide table with no
// urban/rural subdivision at all (confirmed by reading the full primary
// source for #861: one "Hawaii" column, no zone/region axis anywhere).
// Hawaii has no county-level SNAP administrative variation either (state-
// administered, per its Demeter corpus pack) — there is no sub-jurisdiction
// axis to model even if the table had one. This module mirrors
// vi-allotment-table.ts's flat shape, not ak-allotment-zones.ts's.
//
// ── Source ───────────────────────────────────────────────────────────────
// USDA FNS's own current FY2026 (10/1/2025-9/30/2026) SNAP Cost-of-Living
// Adjustments memorandum, fetched directly (usda.gov/sites/default/files/
// guidance-documents/fns.snap-cola-fy26memo.pdf, cross-mirrored at
// health.alaska.gov/media/4nunu3ob/fy2026-cola-memo.pdf — same document
// #858/#860 sourced VI's table from), quoted in full in issue #861. HH1-8
// and the each-additional increment below are verbatim from that table's
// "Maximum SNAP Allotments for Hawaii" section.
//
// ── Minimum allotment ────────────────────────────────────────────────────
// #861 also confirmed HI's own $41 minimum allotment (1-2 person HH) vs. the
// federal FY26 default of $24 — fixed here too, since `minimumBenefitFor`
// already takes the same `state`/`countyFips` parameters this fix wires HI
// into (the AK/VI precedent fixes both axes through the same two functions;
// HI mirrors that exactly).
//
// ── What this does NOT fix (disclosed, matching #858's own framing) ─────
// HI's own table also carries a higher Standard Deduction ($295 sizes 1-4,
// $300 size 5, $344 size 6+ vs. federal FY26's $209/$223/$261/$299) and a
// higher Maximum Excess Shelter Deduction ($1,003 vs. federal FY26's $744).
// `federal-tables.ts`'s `standardDeductionFor()`/`shelterCapFor()` have no
// per-state override slot at all (not even for AK) — extending them is a
// separate, larger schema change out of scope for this fix. Both gaps work
// in the household's favor if ever wrongly applied (they UNDER-state the
// deduction, not over-state it) — same non-material framing #858 used for
// VI's analogous shelter-cap gap.
//
// ── HI's income-eligibility guideline (a SEPARATE, verdict-affecting fix) ─
// HI's own HHS poverty guideline is ALSO genuinely elevated above the
// 48-contiguous table (unlike VI, whose income limits track the ordinary
// 48-contiguous guideline exactly — see states.ts's VI entry). That fix
// lives in federal-tables.ts's `fpl_by_region.hi` (populated by this same
// #861 PR, closing the null slot #812 left for HI), NOT in this module —
// this module is benefit-calculation only, per federal-tables.ts's own
// maxAllotmentFor/minimumBenefitFor split between FPL (income-eligibility)
// and max-allotment (benefit-calculation) axes.

import { Decimal } from "../decimal";

export interface HiAllotmentTable {
  /** FNS max allotment by household size, HI's real (non-48-contiguous)
   *  table. */
  max_allotment: Map<number, Decimal>;
  max_allotment_each_additional: Decimal;
  /** HI's own minimum-benefit floor (1-2 person HH), higher than the
   *  federal default ($24 FY26) every other non-elevated-tier state uses. */
  minimum_benefit: Decimal;
}

// FY26 (10/1/2025-9/30/2026). Verbatim from USDA FNS's own FY2026 COLA
// memorandum, quoted in full in issue #861.
export const HI_ALLOTMENT_TABLE: HiAllotmentTable = {
  max_allotment: new Map<number, Decimal>([
    [1, new Decimal("506")],
    [2, new Decimal("929")],
    [3, new Decimal("1334")],
    [4, new Decimal("1689")],
    [5, new Decimal("2010")],
    [6, new Decimal("2415")],
    [7, new Decimal("2668")],
    [8, new Decimal("3040")],
  ]),
  max_allotment_each_additional: new Decimal("371"),
  minimum_benefit: new Decimal("41"),
};
