// SUA (Standard Utility Allowance) tier constants and derivation logic.
// CA FFY2026 values from CDSS ACIN I-07-26.

export const CA_SUA_FFY2026 = {
  FULL: 663,
  LIMITED: 170,
  TELEPHONE: 44,
  NONE: 0,
} as const;

export type SUATier = keyof typeof CA_SUA_FFY2026;

// Derives the allowable SUA tier from applicant utility answers.
// Requires answers to the three SUA-specific questionnaire questions
// (has_heating_costs, has_electric_or_gas, has_phone). Returns null
// if any required answer is missing.
export function determineSUATier(answers: {
  has_heating_costs: "yes" | "no" | null | undefined;
  has_electric_or_gas: "yes" | "no" | null | undefined;
  has_phone: "yes" | "no" | null | undefined;
}): SUATier | null {
  if (answers.has_heating_costs == null) return null;
  if (answers.has_electric_or_gas == null) return null;
  if (answers.has_phone == null) return null;

  if (answers.has_heating_costs === "yes") return "FULL";
  if (answers.has_electric_or_gas === "yes") return "LIMITED";
  if (answers.has_phone === "yes") return "TELEPHONE";
  return "NONE";
}

// OBBBA HR 1 (2026): HEAP recipients no longer automatically qualify for the
// Full SUA. Flag any packet where the applicant claims FULL tier AND reports
// receiving HEAP energy assistance. This is a non-blocking amber flag in Phase 1;
// actual utility verification is deferred to Phase 2 pending enrolled bill date.
export function checkHEAPCompliance(answers: {
  receives_heap: "yes" | "no" | null | undefined;
  sua_tier_claimed: SUATier | null;
}): { heap_flag: boolean; flag_reason: "obbba_heap_change" | null } {
  if (answers.receives_heap === "yes" && answers.sua_tier_claimed === "FULL") {
    return { heap_flag: true, flag_reason: "obbba_heap_change" };
  }
  return { heap_flag: false, flag_reason: null };
}
