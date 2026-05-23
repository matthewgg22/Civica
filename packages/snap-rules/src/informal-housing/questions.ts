/**
 * Informal housing intake — question bank.
 *
 * Replaces "self-attestation" with a structured branching wizard for
 * applicants who don't have a written lease. Captures enough information
 * for snap-calculator to compute the shelter deduction defensibly, even
 * though no lease document exists.
 *
 * Format mirrors the existing question_key system in packet_answers — the
 * iOS app and enrollment-api read answers by `key` and write `applicant_answer`
 * strings. Branch logic is enforced at render time by the iOS wizard.
 *
 * Question keys are prefixed `ih_` (informal housing) to namespace cleanly
 * against existing utility / employment / housing_situation questions.
 */

import type { InformalArrangementKind, PaymentCadence, EvidenceKind } from "./types";

// ---------------------------------------------------------------------------
// Question DSL
// ---------------------------------------------------------------------------

export type AnswerKind = "single_select" | "multi_select" | "money" | "boolean" | "text" | "person_name";

export interface BranchCondition {
  /** Show this question only if answer to `if_key` matches `if_in`. */
  if_key: string;
  if_in: string[];
}

export interface IntakeQuestion {
  key: string;
  prompt: string;
  helper?: string;
  kind: AnswerKind;
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** If set, show only when condition is satisfied. */
  show_when?: BranchCondition;
  /** Required for branch logic to proceed; "soft" means optional. */
  required: "hard" | "soft";
}

// ---------------------------------------------------------------------------
// Question bank — 11 questions, branching to 4-7 depending on arrangement
// ---------------------------------------------------------------------------

export const INFORMAL_HOUSING_QUESTIONS: ReadonlyArray<IntakeQuestion> = [
  // -------------------------------------------------------------------------
  // Q1 — Root branch: what kind of arrangement
  // -------------------------------------------------------------------------
  {
    key: "ih_arrangement",
    prompt: "Which best describes where you're living right now?",
    helper: "Pick the closest match. We'll ask a few follow-ups based on your answer.",
    kind: "single_select",
    required: "hard",
    options: [
      { value: "family_rent",              label: "Paying rent to a family member" },
      { value: "doubled_up_friends",       label: "Sharing a place with friends or roommates (no lease in my name)" },
      { value: "room_rental_no_lease",     label: "Renting a room in someone's home (no written lease)" },
      { value: "motel_weekly",             label: "Staying in a motel or hotel" },
      { value: "homeless_no_shelter_cost", label: "I don't have a regular place to sleep at night" },
      { value: "homeless_with_cost",       label: "I'm homeless but paying for shelter (transitional, shelter stay)" },
      { value: "utilities_only",           label: "Living somewhere rent-free but I pay the utilities" },
      { value: "dv_shelter",               label: "Staying in a domestic violence shelter or victim-services housing" },
    ] satisfies ReadonlyArray<{ value: InformalArrangementKind; label: string }>,
  },

  // -------------------------------------------------------------------------
  // Q2 — Monthly shelter cost (for everything except homeless-no-cost / DV shelter)
  // -------------------------------------------------------------------------
  {
    key: "ih_monthly_cost_usd",
    prompt: "About how much do you pay each month for housing?",
    helper: "Estimate is fine. If you pay weekly, give us the weekly amount and we'll convert.",
    kind: "money",
    required: "hard",
    show_when: {
      if_key: "ih_arrangement",
      if_in: ["family_rent", "doubled_up_friends", "room_rental_no_lease", "motel_weekly", "homeless_with_cost", "utilities_only"],
    },
  },

  // -------------------------------------------------------------------------
  // Q3 — Payment cadence
  // -------------------------------------------------------------------------
  {
    key: "ih_cadence",
    prompt: "How often do you pay?",
    kind: "single_select",
    required: "hard",
    show_when: {
      if_key: "ih_arrangement",
      if_in: ["family_rent", "doubled_up_friends", "room_rental_no_lease", "motel_weekly", "homeless_with_cost", "utilities_only"],
    },
    options: [
      { value: "monthly",   label: "Monthly" },
      { value: "weekly",    label: "Weekly" },
      { value: "biweekly",  label: "Every two weeks" },
      { value: "nightly",   label: "Nightly" },
      { value: "irregular", label: "Irregular / when I can" },
    ] satisfies ReadonlyArray<{ value: PaymentCadence; label: string }>,
  },

  // -------------------------------------------------------------------------
  // Q4 — Who do you pay (for family_rent / doubled_up / room_rental)
  // -------------------------------------------------------------------------
  {
    key: "ih_payee_relationship",
    prompt: "What's your relationship to the person you pay?",
    kind: "single_select",
    required: "soft",
    show_when: {
      if_key: "ih_arrangement",
      if_in: ["family_rent", "doubled_up_friends", "room_rental_no_lease"],
    },
    options: [
      { value: "parent",    label: "Parent" },
      { value: "sibling",   label: "Sibling" },
      { value: "child",     label: "Adult child" },
      { value: "relative",  label: "Other family member" },
      { value: "friend",    label: "Friend" },
      { value: "roommate",  label: "Roommate I don't know well" },
      { value: "landlord",  label: "Landlord (the person who owns the place)" },
    ],
  },

  {
    key: "ih_payee_name",
    prompt: "What's their name?",
    helper: "We'll only use this to confirm the payment if you connect your bank account or money app.",
    kind: "person_name",
    required: "soft",
    show_when: {
      if_key: "ih_arrangement",
      if_in: ["family_rent", "doubled_up_friends", "room_rental_no_lease"],
    },
  },

  // -------------------------------------------------------------------------
  // Q5 — Evidence — Plaid / money app / receipts
  // -------------------------------------------------------------------------
  {
    key: "ih_evidence_kind",
    prompt: "Which of these can you show as proof?",
    helper: "Pick all that apply. The more we can confirm, the stronger your packet.",
    kind: "multi_select",
    required: "soft",
    options: [
      { value: "plaid_recurring",        label: "Bank transfer history" },
      { value: "money_app_history",      label: "Venmo, Zelle, or CashApp history" },
      { value: "third_party_attestation",label: "Signed letter from the person I pay" },
      { value: "lodging_receipt",        label: "Motel / weekly stay receipts" },
      { value: "utility_bills_only",     label: "Utility bills in my name" },
      { value: "shelter_provider_letter",label: "Letter from a shelter" },
      { value: "coc_hmis_verification",  label: "Letter from a homeless services provider" },
      { value: "self_attestation_only",  label: "Nothing — just my word" },
    ] satisfies ReadonlyArray<{ value: EvidenceKind; label: string }>,
  },

  // -------------------------------------------------------------------------
  // Q6 — Exclusive vs shared use (room_rental, doubled_up)
  // -------------------------------------------------------------------------
  {
    key: "ih_exclusive_use",
    prompt: "Do you have a room or area that's yours alone, or do you share a sleeping space?",
    kind: "single_select",
    required: "soft",
    show_when: {
      if_key: "ih_arrangement",
      if_in: ["doubled_up_friends", "room_rental_no_lease"],
    },
    options: [
      { value: "exclusive_room",   label: "I have my own room" },
      { value: "exclusive_corner", label: "I have a private corner / partitioned space" },
      { value: "shared_space",     label: "I share a sleeping space (couch, floor, shared bed)" },
    ],
  },

  // -------------------------------------------------------------------------
  // Q7 — Separate household status (key for doubled_up cases)
  // -------------------------------------------------------------------------
  {
    key: "ih_separate_household",
    prompt: "Do you buy and prepare food separately from the other people you live with?",
    helper: "SNAP rules treat people who share food as one household. If you eat separately, you can apply on your own.",
    kind: "boolean",
    required: "hard",
    show_when: {
      if_key: "ih_arrangement",
      if_in: ["family_rent", "doubled_up_friends", "room_rental_no_lease", "utilities_only"],
    },
  },

  // -------------------------------------------------------------------------
  // Q8 — Motel-specific: nightly rate (for cadence=nightly)
  // -------------------------------------------------------------------------
  {
    key: "ih_motel_nightly_rate",
    prompt: "About how much per night?",
    kind: "money",
    required: "soft",
    show_when: { if_key: "ih_arrangement", if_in: ["motel_weekly"] },
  },

  // -------------------------------------------------------------------------
  // Q9 — Homeless-with-cost: where
  // -------------------------------------------------------------------------
  {
    key: "ih_homeless_setting",
    prompt: "Where are you staying that costs money?",
    kind: "single_select",
    required: "soft",
    show_when: { if_key: "ih_arrangement", if_in: ["homeless_with_cost"] },
    options: [
      { value: "transitional_housing", label: "Transitional housing program" },
      { value: "shelter_paid",         label: "Shelter that charges a daily/weekly fee" },
      { value: "vehicle_parking_fee",  label: "Vehicle parking / safe-parking program fee" },
      { value: "other",                label: "Something else" },
    ],
  },

  // -------------------------------------------------------------------------
  // Q10 — DV shelter — minimal data, never location
  // -------------------------------------------------------------------------
  {
    key: "ih_dv_can_provide_letter",
    prompt: "Can you safely get a letter from the shelter, or would that be unsafe?",
    helper: "It's OK if you can't — we'll handle it. We never ask for shelter address or details.",
    kind: "single_select",
    required: "hard",
    show_when: { if_key: "ih_arrangement", if_in: ["dv_shelter"] },
    options: [
      { value: "yes_letter_safe",    label: "Yes, I can get a letter" },
      { value: "no_letter_unsafe",   label: "No, asking for a letter would put me at risk" },
      { value: "unsure",             label: "I'm not sure yet" },
    ],
  },

  // -------------------------------------------------------------------------
  // Q11 — Stability check (catches "I just moved in last week" cases)
  // -------------------------------------------------------------------------
  {
    key: "ih_months_at_current",
    prompt: "How many months have you been at this place?",
    kind: "single_select",
    required: "soft",
    show_when: {
      if_key: "ih_arrangement",
      if_in: ["family_rent", "doubled_up_friends", "room_rental_no_lease", "motel_weekly", "utilities_only"],
    },
    options: [
      { value: "less_than_1", label: "Less than a month" },
      { value: "1_to_3",      label: "1–3 months" },
      { value: "3_to_12",     label: "3–12 months" },
      { value: "over_12",     label: "Over a year" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helper: walk question bank with answers and return next question to show
// ---------------------------------------------------------------------------

export function nextUnansweredQuestion(
  answers: Record<string, string | undefined>,
): IntakeQuestion | null {
  for (const q of INFORMAL_HOUSING_QUESTIONS) {
    if (q.show_when) {
      const drivingAnswer = answers[q.show_when.if_key];
      if (!drivingAnswer || !q.show_when.if_in.includes(drivingAnswer)) {
        continue; // branch doesn't apply
      }
    }
    if (q.kind === "multi_select") {
      // multi_select stored as comma-separated string
      if (!answers[q.key] || answers[q.key] === "") return q;
    } else if (!answers[q.key]) {
      return q;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validator — does this answer set produce a fillable shelter deduction?
// ---------------------------------------------------------------------------

export interface IntakeValidationResult {
  is_complete: boolean;
  arrangement: InformalArrangementKind | null;
  /** Hard-required questions still unanswered. */
  missing_required: string[];
  /** Soft (recommended) questions still unanswered. */
  missing_recommended: string[];
}

export function validateIntake(
  answers: Record<string, string | undefined>,
): IntakeValidationResult {
  const arrangement = (answers["ih_arrangement"] ?? null) as InformalArrangementKind | null;
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];

  for (const q of INFORMAL_HOUSING_QUESTIONS) {
    if (q.show_when) {
      const drivingAnswer = answers[q.show_when.if_key];
      if (!drivingAnswer || !q.show_when.if_in.includes(drivingAnswer)) continue;
    }
    if (!answers[q.key]) {
      if (q.required === "hard") missingRequired.push(q.key);
      else missingRecommended.push(q.key);
    }
  }

  return {
    is_complete: missingRequired.length === 0,
    arrangement,
    missing_required: missingRequired,
    missing_recommended: missingRecommended,
  };
}
