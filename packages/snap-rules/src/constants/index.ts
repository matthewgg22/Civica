// Re-exports of all federal + state constants used by the verdict
// composer. One import surface for downstream consumers.

export * from "./federal-tables.ts";
export * from "./states.ts";
export type { Decimal } from "../decimal.ts";
export { dec, ZERO } from "../decimal.ts";

/**
 * EngineParams snapshot for the profile-harness PARAMS_MISMATCH check.
 * Returns the engine's view of the constants for one (state, asOf).
 * Compared field-by-field against `suite.meta.params` in the harness.
 */
import { snapshotFor } from "./federal-tables.ts";
import { statePolicyFor } from "./states.ts";

export interface EngineParams {
  sd?: Record<string, number>;
  fpl?: Record<string, number>;
  max_allotment?: Record<string, number>;
  asset_limit?: number;
  asset_limit_ed?: number;
  shelter_cap?: number;
  min_benefit?: number;
  homeless_ded?: number;
  sua?: Record<string, number>;
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
    fpl[String(n)] = fed.fpl_annual_first_person
      .add(fed.fpl_annual_each_additional.mul(n - 1))
      .div(12)
      .roundDollar()
      .toNumber();
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
import { standardDeductionFor } from "./federal-tables.ts";
function standardDeductionForKey(size: number, asOf: Date) {
  return standardDeductionFor(size, asOf);
}
