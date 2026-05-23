/**
 * Failure-to-elect detector.
 *
 * Scans a household profile against the SNAP benefit schedule and surfaces
 * deductions, allowances, or tier elections the household is eligible for
 * but has not claimed. This is the "underpayment iceberg" Civica addresses —
 * QC's official underpayment rate (1.67% CA FY24) systematically misses
 * failure-to-elect cases because the worker calculated correctly against
 * what was reported.
 *
 * Pure logic. No I/O. The caller (enrollment-api route, iOS app, dashboard
 * panel) normalizes household data into HouseholdElectionProfile and consumes
 * MissedElection[] to drive UI nudges, navigator review queues, or packet
 * scoring boosts.
 *
 * Sources:
 *   FY25 homeless shelter deduction:        $198.99/mo (7 CFR 273.9(d)(6)(i))
 *   CA HCSUA FFY26:                          $663 FULL / $170 LIMITED / $44 TEL
 *   Dependent care deduction:                actual costs, no cap (post-2008)
 *   Medical deduction (elderly/disabled):    out-of-pocket > $35/mo
 *
 * Pairs with: docs/plans/civica-error-reduction-thesis.md §6 (underpayment).
 */

// ---------------------------------------------------------------------------
// Constants — published statutory values; update annually.
// ---------------------------------------------------------------------------

const HOMELESS_DEDUCTION_USD_FY25 = 198.99;
const CA_HCSUA_FFY26_FULL = 663;
const CA_HCSUA_FFY26_LIMITED = 170;
const CA_HCSUA_FFY26_TELEPHONE = 44;
const MEDICAL_DEDUCTION_THRESHOLD_USD = 35; // monthly out-of-pocket above this is deductible
const ELDERLY_AGE_THRESHOLD = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MissedElectionKind =
  | "homeless_deduction"
  | "sua_tier_upward"
  | "actual_utility_election"
  | "dependent_care_deduction"
  | "medical_deduction_elderly_disabled";

export type MissedElectionConfidence = "high" | "medium" | "low";

export interface MissedElection {
  kind: MissedElectionKind;
  /** Plain-English label suitable for household-facing UI. */
  label: string;
  /** Plain-English reason this household qualifies but isn't claiming. */
  reason: string;
  /** Best estimate of monthly benefit increase if elected, USD. */
  estimated_monthly_value_usd: number;
  /** How sure we are the household is eligible to elect this. */
  confidence: MissedElectionConfidence;
  /** Federal/state citation for the deduction. */
  citation: string;
  /** What the household or navigator needs to do to claim it. */
  action_required: string;
}

/**
 * Input snapshot. Caller is responsible for normalizing across iOS / web /
 * navigator-entered data into this shape. Optional fields are tolerated —
 * missing data simply produces lower-confidence detections.
 */
export interface HouseholdElectionProfile {
  state_code: "CA" | "MA";
  housing_situation:
    | "renting"
    | "owning"
    | "homeless"
    | "shelter"
    | "motel"
    | "couch_surfing"
    | "transitional_housing"
    | "subletting"
    | "other"
    | null;

  // What the household HAS claimed today (or null if not yet computed).
  claimed_homeless_deduction: boolean;
  claimed_sua_tier: "FULL" | "LIMITED" | "TELEPHONE" | "NONE" | null;
  claimed_actual_utility_cost_usd: number | null;
  claimed_dependent_care_usd: number | null;
  claimed_medical_deduction_usd: number | null;

  // Eligibility-relevant facts the household reported.
  has_heating_costs: boolean | null;
  has_electric_or_gas: boolean | null;
  has_phone: boolean | null;
  /** Sum of documented monthly utility bills, USD, if any captured. */
  documented_monthly_utility_usd: number | null;

  // Household composition (used by dep-care, medical, age-band gates).
  household_members: Array<{
    age: number;
    is_disabled: boolean;
    is_working: boolean;
    receives_ssi: boolean;
  }>;

  // Documented expenses (used by medical + dep-care detection).
  monthly_dependent_care_paid_usd: number | null;
  monthly_medical_out_of_pocket_usd: number | null;
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

/**
 * Returns the list of deductions / tier elections the household appears
 * eligible for but has not claimed. Empty array means no missed elections
 * were detected — not "fully optimized," just nothing this detector caught.
 *
 * Stable order: highest-confidence + highest-value first. Caller can
 * truncate or filter as needed.
 */
export function detectMissedElections(
  profile: HouseholdElectionProfile,
): MissedElection[] {
  const out: MissedElection[] = [];

  // -------------------------------------------------------------------------
  // 1. Homeless shelter deduction
  // -------------------------------------------------------------------------
  if (isHomelessIndicator(profile.housing_situation) && !profile.claimed_homeless_deduction) {
    out.push({
      kind: "homeless_deduction",
      label: "Homeless shelter deduction",
      reason: `Household reports housing situation "${profile.housing_situation}" but isn't claiming the homeless shelter deduction.`,
      estimated_monthly_value_usd: HOMELESS_DEDUCTION_USD_FY25,
      confidence: profile.housing_situation === "homeless" ? "high" : "medium",
      citation: "7 CFR 273.9(d)(6)(i) · FNS FY25 COLA",
      action_required: "Confirm housing situation with applicant; navigator elects deduction at intake.",
    });
  }

  // -------------------------------------------------------------------------
  // 2. SUA tier upward — household has heating but isn't on FULL tier
  // -------------------------------------------------------------------------
  if (profile.state_code === "CA") {
    const eligibleTier = deriveCaSuaTier({
      has_heating_costs: profile.has_heating_costs,
      has_electric_or_gas: profile.has_electric_or_gas,
      has_phone: profile.has_phone,
    });
    const claimedTier = profile.claimed_sua_tier;

    if (eligibleTier && claimedTier && eligibleTier !== claimedTier) {
      const eligibleValue = caHcsuaValue(eligibleTier);
      const claimedValue = caHcsuaValue(claimedTier);
      const delta = eligibleValue - claimedValue;
      if (delta > 0) {
        out.push({
          kind: "sua_tier_upward",
          label: "Higher Standard Utility Allowance tier",
          reason: `Household answers indicate eligibility for the ${eligibleTier} tier ($${eligibleValue}/mo) but the packet has ${claimedTier} ($${claimedValue}/mo).`,
          estimated_monthly_value_usd: delta,
          confidence: "high",
          citation: "7 CFR 273.9(d)(6)(iii) · CDSS ACIN I-07-26",
          action_required: "Re-run determineSUATier() on confirmed utility flags; update packet.",
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Actual utility cost election — when documented utilities exceed SUA
  // -------------------------------------------------------------------------
  // Households can elect actual utility costs if higher than the SUA. Rare,
  // but real for households in high-electric apartments without heating.
  if (
    profile.state_code === "CA" &&
    profile.documented_monthly_utility_usd != null &&
    profile.documented_monthly_utility_usd > CA_HCSUA_FFY26_FULL &&
    profile.claimed_actual_utility_cost_usd == null
  ) {
    const delta = profile.documented_monthly_utility_usd - CA_HCSUA_FFY26_FULL;
    out.push({
      kind: "actual_utility_election",
      label: "Elect actual utility costs over SUA",
      reason: `Documented utility bills total $${profile.documented_monthly_utility_usd.toFixed(0)}/mo, exceeding the FULL HCSUA ($${CA_HCSUA_FFY26_FULL}/mo). Household may elect actual costs.`,
      estimated_monthly_value_usd: delta,
      confidence: "medium",
      citation: "7 CFR 273.9(d)(6)(iii)(C) · MPP 63-502.363",
      action_required: "Confirm utility bills are recurring (not one-time); navigator overrides SUA with actuals.",
    });
  }

  // -------------------------------------------------------------------------
  // 4. Dependent care deduction
  // -------------------------------------------------------------------------
  const hasChildUnder13 = profile.household_members.some((m) => m.age < 13);
  const hasWorkingAdult = profile.household_members.some((m) => m.is_working && m.age >= 18);
  if (
    hasChildUnder13 &&
    hasWorkingAdult &&
    (profile.monthly_dependent_care_paid_usd ?? 0) > 0 &&
    (profile.claimed_dependent_care_usd ?? 0) === 0
  ) {
    out.push({
      kind: "dependent_care_deduction",
      label: "Dependent care deduction",
      reason: `Household has a child under 13, a working adult, and reports paying $${profile.monthly_dependent_care_paid_usd}/mo for dependent care — but the deduction is not claimed.`,
      estimated_monthly_value_usd: profile.monthly_dependent_care_paid_usd ?? 0,
      confidence: "high",
      citation: "7 CFR 273.9(d)(4)",
      action_required: "Capture provider invoice or receipt; navigator elects deduction.",
    });
  }

  // -------------------------------------------------------------------------
  // 5. Medical deduction for elderly / disabled
  // -------------------------------------------------------------------------
  const hasElderlyOrDisabled = profile.household_members.some(
    (m) => m.age >= ELDERLY_AGE_THRESHOLD || m.is_disabled,
  );
  const monthlyMed = profile.monthly_medical_out_of_pocket_usd ?? 0;
  if (
    hasElderlyOrDisabled &&
    monthlyMed > MEDICAL_DEDUCTION_THRESHOLD_USD &&
    (profile.claimed_medical_deduction_usd ?? 0) === 0
  ) {
    // Only the portion above $35/mo is deductible.
    const deductibleAmount = monthlyMed - MEDICAL_DEDUCTION_THRESHOLD_USD;
    out.push({
      kind: "medical_deduction_elderly_disabled",
      label: "Medical expense deduction (elderly / disabled)",
      reason: `Household includes an elderly or disabled member with $${monthlyMed.toFixed(0)}/mo in out-of-pocket medical expenses — the portion above $${MEDICAL_DEDUCTION_THRESHOLD_USD} is deductible but not claimed.`,
      estimated_monthly_value_usd: deductibleAmount,
      confidence: "high",
      citation: "7 CFR 273.9(d)(3)",
      action_required: "Capture pharmacy receipts, copays, or prescription costs; navigator elects deduction.",
    });
  }

  // Sort: highest confidence first, then highest dollar value
  return out.sort((a, b) => {
    const conf = confidenceRank(b.confidence) - confidenceRank(a.confidence);
    if (conf !== 0) return conf;
    return b.estimated_monthly_value_usd - a.estimated_monthly_value_usd;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isHomelessIndicator(
  situation: HouseholdElectionProfile["housing_situation"],
): boolean {
  return (
    situation === "homeless" ||
    situation === "shelter" ||
    situation === "motel" ||
    situation === "couch_surfing" ||
    situation === "transitional_housing"
  );
}

function deriveCaSuaTier(answers: {
  has_heating_costs: boolean | null;
  has_electric_or_gas: boolean | null;
  has_phone: boolean | null;
}): "FULL" | "LIMITED" | "TELEPHONE" | "NONE" | null {
  if (
    answers.has_heating_costs == null ||
    answers.has_electric_or_gas == null ||
    answers.has_phone == null
  ) {
    return null;
  }
  if (answers.has_heating_costs) return "FULL";
  if (answers.has_electric_or_gas) return "LIMITED";
  if (answers.has_phone) return "TELEPHONE";
  return "NONE";
}

function caHcsuaValue(tier: "FULL" | "LIMITED" | "TELEPHONE" | "NONE"): number {
  switch (tier) {
    case "FULL":
      return CA_HCSUA_FFY26_FULL;
    case "LIMITED":
      return CA_HCSUA_FFY26_LIMITED;
    case "TELEPHONE":
      return CA_HCSUA_FFY26_TELEPHONE;
    case "NONE":
      return 0;
  }
}

function confidenceRank(c: MissedElectionConfidence): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Summary helpers — for dashboard panels / iOS UI
// ---------------------------------------------------------------------------

/**
 * Total monthly dollar value the household appears to be leaving on the
 * table. Useful as a single hero number in the household-facing UI:
 * "We found $X/month in benefits you're not claiming."
 */
export function totalMissedMonthlyValue(elections: MissedElection[]): number {
  return elections.reduce((sum, e) => sum + e.estimated_monthly_value_usd, 0);
}
