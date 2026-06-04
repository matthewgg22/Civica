// Field taxonomy: verifiable / attestable / immutable.
// Gap G-06: engines don't expose this — hardcoded policy knowledge here.

import {
  ERROR_WEIGHT,
  PILLAR_MAX_DEFENSIBILITY_SHIFT,
} from "@civica/snap-qc-engine";
import type { VerificationMode } from "./types";

export const IMMUTABLE_FIELDS = new Set<string>([
  "household[].age",
  "household[].immigration",
  "household[].five_yr_bar",
  "household[].role",
  "household[].disability",
  "household[].elderly",
  "household[].member_id",
]);

export const VERIFIABLE_FIELDS: Record<string, string> = {
  "income[].amount (type=wages)":          "paystub",
  "income[].amount (type=wages_contract)": "contract_or_paystub",
  "income[].amount (type=platform_gig)":   "1099_or_platform_statement",
  "income[].amount (type=farm_se)":        "tax_return_or_records",
  "shelter.rent":                          "lease_or_landlord_letter",
  "deductions.medical_unreimbursed":       "medical_statement_or_receipts",
  "deductions.child_support_paid":         "court_order_or_payment_record",
};

export const ATTESTABLE_FIELDS = new Set<string>([
  "income[].amount (type=self_employment)",
  "income[].amount (type=cash)",
  "shelter.sua_tier",
  "deductions.dependent_care",
  "assets",
]);

export function fieldTag(fieldPath: string): VerificationMode {
  if (IMMUTABLE_FIELDS.has(fieldPath)) return "immutable";
  for (const v of Object.keys(VERIFIABLE_FIELDS)) {
    if (fieldPath.startsWith(v.split(" ")[0] ?? v)) return "verifiable";
  }
  if (ATTESTABLE_FIELDS.has(fieldPath)) return "attestable";
  return "attestable";
}

// ─── QC element map (Gap G-09 workaround) ────────────────────────────────────

export const INCOME_TYPE_TO_QC_ELEMENT: Record<string, string> = {
  wages:                    "311_wages",
  wages_contract:           "311_wages",
  self_employment:          "312_se",
  farm_se:                  "312_se",
  platform_gig:             "311_wages",
  americorps_vista_counted: "311_wages",
};

// ─── Income perturbation magnitude ε (dimensionless ratio) ───────────────────
// PILLAR_MAX_DEFENSIBILITY_SHIFT uses underscore keys (CivicaPillar).
// ERROR_WEIGHT uses hyphen keys (FlowKind).

export const INCOME_PERTURBATION_MAGNITUDE: Record<string, number> = {
  "311_wages": ERROR_WEIGHT["gig-income"] * PILLAR_MAX_DEFENSIBILITY_SHIFT["gig_income"],
  "312_se":    Math.min(
    0.30,
    ERROR_WEIGHT["gig-income"] * PILLAR_MAX_DEFENSIBILITY_SHIFT["gig_income"] * 1.5,
  ),
  "346_unearned":
    ERROR_WEIGHT["utility-sua"] * PILLAR_MAX_DEFENSIBILITY_SHIFT["utility_sua"],
};

export function incomeEpsilon(qcElement: string): number {
  return INCOME_PERTURBATION_MAGNITUDE[qcElement] ?? 0.15;
}
