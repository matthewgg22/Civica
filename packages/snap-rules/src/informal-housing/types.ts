/**
 * Informal housing — types and constants.
 *
 * Captures shelter arrangements that don't fit the lease-or-mortgage template:
 * paying a family member, doubled-up with friends/relatives, single-room
 * occupancy in a motel, paying only utilities as shelter, room rental in a
 * single-family home, etc. These households represent a large share of
 * low-income SNAP applicants in California and are exactly where Civica's
 * lease-OCR pipeline produces unreliable shelter deductions.
 *
 * The data model captured here is consumed by:
 *   - iOS intake wizard (to-be-built — `Civica/Features/SNAP/InformalHousing/`)
 *   - enrollment-api route storing the arrangement on the packet
 *   - snap-qc-engine to compute defensibility for the shelter flow
 *   - snap-calculator to compute the shelter deduction with the right inputs
 */

// ---------------------------------------------------------------------------
// Arrangement kinds — the dropdown the household picks from
// ---------------------------------------------------------------------------

export type InformalArrangementKind =
  /** Paying a family member who owns or leases the dwelling. */
  | "family_rent"
  /** Sharing a unit with non-family roommates, no written lease share. */
  | "doubled_up_friends"
  /** Renting a room in someone else's home (formal-ish, no lease document). */
  | "room_rental_no_lease"
  /** Living in a motel/hotel; paying nightly or weekly. */
  | "motel_weekly"
  /** No fixed nighttime residence — eligible for homeless deduction. */
  | "homeless_no_shelter_cost"
  /** Homeless but incurring some shelter cost (shelter stay, transitional). */
  | "homeless_with_cost"
  /** Paying utilities only — landlord pays rent (e.g. care arrangement). */
  | "utilities_only"
  /** Domestic violence shelter or victim-services housing. */
  | "dv_shelter";

// ---------------------------------------------------------------------------
// Payment cadence and evidence kinds
// ---------------------------------------------------------------------------

export type PaymentCadence = "monthly" | "weekly" | "biweekly" | "nightly" | "irregular";

export type EvidenceKind =
  /** Plaid recurring transaction to a named counterparty. */
  | "plaid_recurring"
  /** Money-app history (Venmo, Zelle, CashApp) showing recurring transfer. */
  | "money_app_history"
  /** Signed statement from the person being paid (e.g. relative). */
  | "third_party_attestation"
  /** Motel receipts, weekly stay invoices. */
  | "lodging_receipt"
  /** Utility bills in applicant's name as the only shelter cost. */
  | "utility_bills_only"
  /** Shelter provider letter (homeless shelter, DV shelter). */
  | "shelter_provider_letter"
  /** Letter from a HMIS-participating CoC verifying homeless status. */
  | "coc_hmis_verification"
  /** Pure self-attestation, no documentary evidence. */
  | "self_attestation_only";

// ---------------------------------------------------------------------------
// Defensibility tier per (arrangement, evidence) combo
// ---------------------------------------------------------------------------

export type InformalHousingDefensibility = "moderate" | "weak" | "discretionary";

/**
 * Evidence-defensibility lookup. Calibrated to align with the snap-qc-engine
 * tiers — Strong defensibility is unreachable for informal housing because
 * there's no third-party data source equivalent to Argyle or a recorded
 * deed. Moderate is the ceiling, achieved when the evidence is both
 * recurring and matched to a counterparty.
 *
 * Cases not in the lookup default to "weak."
 */
export const DEFENSIBILITY_LOOKUP: Record<
  InformalArrangementKind,
  Partial<Record<EvidenceKind, InformalHousingDefensibility>>
> = {
  family_rent: {
    plaid_recurring: "moderate",
    money_app_history: "moderate",
    third_party_attestation: "moderate",
    self_attestation_only: "weak",
  },
  doubled_up_friends: {
    plaid_recurring: "moderate",
    money_app_history: "moderate",
    third_party_attestation: "weak",
    self_attestation_only: "weak",
  },
  room_rental_no_lease: {
    plaid_recurring: "moderate",
    third_party_attestation: "moderate",
    self_attestation_only: "weak",
  },
  motel_weekly: {
    lodging_receipt: "moderate",
    plaid_recurring: "moderate",
    self_attestation_only: "weak",
  },
  homeless_no_shelter_cost: {
    coc_hmis_verification: "moderate",
    shelter_provider_letter: "moderate",
    self_attestation_only: "weak",
  },
  homeless_with_cost: {
    shelter_provider_letter: "moderate",
    lodging_receipt: "moderate",
    self_attestation_only: "weak",
  },
  utilities_only: {
    utility_bills_only: "moderate",
    self_attestation_only: "weak",
  },
  dv_shelter: {
    shelter_provider_letter: "moderate",
    /** DV cases sometimes can't produce a letter for safety reasons. */
    self_attestation_only: "discretionary",
  },
};

// ---------------------------------------------------------------------------
// Shelter-deduction effects per arrangement
// ---------------------------------------------------------------------------

export interface ShelterDeductionEffect {
  /** Does this arrangement qualify for the federal homeless shelter deduction? */
  homeless_deduction_eligible: boolean;
  /** Does the applicant typically incur any shelter cost? */
  has_shelter_cost: boolean;
  /** Can the household elect a Standard Utility Allowance? */
  sua_eligible: boolean;
  /** Plain-English caveat for the navigator. */
  note: string;
}

export const SHELTER_EFFECT: Record<InformalArrangementKind, ShelterDeductionEffect> = {
  family_rent: {
    homeless_deduction_eligible: false,
    has_shelter_cost: true,
    sua_eligible: true,
    note: "Verify amount via recurring payment evidence; family member should be willing to confirm if asked.",
  },
  doubled_up_friends: {
    homeless_deduction_eligible: false,
    has_shelter_cost: true,
    sua_eligible: true,
    note: "Shared housing — confirm SNAP household composition is separate from the host household, and that applicant pays a fixed share.",
  },
  room_rental_no_lease: {
    homeless_deduction_eligible: false,
    has_shelter_cost: true,
    sua_eligible: true,
    note: "Confirm room rental is exclusive use (not couch surfing) and rent amount is stable.",
  },
  motel_weekly: {
    homeless_deduction_eligible: false,
    has_shelter_cost: true,
    sua_eligible: false,
    note: "Convert nightly/weekly to monthly equivalent. SUA does not apply — utilities are included in lodging cost.",
  },
  homeless_no_shelter_cost: {
    homeless_deduction_eligible: true,
    has_shelter_cost: false,
    sua_eligible: false,
    note: "Standard $198.99/mo homeless shelter deduction applies. SUA does not apply (no utility costs).",
  },
  homeless_with_cost: {
    homeless_deduction_eligible: true,
    has_shelter_cost: true,
    sua_eligible: false,
    note: "May elect homeless deduction ($198.99) OR actual shelter cost (whichever is higher). Compare both.",
  },
  utilities_only: {
    homeless_deduction_eligible: false,
    has_shelter_cost: true,
    sua_eligible: true,
    note: "Only utility cost counts as shelter expense; rent portion is $0 (landlord pays).",
  },
  dv_shelter: {
    homeless_deduction_eligible: true,
    has_shelter_cost: false,
    sua_eligible: false,
    note: "Treated as homeless for shelter purposes. Privacy-sensitive — collect minimum necessary evidence.",
  },
};
