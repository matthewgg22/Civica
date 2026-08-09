// Re-exports of all federal + state constants used by the verdict
// composer. One import surface for downstream consumers.

export * from "./federal-tables";
export * from "./states";
export type { Decimal } from "../decimal";
export { dec, ZERO } from "../decimal";

/**
 * EngineParams snapshot for the profile-harness PARAMS_MISMATCH check.
 * Returns the engine's view of the constants for one (state, asOf).
 * Compared field-by-field against `suite.meta.params` in the harness.
 */
import { snapshotFor, fplMonthly } from "./federal-tables";
import { statePolicyFor } from "./states";

export interface EngineParams {
  // Each field is `?: T | undefined` so this struct can be populated
  // from intermediate computations that may yield undefined (e.g.
  // state-without-authored-SUA), without each assignment having to
  // narrow first. Required by tsconfig.base's
  // `exactOptionalPropertyTypes: true`.
  sd?: Record<string, number> | undefined;
  fpl?: Record<string, number> | undefined;
  max_allotment?: Record<string, number> | undefined;
  asset_limit?: number | undefined;
  asset_limit_ed?: number | undefined;
  shelter_cap?: number | undefined;
  min_benefit?: number | undefined;
  homeless_ded?: number | undefined;
  sua?: Record<string, number> | undefined;
}

export function getEngineParams(state: string, asOf: Date): EngineParams {
  const fed = snapshotFor(asOf);
  const stPol = statePolicyFor(state);
  const sd: Record<string, number> = {};
  for (let n = 1; n <= 8; n++) {
    sd[String(n)] = standardDeductionForKey(n, asOf).toNumber();
  }
  const fpl: Record<string, number> = {};
  for (let n = 1; n <= 8; n++) {
    // MUST come from fplMonthly — the same helper grossIncomeTest and
    // netIncomeTest use. Re-deriving it here with roundDollar() (HALF_UP)
    // instead of fplMonthly's floorDollar() put this row +$1 above the gates
    // at HH3 and HH6 in FY26, so anything quoting these params disagreed with
    // the engine's own determination and with CDSS ACIN I-46-25. See #601.
    fpl[String(n)] = fplMonthly(n, asOf).toNumber();
  }
  const maxA: Record<string, number> = {};
  for (let n = 1; n <= 8; n++) {
    maxA[String(n)] = (fed.max_allotment.get(n) ?? fed.max_allotment.get(8)!).toNumber();
  }
  let sua: Record<string, number> | undefined;
  if (stPol.sua_by_tier) {
    sua = {
      HCSUA: stPol.sua_by_tier.HCSUA.toNumber(),
      LUA: stPol.sua_by_tier.LUA.toNumber(),
      phone: stPol.sua_by_tier.phone.toNumber(),
      none: stPol.sua_by_tier.none.toNumber(),
    };
  }
  return {
    sd,
    fpl,
    max_allotment: maxA,
    asset_limit: fed.asset_limit_household.toNumber(),
    asset_limit_ed: fed.asset_limit_elderly_disabled.toNumber(),
    shelter_cap: fed.shelter_cap.toNumber(),
    min_benefit: fed.minimum_benefit.toNumber(),
    homeless_ded: fed.homeless_deduction.toNumber(),
    sua,
  };
}

// Internal: standardDeductionFor wrapped to suppress unused-import warning.
import { standardDeductionFor } from "./federal-tables";
function standardDeductionForKey(size: number, asOf: Date) {
  return standardDeductionFor(size, asOf);
}
