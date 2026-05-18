// 7 CFR Part 273 — SNAP federal regulations.
//
// TODO(T10): once `@civica/cfr-273` Tier 2 reference package ships,
// import structured citation data from there. For now, these strings
// are pinned to match the prototype's existing output verbatim so
// parity tests on evidence_package don't drift.

import type { Citation } from "../schemas.js";

export const CFR_273_SHELTER_VERIFICATION =
  "7 CFR 273.2(f)(1)(vi) — verification of shelter expenses";
export const CFR_273_EARNED_INCOME_VERIFICATION =
  "7 CFR 273.2(f)(1)(ii) — verification of earned income";
export const CFR_273_HOUSEHOLD_INCOME_CALC =
  "7 CFR 273.10(c) — calculation of household income";
export const CFR_273_RESOURCE_TEST = "7 CFR 273.8";
export const CFR_273_BBCE = "7 CFR 273.2(j)";

export function asCitation(reference: string): Citation {
  return { authority: "7 CFR Part 273", reference };
}
