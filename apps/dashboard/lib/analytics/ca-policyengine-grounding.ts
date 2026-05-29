// CA SNAP benefit leverage by error element — the MODELED lens. How many dollars
// of benefit a single dollar of error in each part of the application actually
// moves. Computed offline with PolicyEngine US over a representative CA household
// panel; vendored at data-ops/sample/policyengine-ca/element_leverage_fy2024.json
// (reproducible via tools/policyengine-ground). Cited to finding
// 2026-05-29-policyengine-benefit-leverage. Same posture as per-history.ts.
//
// PolicyEngine US is AGPL-3.0 and is NEVER imported into runtime — these are
// the offline-generated facts, not the library.

export const CA_POLICYENGINE_GROUNDING = {
  paramYear: 2024,
  peVersion: "1.715.2",
  /** Benefit $ lost per $1 of unreported unearned income (median; counts ~dollar-for-dollar). */
  unearnedLeverage: 0.3,
  /** Benefit $ lost per $1 of unreported wages (structural max; softened by the 20% earned-income deduction). */
  wagesLeverage: 0.24,
  /** Shelter leverage for elderly/disabled (UNCAPPED) households. */
  shelterUncappedLeverage: 0.3,
  /** Share of non-elderly CA households already over the excess-shelter cap (shelter leverage ~0). */
  shelterCappedShareNonElderly: 0.72,
  /** Mean correct monthly benefit across the modeled panel. */
  meanBenefitMonthly: 354,
  findingId: "2026-05-29-policyengine-benefit-leverage",
} as const;
