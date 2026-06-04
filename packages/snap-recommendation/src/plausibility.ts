// Plausibility cross-checks P-01..P-08.
// Each citable to 7 CFR 273.2(e)(1) "explore and resolve".
// P-08 uses a simple heuristic (not classifyTenancy) — that API is for QC,
// not for intake routing.

import { aggregateIncome, checkHEAPCompliance, hasElderlyOrDisabled } from "@civica/snap-rules";
import type { Facts } from "@civica/snap-rules";
import type { AnsweredAxes, PlausibilityFlag } from "./types";

// Map snap-rules SUATier ("HCSUA"|"LUA"|"phone"|"none") to the token
// checkHEAPCompliance expects ("FULL"|"LIMITED"|"TELEPHONE"|"NONE").
function toHEAPTier(
  tier: string,
): "FULL" | "LIMITED" | "TELEPHONE" | "NONE" {
  switch (tier) {
    case "HCSUA": return "FULL";
    case "LUA":   return "LIMITED";
    case "phone": return "TELEPHONE";
    default:      return "NONE";
  }
}

export function runPlausibilityChecks(
  partialFacts: Partial<Facts>,
  answeredAxes: AnsweredAxes,
): PlausibilityFlag[] {
  const flags: PlausibilityFlag[] = [];

  // P-01: Managed-money indicator — rent > 80% of gross income
  if (partialFacts.income && partialFacts.shelter?.rent != null) {
    const gross = aggregateIncome(partialFacts as Facts).gross_total;
    if (gross > 0 && partialFacts.shelter.rent > 0.8 * gross) {
      flags.push({
        id: "P-01",
        probe:
          "Does someone else pay your rent directly, like a family member or the county?",
        citation: "7 CFR 273.2(e)(1); CDSS MPP 63-102.3",
        severity: "advisory",
      });
    }
  }

  // P-02: Dependent care without a child under 18
  if (
    (partialFacts.deductions?.dependent_care ?? 0) > 0 &&
    partialFacts.household != null &&
    !partialFacts.household.some((m) => m.age != null && m.age < 18)
  ) {
    flags.push({
      id: "P-02",
      probe:
        "There is a dependent care expense but no child under 18 on the household. Can you confirm who the care is for?",
      citation: "7 CFR 273.9(d)(4)",
      severity: "advisory",
    });
  }

  // P-03: SUA tier claimed but heating/cooling not confirmed
  if (
    partialFacts.shelter?.sua_tier != null &&
    partialFacts.shelter.sua_tier !== "none" &&
    answeredAxes.heating_cooling == null
  ) {
    flags.push({
      id: "P-03",
      probe:
        "Has your household paid for heat or air conditioning in the last 12 months?",
      citation: "7 CFR 273.9(d)(6)(vi); OBBBA §10102 (HEAP change)",
      severity: "advisory",
    });
  }

  // P-04: Medical deduction without an E/D member
  if (
    (partialFacts.deductions?.medical_unreimbursed ?? 0) > 0 &&
    partialFacts.household != null &&
    !hasElderlyOrDisabled(partialFacts as Facts)
  ) {
    flags.push({
      id: "P-04",
      probe:
        "Medical expenses can only be deducted for household members who are 60+ or have a disability. Is there such a member on this application?",
      citation: "7 CFR 273.9(d)(3)",
      severity: "advisory",
    });
  }

  // P-05: Zero assets, multiple adults, no cat-elig
  if (
    partialFacts.assets === 0 &&
    (partialFacts.household ?? []).length > 1 &&
    partialFacts.cat_elig === "NPA"
  ) {
    flags.push({
      id: "P-05",
      probe:
        "No liquid assets reported for a multi-adult household not on public assistance. Can you confirm there are no checking or savings accounts?",
      citation: "7 CFR 273.8; 7 CFR 273.2(e)(1)",
      severity: "advisory",
    });
  }

  // P-06: SE income, no deduction claimed as offset
  if (
    partialFacts.income?.some((l) => l.type === "self_employment") &&
    !partialFacts.income?.some((l) => l.type?.startsWith("excluded"))
  ) {
    flags.push({
      id: "P-06",
      probe:
        "Self-employment reported but no business expenses claimed. Are there costs like supplies, mileage, or equipment?",
      citation: "7 CFR 273.9(b)(2); CA ACL 17-04",
      severity: "advisory",
    });
  }

  // P-07: HEAP + Full SUA (OBBBA compliance)
  if (
    answeredAxes.receives_heap != null &&
    partialFacts.shelter?.sua_tier != null
  ) {
    const heapCheck = checkHEAPCompliance({
      receives_heap: answeredAxes.receives_heap,
      sua_tier_claimed: toHEAPTier(partialFacts.shelter.sua_tier),
    });
    if (heapCheck.heap_flag) {
      flags.push({
        id: "P-07",
        probe:
          "HEAP recipients no longer automatically qualify for the full utility allowance under the 2025 law. Does this household have a separate heating or cooling bill?",
        citation: "OBBBA §10102; 7 CFR 273.9(d)(6)(vi)",
        severity: "advisory",
      });
    }
  }

  // P-08: Informal housing detected — shelter deduction is indeterminate.
  // Heuristic: rent > 0, not homeless_deduction, ih_arrangement not resolved.
  // classifyTenancy is a QC tool (not designed for intake routing) so we use
  // a simpler signal here.
  if (
    (partialFacts.shelter?.rent ?? 0) > 0 &&
    !partialFacts.shelter?.homeless_deduction &&
    answeredAxes.ih_arrangement == null &&
    partialFacts.household != null &&
    partialFacts.household.length > 0
  ) {
    // Only fire if there are signals suggesting non-standard housing
    const hasMigrant = partialFacts.household.some((m) => m.living === "migrant");
    const hasNonStandardLiving = partialFacts.household.some(
      (m) =>
        m.living != null &&
        m.living !== "housed",
    );
    if (hasMigrant || hasNonStandardLiving) {
      flags.push({
        id: "P-08",
        probe:
          "The housing arrangement may need more information before shelter costs can be computed. Please complete the informal housing intake questions.",
        citation: "7 CFR 273.9(d)(6); 7 CFR 273.2(e)(1)",
        severity: "blocking",
      });
    }
  }

  return flags;
}
