// FeasibilityContext derivation.
// DV answer is the primary signal; ih_arrangement is the fallback only.
// The contact_safety_concern answer must NEVER flow into portal payloads.

import type { Facts } from "@civica/snap-rules";
import type { AnsweredAxes, FeasibilityContext } from "./types";

export function deriveFeasibilityContext(
  facts: Partial<Facts>,
  answeredAxes: AnsweredAxes,
): FeasibilityContext {
  // DV: explicit question is primary; ih_arrangement fallback only for cases
  // where the explicit question was not yet asked (e.g., informal intake ran first).
  const dvExplicit =
    answeredAxes.contact_safety_concern === "yes" ||
    answeredAxes.contact_safety_concern === "prefer_not_to_say";
  const dvFallback = answeredAxes.ih_arrangement === "dv_shelter";

  return {
    is_homeless:
      facts.shelter?.homeless_deduction === true ||
      answeredAxes.ih_arrangement === "homeless_no_shelter_cost" ||
      answeredAxes.ih_arrangement === "homeless_with_cost",

    is_dv_survivor: dvExplicit || dvFallback,

    is_migrant: (facts.household ?? []).some((m) => m.living === "migrant"),

    is_in_treatment: (facts.household ?? []).some(
      (m) => m.living === "treatment_ctr",
    ),
  };
}
