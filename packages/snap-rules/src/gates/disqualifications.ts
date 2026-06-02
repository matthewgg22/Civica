// HH-level disqualifications. Each member's `disqual[]` array carries
// tags that bar the household per regulation.
//
// Tag handling:
//   "lottery"                       → whole HH ineligible until requalifies [7 CFR 272.17]
//   "ipv:tier1" / "ipv:tier2"       → member excluded; whole HH ineligible if no others remain [7 CFR 273.16]
//   "fleeing_felon"                 → member ineligible; whole HH ineligible if no others remain [7 CFR 273.11(n)]
//   "drug_felony"                   → STATE OPTION: ineligible only when policy.drug_felony_ban === true [7 CFR 273.11(m)]
//
// Variant flags processed here too:
//   active_warrant === true         → fleeing_felon disqualification fires (P52 axis)

import type { Facts } from "../facts.ts";
import { memberImmigrationEligible } from "./immigration.ts";
import { statePolicyFor } from "../constants/states.ts";

export interface DisqualResult {
  passes: boolean;
  reason?: string | undefined;
  /** Member IDs disqualified at the member level (for benefit proration). */
  disqualified_member_ids?: string[] | undefined;
}

export function evaluateDisqualifications(
  facts: Facts,
  state: string,
  asOf: Date,
): DisqualResult {
  const policy = statePolicyFor(state);
  const disqualifiedIds: string[] = [];

  // Variant flag — variants can flip whether the fleeing-felon tag fires.
  const activeWarrant = (facts as any).active_warrant === true;

  for (const m of facts.household) {
    const disquals = m.disqual ?? [];
    for (const tag of disquals) {
      // HH-level disqualifications (one member triggers whole-HH DENY).
      if (tag === "lottery") {
        return {
          passes: false,
          reason: `household_lottery_disqualification [7 CFR 272.17]: ${m.member_id}`,
        };
      }
      if (tag === "drug_felony") {
        if (policy.drug_felony_ban) {
          return {
            passes: false,
            reason: `drug_felony_state_ban [7 CFR 273.11(m)]: ${m.member_id}`,
          };
        }
        // No state ban → not disqualifying.
        continue;
      }

      // Member-level disqualifications (member excluded, HH may continue).
      if (tag.startsWith("ipv:")) {
        disqualifiedIds.push(m.member_id);
        continue;
      }
      if (tag === "fleeing_felon") {
        // The fleeing_felon disqualification requires an active warrant.
        // Per FNS guidance + the v0.6 P52 axis, the disqualification
        // fires only when the warrant is active.
        if (activeWarrant) {
          disqualifiedIds.push(m.member_id);
        }
        continue;
      }
    }
  }

  // HH-DENY if no one remains eligible after subtracting disqualified
  // members + immigration-ineligible members.
  const remainingEligible = facts.household.filter(
    (m) =>
      !disqualifiedIds.includes(m.member_id) &&
      memberImmigrationEligible(m, asOf),
  );
  if (remainingEligible.length === 0) {
    return {
      passes: false,
      reason: `no_eligible_member_after_disqualifications [7 CFR 273.16; 273.11]`,
      disqualified_member_ids: disqualifiedIds,
    };
  }

  return {
    passes: true,
    disqualified_member_ids: disqualifiedIds.length > 0 ? disqualifiedIds : undefined,
  };
}
