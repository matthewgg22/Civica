// SUA (Standard Utility Allowance) tier constants and derivation logic.
// CA FFY2026 values from CDSS ACIN I-46-25 (the annual COLA notice, issued
// 2026-08-16 — see the citation fix below).
//
// CORRECTED (#882, live-verified 2026-08-16): TELEPHONE was $44,
// citing "ACIN I-07-26" — a document that does not exist for this purpose
// (the real ACIN I-07-26, dated 2026-03-02, announces a CDSS website
// search widget and has nothing to do with SNAP/CalFresh). The real FFY2026
// Telephone Utility Allowance is $20, published in ACIN I-46-25
// (2025-09-03) alongside FULL/$663 and LIMITED/$170 — the same COLA notice
// packages/snap-rules/src/constants/states.ts already cites for CA's BBCE
// threshold. Independently confirmed live against LA County DPSS ePolicy
// 63-504.39 and the LSNC regulation summary "CalFresh Cost of Living
// Adjustment for Fiscal Year 2026" (both cite ACIN I-46-25, both give
// SUA/LUA/TUA = 663/170/20). $20 also already matched states.ts's CA
// StatePolicy.sua_by_tier.phone and the independently-authored oracle
// (data-ops/sample/civica-test-profiles/v0.6.json meta.params.sua_by_state
// .CA.phone) — this file's export was the only place $44 appeared, and the
// only place ACIN I-07-26 was cited. FULL/LIMITED were already correct.
export const CA_SUA_FFY2026 = {
  FULL: 663,
  LIMITED: 170,
  TELEPHONE: 20,
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
