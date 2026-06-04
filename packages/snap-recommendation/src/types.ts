// All public types for Component R.
// Dollar values are never hardcoded here — they come from engine outputs only.

import type { VerdictResult } from "@civica/snap-rules";
import type { MissedElection } from "@civica/snap-qc-engine";

export type { VerdictResult, MissedElection };

// ─── Urgency (3 levels per spec §3.3) ────────────────────────────────────────

export type Urgency = "verdict_threatening" | "accuracy_risk" | "opportunity";

// ─── Perturbation classes (5 per spec §3.2) ───────────────────────────────────

export type PerturbationClass =
  | "missed_election"
  | "verification_upgrade"
  | "income_verification"
  | "categorical_flip"
  | "boundary_proximity";

// ─── Field taxonomy ───────────────────────────────────────────────────────────

export type VerificationMode = "verifiable" | "attestable" | "immutable";

// ─── Verification step (one of 4 per 273.2(f) hierarchy) ─────────────────────

export interface VerificationStep {
  method: "document" | "collateral_contact" | "attestation" | "agency_assist";
  label: string;
  detail: string;
  citation: string;
  rerouted: boolean;
  reroute_reason?: string;
}

// ─── Recommendation ───────────────────────────────────────────────────────────

export interface Recommendation {
  rank: 1 | 2 | 3 | 4;
  perturbation_class: PerturbationClass;
  field: string;
  field_tag: VerificationMode;
  delta_monthly_usd: number;
  urgency: Urgency;
  score: number;
  action: string;
  verification_steps: VerificationStep[];
  citable_to: string[];
  rerouted: boolean;
  reroute_reason?: string;
}

// ─── Stage 3 output ───────────────────────────────────────────────────────────

export interface RecommendationSet {
  recommendations: Recommendation[];
  interrupt_required: boolean;
  missed_elections: MissedElection[];
  counterfactuals_run: number;
}

// ─── Elicitation ─────────────────────────────────────────────────────────────

export type ElicitationStatus = "DETERMINE" | "ELICIT";

export interface PlausibilityFlag {
  id: string;
  probe: string;
  citation: string;
  severity: "blocking" | "advisory";
}

export interface ElicitationQuestion {
  field_path: string;
  question: string;
  type: "text" | "number" | "boolean" | "select" | "multi_select";
  options?: string[];
  knockout: number;
}

export interface ElicitationResult {
  status: ElicitationStatus;
  missing_fields: string[];
  plausibility_flags: PlausibilityFlag[];
  next_questions: ElicitationQuestion[];
}

// ─── Feasibility context ─────────────────────────────────────────────────────

export interface FeasibilityContext {
  is_homeless: boolean;
  is_dv_survivor: boolean;
  is_migrant: boolean;
  is_in_treatment: boolean;
}

// ─── Answered axes ────────────────────────────────────────────────────────────
// Answers to probes that don't fit in Facts.
// The DV answer (contact_safety_concern) MUST NOT appear in any portal payload.

export interface AnsweredAxes {
  // Utility / SUA probes
  heating_cooling?: "yes" | "no" | null;
  has_electric_or_gas?: "yes" | "no" | null;
  has_phone?: "yes" | "no" | null;
  receives_heap?: "yes" | "no" | null;
  documented_monthly_utility_usd?: number | null;

  // Informal housing
  ih_arrangement?: string;

  // DV safety routing — NEVER written to portal payload
  contact_safety_concern?: "yes" | "no" | "prefer_not_to_say";

  // Deduction amounts (from follow-up probes)
  monthly_dependent_care_paid_usd?: number | null;
  monthly_medical_out_of_pocket_usd?: number | null;

  // Categorical eligibility probe
  receives_ssi?: boolean;

  // QC defensibility results (if a QC flow ran before Component R)
  qc_results?: Array<{ flow: string; defensibility_score: "strong" | "moderate" | "weak" }>;
}

// ─── Component R top-level input / output ─────────────────────────────────────

export interface ComponentRInput {
  facts: import("@civica/snap-rules").Facts;
  answeredAxes: AnsweredAxes;
  state: "CA" | "MA";
  asOf: Date;
}

export interface ComponentRResult {
  stage1: ElicitationResult;
  stage2: VerdictResult | null;
  stage3: RecommendationSet | null;
}

// ─── Engine adapter interface (for spy injection in budget tests) ─────────────

import type {
  Facts,
  BenefitCalcDetail,
} from "@civica/snap-rules";
import type { HouseholdElectionProfile } from "@civica/snap-qc-engine";

export interface EngineAdapters {
  computeBenefit: (facts: Facts, state: string, asOf: Date) => BenefitCalcDetail;
  composeVerdict: (facts: Facts, state: string, asOf: Date) => VerdictResult;
  detectMissedElections: (profile: HouseholdElectionProfile) => MissedElection[];
}
