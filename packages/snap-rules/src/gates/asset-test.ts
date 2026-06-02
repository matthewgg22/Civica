// Asset / resource test (7 CFR 273.8).
//
// Federal limits (FY26): $3,000 non-E/D, $4,500 E/D.
// States with BBCE or an explicit asset-waiver skip this test entirely.
// Cat-elig (pure_cash) households also skip per CategoricalResult.

import type { Facts } from "../facts.ts";
import { hasElderlyOrDisabled, countableAssets } from "../facts.ts";
import { assetLimitFor } from "../constants/federal-tables.ts";
import { statePolicyFor } from "../constants/states.ts";

export interface AssetTestResult {
  passes: boolean;
  threshold?: number | undefined;
  actual?: number | undefined;
  reason?: string | undefined;
  /** True if the test was waived (BBCE, asset_waiver, or cat-elig path). */
  waived: boolean;
}

export function assetTest(facts: Facts, state: string, asOf: Date): AssetTestResult {
  const policy = statePolicyFor(state);
  if (policy.asset_waiver) {
    return { passes: true, waived: true, reason: "state asset waiver" };
  }
  const cassets = countableAssets(facts);
  if (cassets === null) {
    // Sentinel "n/a:categorical_no_asset_test" or "n/a:not_authored" —
    // either the cat-elig path already waived or the fixture didn't
    // author. Treat as waived for our purposes.
    return { passes: true, waived: true, reason: "no countable assets (cat-elig or unauthored)" };
  }
  const isED = hasElderlyOrDisabled(facts);
  const limit = assetLimitFor(isED, asOf);
  const passes = cassets <= limit.toNumber();
  return {
    passes,
    waived: false,
    threshold: limit.toNumber(),
    actual: cassets,
    reason: passes ? undefined : `assets_over_limit [7 CFR 273.8]: ${cassets} > ${limit.toNumber()}`,
  };
}
