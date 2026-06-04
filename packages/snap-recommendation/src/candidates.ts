// Stage 3 candidate generation — 5 perturbation classes.
// Zero SNAP math reimplemented: all dollar values from engine outputs.
// Symmetry: action is always "verify"; never directs a specific correction direction.

import { computeBenefit, composeVerdict, determineSUATier } from "@civica/snap-rules";
import {
  detectMissedElections,
  ERROR_WEIGHT,
  PILLAR_MAX_DEFENSIBILITY_SHIFT,
} from "@civica/snap-qc-engine";
import type { Facts, VerdictResult, BenefitCalcDetail } from "@civica/snap-rules";
import type { MissedElection, HouseholdElectionProfile } from "@civica/snap-qc-engine";
import type { AnsweredAxes, PerturbationClass, EngineAdapters } from "./types";
import { INCOME_TYPE_TO_QC_ELEMENT, incomeEpsilon } from "./field-taxonomy";

// ─── Raw candidate (before ranking + verification chains) ─────────────────────

export interface RawCandidate {
  perturbation_class: PerturbationClass;
  field: string;
  action: string;
  delta_monthly_usd: number;
  dollars_at_risk?: number;
  verdict_before?: string;
  verdict_after?: string;
  source_election?: MissedElection;
  urgency_override?: string;
  citable_to: string[];
}

// ─── Default engine adapters ──────────────────────────────────────────────────

export function defaultAdapters(): EngineAdapters {
  return {
    computeBenefit: (f, s, d) => computeBenefit(f as never, s, d),
    composeVerdict:  (f, s, d) => composeVerdict(f as never, s, d),
    detectMissedElections: (p: HouseholdElectionProfile) =>
      detectMissedElections(p),
  };
}

// ─── Build HouseholdElectionProfile from Facts + AnsweredAxes ────────────────

export function buildHouseholdElectionProfile(
  facts: Facts,
  answeredAxes: AnsweredAxes,
  state: "CA" | "MA",
): HouseholdElectionProfile {
  const housingMap: Record<string, HouseholdElectionProfile["housing_situation"]> = {
    homeless_no_shelter_cost: "homeless",
    homeless_with_cost:       "homeless",
    dv_shelter:               "shelter",
    motel_weekly:             "motel",
    doubled_up_friends:       "couch_surfing",
    room_rental_no_lease:     "subletting",
    family_rent:              "renting",
    utilities_only:           "other",
  };

  const housing_situation: HouseholdElectionProfile["housing_situation"] =
    facts.shelter.homeless_deduction === true
      ? "homeless"
      : answeredAxes.ih_arrangement != null
        ? (housingMap[answeredAxes.ih_arrangement] ?? "renting")
        : "renting";

  const suaTierMap: Record<string, "FULL" | "LIMITED" | "TELEPHONE" | "NONE"> = {
    HCSUA: "FULL",
    LUA:   "LIMITED",
    phone: "TELEPHONE",
    none:  "NONE",
  };

  return {
    state_code: state,
    housing_situation,
    claimed_homeless_deduction: facts.shelter.homeless_deduction ?? false,
    claimed_sua_tier: suaTierMap[facts.shelter.sua_tier] ?? null,
    claimed_actual_utility_cost_usd: null,
    claimed_dependent_care_usd:      facts.deductions.dependent_care ?? null,
    claimed_medical_deduction_usd:   facts.deductions.medical_unreimbursed ?? null,
    has_heating_costs:
      answeredAxes.heating_cooling === "yes"
        ? true
        : answeredAxes.heating_cooling === "no"
          ? false
          : null,
    has_electric_or_gas:
      answeredAxes.has_electric_or_gas === "yes"
        ? true
        : answeredAxes.has_electric_or_gas === "no"
          ? false
          : null,
    has_phone:
      answeredAxes.has_phone === "yes"
        ? true
        : answeredAxes.has_phone === "no"
          ? false
          : null,
    documented_monthly_utility_usd:  answeredAxes.documented_monthly_utility_usd ?? null,
    household_members: facts.household.map((m) => ({
      age:          m.age,
      is_disabled:  m.disability ?? false,
      is_working:   m.work_class != null && m.work_class !== "not_working",
      receives_ssi: false,
    })),
    monthly_dependent_care_paid_usd:      answeredAxes.monthly_dependent_care_paid_usd ?? null,
    monthly_medical_out_of_pocket_usd:    answeredAxes.monthly_medical_out_of_pocket_usd ?? null,
  };
}

// ─── Apply a missed election to Facts ────────────────────────────────────────

function applyElection(
  facts: Facts,
  election: MissedElection,
  answeredAxes: AnsweredAxes,
): Facts | null {
  const c: Facts = JSON.parse(JSON.stringify(facts)) as Facts;

  switch (election.kind) {
    case "homeless_deduction":
      c.shelter.homeless_deduction = true;
      c.shelter.rent = 0;
      return c;

    case "sua_tier_upward": {
      // determineSUATier returns "FULL"|"LIMITED"|"TELEPHONE"|"NONE";
      // Shelter.sua_tier uses "HCSUA"|"LUA"|"phone"|"none".
      const rawTier = determineSUATier({
        has_heating_costs:   answeredAxes.heating_cooling,
        has_electric_or_gas: answeredAxes.has_electric_or_gas,
        has_phone:           answeredAxes.has_phone,
      });
      if (!rawTier) return null;
      const tierMap: Record<string, "HCSUA" | "LUA" | "phone" | "none"> = {
        FULL: "HCSUA", LIMITED: "LUA", TELEPHONE: "phone", NONE: "none",
      };
      const mappedTier = tierMap[rawTier];
      if (!mappedTier) return null;
      c.shelter.sua_tier = mappedTier;
      return c;
    }

    case "actual_utility_election": {
      const actual = answeredAxes.documented_monthly_utility_usd;
      if (!actual || actual <= 0) return null;
      c.shelter.sua_amount = actual;
      return c;
    }

    case "dependent_care_deduction": {
      const dep = answeredAxes.monthly_dependent_care_paid_usd;
      if (!dep || dep <= 0) return null;
      c.deductions = { ...c.deductions, dependent_care: dep };
      return c;
    }

    case "medical_deduction_elderly_disabled": {
      const med = answeredAxes.monthly_medical_out_of_pocket_usd;
      if (!med || med <= 0) return null;
      c.deductions = { ...c.deductions, medical_unreimbursed: med };
      return c;
    }
  }
}

function electionActionText(kind: MissedElection["kind"]): string {
  switch (kind) {
    case "homeless_deduction":
      return "Confirm and claim the homeless shelter deduction — no lease required.";
    case "sua_tier_upward":
      return "Upgrade the utility allowance tier — household qualifies for a higher SUA.";
    case "actual_utility_election":
      return "Claim actual documented utility costs instead of the standard allowance.";
    case "dependent_care_deduction":
      return "Claim the dependent care deduction for childcare expenses paid.";
    case "medical_deduction_elderly_disabled":
      return "Claim the medical expense deduction — eligible member has unreimbursed costs above the threshold.";
  }
}

function electionField(kind: MissedElection["kind"]): string {
  switch (kind) {
    case "homeless_deduction":                return "shelter.homeless_deduction";
    case "sua_tier_upward":                   return "shelter.sua_tier";
    case "actual_utility_election":           return "shelter.sua_amount";
    case "dependent_care_deduction":          return "deductions.dependent_care";
    case "medical_deduction_elderly_disabled": return "deductions.medical_unreimbursed";
  }
}

// ─── Baseline benefit helper ──────────────────────────────────────────────────

function baselineBenefit(
  facts: Facts,
  verdictResult: VerdictResult,
  state: string,
  asOf: Date,
  adapters: EngineAdapters,
  callCount: { n: number },
): number {
  if (verdictResult.trace != null && "benefit_calc" in verdictResult.trace) {
    const bc = (verdictResult.trace as Record<string, unknown>)["benefit_calc"] as
      | BenefitCalcDetail
      | undefined;
    if (bc?.monthly_benefit != null) return bc.monthly_benefit;
  }
  const result = adapters.computeBenefit(facts, state, asOf);
  callCount.n++;
  return result.monthly_benefit;
}

// ─── CLASS 1: Missed elections ────────────────────────────────────────────────

export function generateMissedElectionCandidates(
  facts: Facts,
  verdictResult: VerdictResult,
  answeredAxes: AnsweredAxes,
  state: "CA" | "MA",
  asOf: Date,
  adapters: EngineAdapters,
  callCount: { n: number },
): RawCandidate[] {
  const profile = buildHouseholdElectionProfile(facts, answeredAxes, state);
  const elections = adapters.detectMissedElections(profile);
  callCount.n++;

  const baseline = baselineBenefit(facts, verdictResult, state, asOf, adapters, callCount);
  const candidates: RawCandidate[] = [];

  for (const election of elections) {
    const perturbed = applyElection(facts, election, answeredAxes);
    if (!perturbed) continue;

    const result = adapters.computeBenefit(perturbed, state, asOf);
    callCount.n++;

    const delta = result.monthly_benefit - baseline;
    if (delta > 0) {
      candidates.push({
        perturbation_class: "missed_election",
        field:              electionField(election.kind),
        action:             electionActionText(election.kind),
        delta_monthly_usd:  delta,
        source_election:    election,
        citable_to:         [election.citation],
      });
    }
  }

  return candidates;
}

// ─── CLASS 2: Income verification ────────────────────────────────────────────

export function generateIncomeVerificationCandidates(
  facts: Facts,
  answeredAxes: AnsweredAxes,
  state: string,
  asOf: Date,
  adapters: EngineAdapters,
  callCount: { n: number },
): RawCandidate[] {
  const candidates: RawCandidate[] = [];

  for (const line of facts.income) {
    const hasUncertainty =
      line.anticipation === "estimated" || line.source_status === "ended";
    if (!hasUncertainty) continue;

    const qcElement = INCOME_TYPE_TO_QC_ELEMENT[line.type] ?? "346_unearned";
    const epsilon = incomeEpsilon(qcElement);

    const baselineFacts = facts;
    const baseResult = adapters.computeBenefit(baselineFacts, state, asOf);
    callCount.n++;
    const baseline = baseResult.monthly_benefit;

    const upFacts: Facts = JSON.parse(JSON.stringify(facts)) as Facts;
    upFacts.income = upFacts.income.map((l) =>
      l.type === line.type && l.amount === line.amount && l.member === line.member
        ? { ...l, amount: l.amount * (1 + epsilon) }
        : l,
    );
    const upResult = adapters.computeBenefit(upFacts, state, asOf);
    callCount.n++;

    const downFacts: Facts = JSON.parse(JSON.stringify(facts)) as Facts;
    downFacts.income = downFacts.income.map((l) =>
      l.type === line.type && l.amount === line.amount && l.member === line.member
        ? { ...l, amount: Math.max(0, l.amount * (1 - epsilon)) }
        : l,
    );
    const downResult = adapters.computeBenefit(downFacts, state, asOf);
    callCount.n++;

    const effectiveDelta = Math.max(
      Math.abs(upResult.monthly_benefit - baseline),
      Math.abs(downResult.monthly_benefit - baseline),
    );

    if (effectiveDelta > 0) {
      candidates.push({
        perturbation_class: "income_verification",
        field:              `income[].amount (type=${line.type})`,
        action:             "Verify income — outcome may change in either direction.",
        delta_monthly_usd:  effectiveDelta,
        citable_to:         ["7 CFR 273.9(b)(1)", "7 CFR 273.2(f)"],
      });
    }
  }

  return candidates;
}

// ─── CLASS 3: Categorical flip ────────────────────────────────────────────────

export function generateCategoricalFlipCandidates(
  facts: Facts,
  verdictResult: VerdictResult,
  answeredAxes: AnsweredAxes,
  state: string,
  asOf: Date,
  adapters: EngineAdapters,
  callCount: { n: number },
): RawCandidate[] {
  const grossTrace = (
    verdictResult.trace as Record<string, unknown> | undefined
  )?.["gross_income_test"] as { passes: boolean } | undefined;

  if (
    verdictResult.verdict !== "DENY" ||
    !grossTrace ||
    grossTrace.passes !== false ||
    !answeredAxes.receives_ssi
  ) {
    return [];
  }

  const perturbed: Facts = JSON.parse(JSON.stringify(facts)) as Facts;
  perturbed.cat_elig = "TANF";

  const result = adapters.composeVerdict(perturbed, state, asOf);
  callCount.n++;

  const benefitAfter = result.benefit;
  if (benefitAfter == null || benefitAfter <= 0) return [];

  const candidate: RawCandidate = {
    perturbation_class: "categorical_flip",
    field:              "cat_elig",
    action:
      "Verify categorical eligibility — household may qualify through SSI/public-assistance path, bypassing the income test.",
    delta_monthly_usd: benefitAfter,
    verdict_before:    verdictResult.verdict ?? "DENY",
    verdict_after:     result.verdict ?? "APPROVE",
    citable_to:        ["7 CFR 273.4", "7 CFR 273.8"],
  };
  return [candidate];
}

// ─── CLASS 4: Verification upgrades ──────────────────────────────────────────

const HIGH_WEIGHT_FLOWS = new Set(["utility-sua", "gig-income"]);

export function generateVerificationUpgradeCandidates(
  verdictResult: VerdictResult,
  answeredAxes: AnsweredAxes,
): RawCandidate[] {
  if (!answeredAxes.qc_results) return [];

  const traceRecord = verdictResult.trace as Record<string, unknown> | undefined;
  const currentBenefit =
    traceRecord?.["benefit_calc"] != null
      ? (traceRecord["benefit_calc"] as BenefitCalcDetail).monthly_benefit
      : (verdictResult.benefit ?? 0);

  const candidates: RawCandidate[] = [];

  for (const qcr of answeredAxes.qc_results) {
    if (!HIGH_WEIGHT_FLOWS.has(qcr.flow)) continue;
    if (qcr.defensibility_score !== "weak") continue;

    // Map FlowKind hyphen to CivicaPillar underscore
    const pillarKey = qcr.flow.replace(/-/g, "_") as keyof typeof PILLAR_MAX_DEFENSIBILITY_SHIFT;
    const flowKey = qcr.flow as keyof typeof ERROR_WEIGHT;
    const shift = PILLAR_MAX_DEFENSIBILITY_SHIFT[pillarKey] ?? 0;
    const weight = ERROR_WEIGHT[flowKey] ?? 0;
    const dollarsAtRisk = shift * weight * (currentBenefit ?? 0);

    if (dollarsAtRisk <= 0) continue;

    const fieldForFlow: Record<string, string> = {
      "utility-sua": "shelter.sua_tier",
      "gig-income":  "income[].amount (type=platform_gig)",
    };

    candidates.push({
      perturbation_class: "verification_upgrade",
      field:              fieldForFlow[qcr.flow] ?? qcr.flow,
      action:
        "Strengthen verification for this field — current evidence is weak and creates QC exposure.",
      delta_monthly_usd: 0,
      dollars_at_risk:   dollarsAtRisk,
      citable_to:        ["7 CFR 273.2(f)", "7 CFR 275.12"],
    });
  }

  return candidates;
}

// ─── CLASS 5: Boundary proximity ─────────────────────────────────────────────

export function generateBoundaryProximityCandidates(
  verdictResult: VerdictResult,
): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const trace = verdictResult.trace as Record<string, unknown> | undefined;
  if (!trace) return candidates;

  const tests: Array<{ key: string; label: string }> = [
    { key: "gross_income_test", label: "income[].amount (gross)" },
    { key: "net_income_test",   label: "income[].amount (net)" },
  ];

  for (const { key, label } of tests) {
    const test = trace[key] as
      | { passes: boolean; threshold: number; actual: number }
      | undefined;
    if (!test?.threshold || test.actual == null) continue;

    const distance = (test.threshold - test.actual) / test.threshold;
    if (Math.abs(distance) >= 0.05) continue;

    candidates.push({
      perturbation_class: "boundary_proximity",
      field:              label,
      action:
        "Verify income — application is within 5% of the income limit. Outcome may change in either direction.",
      delta_monthly_usd:  Math.abs(test.actual - test.threshold),
      urgency_override:
        verdictResult.verdict === "DENY" ? "verdict_threatening" : "accuracy_risk",
      citable_to: ["7 CFR 273.9(a)"],
    });
  }

  return candidates;
}
