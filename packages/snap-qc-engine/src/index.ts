import { ENGINE_VERSION } from "./version";
import { evaluateUtilitySua } from "./flows/utility-sua/index";
import { evaluateSharedLease } from "./flows/shared-lease/index";
import { evaluateGigIncome } from "./flows/gig-income/index";
import { evaluateAssets } from "./flows/assets/index";
import { evaluateBenefitImpact } from "./flows/benefit-impact-projection/index";
import type { EvaluateRequest, FlowKind, QcResult } from "./schemas";

export * from "./schemas";
export { ENGINE_VERSION } from "./version";

export {
  analyzeRentTransactions,
  buildSharedLeasePackage,
} from "./flows/shared-lease/index";
export {
  buildUtilityPackage,
  determineSuaTier,
} from "./flows/utility-sua/index";
export { buildGigIncomePackage } from "./flows/gig-income/index";
export { buildAssetPackage } from "./flows/assets/index";
export {
  buildBenefitImpactPackage,
  evaluateBenefitImpact,
} from "./flows/benefit-impact-projection/index";
export { combineScores, rollupFactors } from "./scoring/defensibility";
export { scoreErrorRisk, ERROR_WEIGHT, perPacketGapContribution } from "./scoring/error-risk";
export type { ErrorRiskResult, ErrorRiskTier } from "./scoring/error-risk";

// Population PER projection (added 2026-05-25 for /qc Error Rate Intelligence redesign).
// Distinct from per-packet scoreErrorRisk — these functions operate on observed
// engagement rates across the served cohort and return projected / engagement-implied
// population PER in percentage points. Anchored to CA FY2024 baseline (10.98%)
// and the thesis's projected ~5.5% at full stack engagement.
export {
  CA_BASELINE_PER,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  PILLAR_SHARES_UNNORMALIZED,
  PILLAR_MAX_DEFENSIBILITY_SHIFT,
  THESIS_CALIBRATION_FACTOR,
  RESIDUAL_FLOOR_SHARE,
  computeProjectedPER,
  computeEngagementImpliedPER,
  pillarContribution,
} from "./scoring/error-risk";
export type { PillarCoverage } from "./scoring/error-risk";
export { INCOME_GROUP_PER_FY23, CA_INCOME_GROUP_PER_FY23, CA_ELEMENT_ATTRIBUTION_FY23 } from "./scoring/error-risk";

// CDSS / county-facing baseline mapping (added 2026-05-27 for TODO-4).
// Three artifacts that turn the population PER math into county-sales-ready
// talking points: USDA element → Civica pillar mapping, BBCE-removal
// counterargument, and the earned-income TAM profile.
export {
  CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS,
  CIVICA_ADDRESSABLE_SHARE_PCT,
  BBCE_REMOVAL_SCENARIO,
  CIVICA_TAM_PROFILE,
  pillarReductionAtFullEngagement,
  listMappedFnsElements,
  civicaAddressableCategories,
  residualCategories,
} from "./scoring/cdss-mapping";
export type {
  CdssErrorCategoryRow,
  CivicaPillar,
  CivicaControl,
} from "./scoring/cdss-mapping";

// Retention-risk scorer (Unrath 2024 retention pillar, 2026-05-27):
// predicts P(exit at next reporting moment | currently eligible) and surfaces
// the Type-1 error case where a still-eligible household is at risk of
// paperwork-driven exit. See packages/snap-qc-engine/src/scoring/retention-risk.ts
// for calibration anchors. Pure package; no API wiring yet.
export { scoreRetentionRisk } from "./scoring/retention-risk";
export type {
  RetentionRiskInput,
  RetentionRiskResult,
  RetentionRiskTier,
  PriorRecertOutcome,
  EarningsTrajectory,
} from "./scoring/retention-risk";

// Failure-to-elect detector (item 2): finds deductions/elections the
// household qualifies for but hasn't claimed — the underpayment iceberg.
export { detectMissedElections, totalMissedMonthlyValue } from "./scoring/failure-to-elect";
export type {
  MissedElection,
  MissedElectionKind,
  MissedElectionConfidence,
  HouseholdElectionProfile,
} from "./scoring/failure-to-elect";

// Sublease classifier (item 3): deterministic v1 routing — primary tenancy
// auto-flows, sublease/shared-tenancy routes to navigator review,
// informal arrangements route to the informal-housing intake wizard.
export { classifyTenancy } from "./flows/shared-lease/classifier";
export type {
  LeaseClassification,
  LeaseClassifierInput,
  TenancyKind,
  ClassifierAction,
} from "./flows/shared-lease/classifier";

// Lease OCR verification: cross-checks extracted field values against stated
// intake answers to produce a rent_match + name_match + defensibility_tier.
// Called by the OCR webhook after extraction_fields are stored; result is
// written back as synthetic civica_* extraction_fields rows.
export { verifyLeaseExtraction, parseRentValue, compareName, LEASE_FIELD_KEYS } from "./flows/shared-lease/lease-verification";
export type {
  LeaseVerificationInput,
  LeaseVerificationResult,
  ExtractionField,
  RentMatch,
  NameMatch,
  LeaseFieldKey,
} from "./flows/shared-lease/lease-verification";

export interface EvaluateOptions {
  /** Override timestamp source (for deterministic tests). */
  now?: () => string;
}

async function evaluate<F extends FlowKind>(
  request: EvaluateRequest<F>,
  options: EvaluateOptions = {},
): Promise<QcResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const computed_at = now();

  let result;
  switch (request.flow) {
    case "utility-sua":
      result = evaluateUtilitySua(request.inputs as never, { now });
      break;
    case "shared-lease":
      result = evaluateSharedLease(request.inputs as never, { now });
      break;
    case "gig-income":
      result = evaluateGigIncome(request.inputs as never, { now });
      break;
    case "assets":
      result = evaluateAssets(request.inputs as never, { now });
      break;
    case "benefit-impact-projection":
      result = evaluateBenefitImpact(request.inputs as never, { now });
      break;
    default: {
      const _exhaustive: never = request.flow;
      throw new Error(`Unknown flow kind: ${String(_exhaustive)}`);
    }
  }

  return {
    flow: request.flow,
    state: request.state,
    defensibility_score: result.defensibility_score,
    defensibility_factors: result.defensibility_factors,
    evidence_package: result.evidence_package,
    citations: result.citations,
    warnings: result.warnings,
    computed_at,
    engine_version: ENGINE_VERSION,
  };
}

export const qcEngine = {
  evaluate,
  version: ENGINE_VERSION,
};
