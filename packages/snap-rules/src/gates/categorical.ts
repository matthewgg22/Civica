// Categorical eligibility (7 CFR 273.2(j)).
//
// Three paths in the v0.6 fixture's `facts.cat_elig`:
//   - "pure_SSI" — every member receives SSI; skip gross + asset tests
//   - "pure_PA" / "pure_TANF" — every member on TANF/GA; skip gross + asset tests
//   - "NPA"  — non-public-assistance (default)
//
// BBCE (broad-based categorical eligibility) is a separate, state-keyed
// path (handled in the verdict composer via state policy + bbce_threshold).

import type { Facts } from "../facts.ts";

export type CategoricalPath = "pure_cash" | "bbce" | "none";

export interface CategoricalResult {
  path: CategoricalPath;
  /** Skip the federal asset test? Both cat-elig paths do. */
  skip_asset_test: boolean;
  /** Skip the federal gross income test? Pure-cash does; BBCE replaces threshold. */
  skip_gross_test: boolean;
  reason: string;
}

export function evaluateCategorical(facts: Facts): CategoricalResult {
  const ce = facts.cat_elig;
  if (ce === "pure_SSI") {
    return {
      path: "pure_cash",
      skip_asset_test: true,
      skip_gross_test: true,
      reason: "categorically eligible: every member receives SSI [7 CFR 273.2(j)(2)(i)]",
    };
  }
  if (ce === "pure_PA" || ce === "pure_TANF") {
    return {
      path: "pure_cash",
      skip_asset_test: true,
      skip_gross_test: true,
      reason: "categorically eligible: every member receives TANF/GA [7 CFR 273.2(j)(2)(i)]",
    };
  }
  return {
    path: "none",
    skip_asset_test: false,
    skip_gross_test: false,
    reason: "non-categorical (NPA) household",
  };
}
