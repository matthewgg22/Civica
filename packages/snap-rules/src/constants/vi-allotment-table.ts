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
// ── What this does NOT fix (disclosed, matching #858's own framing) ─────
// VI's own table also carries a lower Maximum Shelter Deduction ($586 vs.
// federal FY26's $744). `federal-tables.ts`'s `shelterCapFor()` has no
// per-state override slot at all (not even for AK) — extending it is a
// separate, larger schema change out of scope for this PR. #858 itself
// frames this as the non-material gap ("the shelter cap works in VI's
// favor if ever wrongly applied, i.e. it UNDER-caps rather than
// over-caps") — left disclosed-but-unfixed here, same as states.ts's own
// VI StatePolicy comment already notes.

import { Decimal } from "../decimal";

export interface ViAllotmentTable {
  /** FNS max allotment by household size, VI's real (non-48-contiguous)
   *  table. */
  max_allotment: Map<number, Decimal>;
  max_allotment_each_additional: Decimal;
  /** VI's own minimum-benefit floor (1-2 person HH), higher than the
   *  federal default ($24 FY26) every other non-elevated-tier state uses. */
  minimum_benefit: Decimal;
}

// FY26 (10/1/2025-9/30/2026). Verbatim from USVI DHS's own published table,
// quoted in full in issue #858.
export const VI_ALLOTMENT_TABLE: ViAllotmentTable = {
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
};
