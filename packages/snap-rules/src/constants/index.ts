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
import {
  fplMonthly,
  standardDeductionFor,
  maxAllotmentFor,
  assetLimitFor,
  shelterCapFor,
  minimumBenefitFor,
  homelessDeductionFor,
} from "./federal-tables";
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
  // #675: BBCE gross-income screen (percent of FPL) for `state`, sourced
  // straight from StatePolicy.bbce_threshold_pct — undefined when `state`
  // has no authored BBCE axis. Added so demeter-engine's engine-citations.ts
  // can read this from the engine instead of hand-duplicating a per-state
  // percentage map (BBCE_PCT) that has no mechanical link back to this
  // value and had already drifted once (OH: map said 130, states.ts says
  // 200 — caught fixing this issue).
  bbce_threshold_pct?: number | undefined;
}

/**
 * `countyFips` is OPTIONAL, same shape as `maxAllotmentFor`/
 * `minimumBenefitFor` below — omitting it is safe (AK falls back to its
 * Urban zone, the same default those functions use when a household's
 * real county isn't known yet). This function has no household to draw a
 * county from, so callers that DO know one (e.g. a per-request citation
 * surface) can pass it for AK zone precision; callers that don't (a
 * generic "what does the engine currently say for state X" query) get the
 * same Urban-zone default `benefit-calc.ts` uses in the same situation.
 */
export function getEngineParams(state: string, asOf: Date, countyFips?: string): EngineParams {
  const stPol = statePolicyFor(state, asOf);
  const sd: Record<string, number> = {};
  for (let n = 1; n <= 8; n++) {
    sd[String(n)] = standardDeductionFor(n, asOf, state).toNumber();
  }
  const fpl: Record<string, number> = {};
  for (let n = 1; n <= 8; n++) {
    // MUST come from fplMonthly — the same helper grossIncomeTest and
    // netIncomeTest use. Re-deriving it here with roundDollar() (HALF_UP)
    // instead of fplMonthly's floorDollar() put this row +$1 above the gates
    // at HH3 and HH6 in FY26, so anything quoting these params disagreed with
    // the engine's own determination and with CDSS ACIN I-46-25. See #601.
    // `state` also selects the region (#812) — AK gets its own, higher FPL.
    fpl[String(n)] = fplMonthly(n, asOf, state).toNumber();
  }
  // CORRECTED (#882): this used to read straight off the 48-contiguous
  // federal snapshot for every state, which is exactly the #601-class
  // drift this function's own FPL comment above warns against — just on
  // the state axis instead of the household-size axis. max_allotment,
  // shelter_cap, min_benefit, and sd (above) now call the SAME
  // state-conditioned functions benefit-calc.ts uses, so AK/VI/HI/GU get
  // their real, elevated (or for VI, partly lower) figures instead of the
  // 48-contiguous defaults. Every other state's output is byte-identical
  // to before, since these functions no-op on `state` outside those four.
  const maxA: Record<string, number> = {};
  for (let n = 1; n <= 8; n++) {
    maxA[String(n)] = maxAllotmentFor(n, asOf, state, countyFips).toNumber();
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
    // Asset limits are federally uniform — no state axis exists to drift
    // on, so assetLimitFor() takes no `state` (verified: federal-tables.ts
    // never branches this on state for any jurisdiction).
    asset_limit: assetLimitFor(false, asOf).toNumber(),
    asset_limit_ed: assetLimitFor(true, asOf).toNumber(),
    shelter_cap: shelterCapFor(asOf, state).toNumber(),
    min_benefit: minimumBenefitFor(asOf, state, countyFips).toNumber(),
    homeless_ded: homelessDeductionFor(asOf).toNumber(),
    sua,
    bbce_threshold_pct: stPol.bbce_threshold_pct,
  };
}
