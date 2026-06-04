// DETERMINATIVE_FIELDS manifest + completeness predicates.
// Until Gap G-01 is closed (engine-side ELICIT mode), this is the single
// source of truth for which Facts fields Component R must ask about.

import type { Facts, Member } from "@civica/snap-rules";
import type { AnsweredAxes, ElicitationQuestion } from "./types";

export interface DeterminativeField {
  path: string;
  knockout: number;
  branchPredicate: (f: Partial<Facts>, a: AnsweredAxes) => boolean;
  optional?: boolean;   // advisory — does not block DETERMINE if absent
  question: ElicitationQuestion;
}

const always = () => true;
const hasLPRMember = (f: Partial<Facts>) =>
  (f.household ?? []).some((m: Member) => m.immigration === "lpr");
const hasStudentAgeMembers = (f: Partial<Facts>) =>
  (f.household ?? []).some((m: Member) => m.age != null && m.age >= 18 && m.age <= 49);
const hasABAWDAgeMember = (f: Partial<Facts>) =>
  (f.household ?? []).some((m: Member) => m.age != null && m.age >= 18 && m.age <= 64);
const hasEDMember = (f: Partial<Facts>) =>
  (f.household ?? []).some((m: Member) => (m.disability === true) || (m.elderly === true) ||
    (m.age != null && m.age >= 60));

export const DETERMINATIVE_FIELDS: DeterminativeField[] = [
  // ── GROUP 1: immigration / disqualifications ──────────────────────────────
  {
    path: "household[].immigration",
    knockout: 1,
    branchPredicate: always,
    question: {
      field_path: "household[].immigration",
      question: "What is each household member's citizenship or immigration status?",
      type: "select",
      options: ["citizen", "lpr", "refugee", "cofa", "undocumented", "other"],
      knockout: 1,
    },
  },
  {
    path: "household[].five_yr_bar",
    knockout: 1,
    branchPredicate: hasLPRMember,
    question: {
      field_path: "household[].five_yr_bar",
      question: "For each green card holder, how long have they held LPR status?",
      type: "text",
      knockout: 1,
    },
  },
  {
    path: "household[].disqual",
    knockout: 1,
    branchPredicate: always,
    question: {
      field_path: "household[].disqual",
      question: "Has any household member been disqualified from SNAP for fraud, a drug felony, fleeing felon status, or lottery winnings?",
      type: "multi_select",
      options: ["ipv", "drug_felony", "fleeing_felon", "lottery", "none"],
      knockout: 1,
    },
  },

  // ── GROUP 2: household composition + safety routing ───────────────────────
  {
    path: "household[].age",
    knockout: 2,
    branchPredicate: always,
    question: {
      field_path: "household[].age",
      question: "What is each household member's age?",
      type: "number",
      knockout: 2,
    },
  },
  {
    path: "household[].role",
    knockout: 2,
    branchPredicate: always,
    question: {
      field_path: "household[].role",
      question: "What is each person's role in the household?",
      type: "select",
      options: ["head", "spouse", "child", "other"],
      knockout: 2,
    },
  },
  // DV safety question — optional; never written to portal payload.
  // Phrasing is a placeholder pending DV advocacy review.
  {
    path: "answeredAxes.contact_safety_concern",
    knockout: 2,
    branchPredicate: always,
    optional: true,
    question: {
      field_path: "answeredAxes.contact_safety_concern",
      question: "Is there anyone — like a former partner — who must not be contacted about this application, for your safety?",
      type: "select",
      options: ["yes", "no", "prefer_not_to_say"],
      knockout: 2,
    },
  },

  // ── GROUP 3: categorical eligibility ─────────────────────────────────────
  {
    path: "cat_elig",
    knockout: 3,
    branchPredicate: always,
    question: {
      field_path: "cat_elig",
      question: "Does anyone in the household currently receive TANF, SSI, or Medicaid?",
      type: "select",
      options: ["NPA", "TANF", "pure_cash", "Medicaid"],
      knockout: 3,
    },
  },

  // ── GROUP 4: student gate ─────────────────────────────────────────────────
  {
    path: "household[].student",
    knockout: 4,
    branchPredicate: hasStudentAgeMembers,
    question: {
      field_path: "household[].student",
      question: "For household members aged 18–49: are any enrolled in college or vocational training half-time or more?",
      type: "select",
      options: ["not", "half_time", "full_time"],
      knockout: 4,
    },
  },

  // ── GROUP 5: ABAWD work requirement ──────────────────────────────────────
  {
    path: "household[].work_class",
    knockout: 5,
    branchPredicate: hasABAWDAgeMember,
    question: {
      field_path: "household[].work_class",
      question: "For household members aged 18–64 without dependents: are they currently working, in a work program, or exempt?",
      type: "select",
      options: ["gen_work_subject", "work_exempt", "not_working"],
      knockout: 5,
    },
  },

  // ── GROUP 6: income ───────────────────────────────────────────────────────
  {
    path: "income[].type",
    knockout: 6,
    branchPredicate: always,
    question: {
      field_path: "income[].type",
      question: "What types of income does the household receive?",
      type: "multi_select",
      options: ["wages", "self_employment", "platform_gig", "unearned", "none"],
      knockout: 6,
    },
  },
  {
    path: "income[].amount",
    knockout: 6,
    branchPredicate: always,
    question: {
      field_path: "income[].amount",
      question: "What is the monthly amount for each income source?",
      type: "number",
      knockout: 6,
    },
  },

  // ── GROUP 7: shelter ──────────────────────────────────────────────────────
  {
    path: "shelter.rent",
    knockout: 7,
    branchPredicate: always,
    question: {
      field_path: "shelter.rent",
      question: "How much does the household pay per month for rent or mortgage?",
      type: "number",
      knockout: 7,
    },
  },
  {
    path: "shelter.sua_tier",
    knockout: 7,
    branchPredicate: always,
    question: {
      field_path: "shelter.sua_tier",
      question: "Does the household pay for utilities? (Select the highest that applies: heating/cooling, electric/gas, phone, none)",
      type: "select",
      options: ["HCSUA", "LUA", "phone", "none"],
      knockout: 7,
    },
  },
  {
    path: "shelter.homeless_deduction",
    knockout: 7,
    branchPredicate: always,
    question: {
      field_path: "shelter.homeless_deduction",
      question: "Is the household homeless (no fixed shelter address)?",
      type: "boolean",
      knockout: 7,
    },
  },

  // ── GROUP 8: deductions ───────────────────────────────────────────────────
  {
    path: "deductions.dependent_care",
    knockout: 8,
    branchPredicate: always,
    question: {
      field_path: "deductions.dependent_care",
      question: "Does the household pay for dependent care (child care, adult day care) to allow a member to work or attend training? Enter 0 if none.",
      type: "number",
      knockout: 8,
    },
  },
  {
    path: "deductions.medical_unreimbursed",
    knockout: 8,
    branchPredicate: hasEDMember,
    question: {
      field_path: "deductions.medical_unreimbursed",
      question: "For elderly or disabled household members: what are the monthly out-of-pocket medical expenses not covered by insurance? Enter 0 if none.",
      type: "number",
      knockout: 8,
    },
  },
  {
    path: "deductions.child_support_paid",
    knockout: 8,
    branchPredicate: always,
    question: {
      field_path: "deductions.child_support_paid",
      question: "Does the household pay child support under a legal obligation? Enter the monthly amount, or 0 if none.",
      type: "number",
      knockout: 8,
    },
  },

  // ── GROUP 9: assets ───────────────────────────────────────────────────────
  {
    path: "assets",
    knockout: 9,
    // Conservative: always ask. assetTestMayApply would require statePolicyFor()
    // which is not in the public barrel (gap — noted in build report).
    branchPredicate: always,
    question: {
      field_path: "assets",
      question: "What is the total value of household liquid assets (bank accounts, cash on hand)? Enter 0 if none.",
      type: "number",
      knockout: 9,
    },
  },
];

// ─── Optional fields allowlist ────────────────────────────────────────────────
// Every Facts leaf not in DETERMINATIVE_FIELDS must appear here.
// Used by Half B of manifest-consistency.test.ts.

export const OPTIONAL_FIELDS: Record<string, string> = {
  "household[].member_id":         "Immutable identifier; not a user-facing question",
  "household[].elderly":           "Derived from age ≥ 60; not asked directly",
  "household[].sponsored":         "Derived from immigration=lpr; branched under five_yr_bar",
  "household[].work_class":        "Internal classification; not a user-facing question",
  "household[].abawd_months_used": "Caseworker-keyed; not elicited in intake",
  "household[].living":            "Encoded via informal-housing intake flow (P-08)",
  "income[].freq":                 "Normalisation detail; amount is determinative",
  "income[].anticipation":         "Metadata on income reliability; affects Class 2 P-prior",
  "income[].source_status":        "Metadata on continuity; affects Class 2, not verdict",
  "income[].member":               "Binding set by composition; not an elicitation question",
  "shelter.sua_amount":            "Override; only set when SUA tier conflicts with state table",
  "shelter.internet":              "Excluded from shelter calc FY26 (OBBBA §10104); always 0",
  "expedited":                     "Set by agency, not applicant intake",
  "sponsor_income":                "Elicited under household[].sponsored branch",
  "as_of_date":                    "System field; not a user-facing question",
};

// ─── Field presence check ─────────────────────────────────────────────────────

export function isFieldPresent(facts: Partial<Facts>, path: string): boolean {
  switch (path) {
    case "household[].immigration":
      return (facts.household ?? []).every((m) => m.immigration != null);
    case "household[].five_yr_bar":
      return (facts.household ?? [])
        .filter((m) => m.immigration === "lpr")
        .every((m) => m.five_yr_bar != null);
    case "household[].disqual":
      return (facts.household ?? []).every((m) => m.disqual != null);
    case "household[].age":
      return (facts.household ?? []).every((m) => m.age != null);
    case "household[].role":
      return (facts.household ?? []).every((m) => m.role != null);
    case "household[].student":
      return (facts.household ?? [])
        .filter((m) => m.age != null && m.age >= 18 && m.age <= 49)
        .every((m) => m.student != null);
    case "household[].work_class":
      return (facts.household ?? [])
        .filter((m) => m.age != null && m.age >= 18 && m.age <= 64)
        .every((m) => m.work_class != null);
    case "cat_elig":
      return facts.cat_elig != null;
    case "income[].type":
      // undefined income = not answered; empty array = explicit "no income" (valid)
      return Array.isArray(facts.income) && facts.income.every((l) => l.type != null);
    case "income[].amount":
      return Array.isArray(facts.income) && facts.income.every((l) => l.amount != null);
    case "shelter.rent":
      return facts.shelter != null && facts.shelter.rent != null;
    case "shelter.sua_tier":
      return facts.shelter != null && facts.shelter.sua_tier != null;
    case "shelter.homeless_deduction":
      return facts.shelter != null && facts.shelter.homeless_deduction != null;
    case "deductions.dependent_care":
      return facts.deductions != null && facts.deductions.dependent_care != null;
    case "deductions.medical_unreimbursed":
      return facts.deductions != null && facts.deductions.medical_unreimbursed != null;
    case "deductions.child_support_paid":
      return facts.deductions != null && facts.deductions.child_support_paid != null;
    case "assets":
      return facts.assets != null;
    case "answeredAxes.contact_safety_concern":
      return true; // optional; always treated as present
    default:
      return true;
  }
}
