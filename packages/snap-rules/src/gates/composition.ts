// Household composition gate (7 CFR 273.1).
//
// Three patterns from v0.6 variants that this gate handles:
//
//  1. Mandatory combination under-22 (7 CFR 273.1(a)):
//     Adult children under 22 living with parents MUST be in the parent's
//     household. The fixture exposes this via the variant flag
//     `must_combine_with_parent === true` (P51). When set, the combined
//     household's gross income exceeds the threshold → DENY.
//
//  2. Coresident income deeming (7 CFR 273.1(b) elderly separate-HH):
//     An elderly person can establish a separate household ONLY if the
//     coresident's gross income is at or below 165% FPL. The fixture
//     exposes this via `coresident_income_pct` (M21). When the coresident
//     exceeds the threshold, separation fails → combined HH → DENY.
//
//  3. Roomer/boarder split (7 CFR 273.1(a)):
//     A roomer (rents room only) is a SEPARATE household. A boarder
//     (rents + shares meals) is PART OF the provider's household — not
//     independently eligible. The fixture exposes this via the variant
//     flags `household.0.role === "boarder"` + `shares_meals === true`.
//     M22 axis.
//
// V1 limitation: this gate handles the specific variant axes the dataset
// tests. Full HH composition modeling (e.g. arbitrary roomer/sub-leaser
// detection from base facts) is deferred until the harness or downstream
// API needs it.

import type { Facts } from "../facts";

export interface CompositionResult {
  passes: boolean;
  reason?: string;
}

export function evaluateComposition(facts: Facts): CompositionResult {
  const raw = facts as any;

  // Pattern 1: mandatory under-22 combination with parent.
  if (raw.must_combine_with_parent === true) {
    return {
      passes: false,
      reason: "mandatory_combination_under22 [7 CFR 273.1(a)]: combined household income exceeds threshold",
    };
  }

  // Pattern 2: coresident exceeds 165% FPL → separation denied.
  // The 165% threshold is the federal floor; states with BBCE may use a
  // higher threshold but the elderly-separate-HH rule is federal at 165%.
  if (typeof raw.coresident_income_pct === "number" && raw.coresident_income_pct > 165) {
    return {
      passes: false,
      reason: `coresident_income_over_165pct [7 CFR 273.1(b)]: ${raw.coresident_income_pct}% FPL`,
    };
  }

  // Pattern 3: boarder (shares meals + role boarder) → not independent.
  for (const m of facts.household) {
    if (m.role === "boarder" && raw.shares_meals === true) {
      return {
        passes: false,
        reason: `boarder_not_independent_household [7 CFR 273.1(a)]: ${m.member_id}`,
      };
    }
  }

  return { passes: true };
}
