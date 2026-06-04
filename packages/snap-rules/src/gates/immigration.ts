// Immigration eligibility (7 CFR 273.4; FNA 6(f); OBBBA §10108).
//
// Per-member status dispatch (see `memberImmigrationEligible` in
// ../facts.ts for the canonical implementation):
//   citizen                         → eligible (always)
//   lpr + five_yr_bar exempt        → eligible (40-quarter or humanitarian exemption)
//   lpr + five_yr_bar "n/a"         → eligible (no bar applies — already 5+ years)
//   lpr + five_yr_bar numeric       → ineligible during bar window
//   cofa                            → eligible (Compact of Free Association — retained post-OBBBA §10108)
//   refugee                         → eligible (pre-OBBBA classification)
//   removed_status:refugee          → ineligible (OBBBA §10108 removed humanitarian retention pre-LPR adjustment)
//   undocumented                    → ineligible
//
// HH-level: if NO member is eligible → DENY. If SOME (mixed-status, e.g.
// M18) → APPROVE.
//
// 7 CFR 273.11(c)(1) — household-size + income treatment of the
// ineligible alien (NOT done here; handled by `eligibleHouseholdSize` +
// `aggregateIncomeForCalc` in ../facts.ts, wired through benefit-calc
// and the gross/net income tests):
//   - HH size for max allotment, standard deduction, FPL thresholds,
//     shelter cap, min-benefit floor EXCLUDES the ineligible alien
//     (273.11(c)(1)(i)). The ineligible alien remains a household
//     member structurally — shelter accrues, address shared — but is
//     not counted in `size`.
//   - The ineligible alien's INCOME counts in full per the count-all
//     election (273.11(c)(3)(i)(A)), which CA's CalFresh handbook
//     §63-503.481 elects. This is Read A; see facts.ts for the
//     reasoning and the future Read B (pro-rata) branch point.
//
// Sponsor deeming: if `member.sponsored === true` AND `facts.sponsor_income`
// is set, the sponsor income is deemed to the household — implemented in
// aggregateIncome via composer hook (verdict.ts).

import type { Facts } from "../facts";
import { memberImmigrationEligible } from "../facts";

// Re-export for callers that historically reached for it here
// (gates/disqualifications.ts and external snap-rules consumers).
export { memberImmigrationEligible };

export interface ImmigrationResult {
  passes: boolean;
  /** Member IDs that are eligible (used by proration math; v1 just counts). */
  eligible_member_ids: string[];
  reason?: string;
}

export function evaluateImmigration(facts: Facts, asOf: Date): ImmigrationResult {
  const eligible = facts.household.filter((m) => memberImmigrationEligible(m, asOf));
  if (eligible.length === 0) {
    return {
      passes: false,
      eligible_member_ids: [],
      reason: "no_eligible_household_member [7 CFR 273.4; FNA 6(f)]",
    };
  }
  return {
    passes: true,
    eligible_member_ids: eligible.map((m) => m.member_id),
  };
}

/** True if any member is sponsored — composer adds sponsor_income then. */
export function anySponsored(facts: Facts): boolean {
  return facts.household.some((m) => m.sponsored === true);
}
