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
export { scoreErrorRisk, ERROR_WEIGHT } from "./scoring/error-risk";
export type { ErrorRiskResult, ErrorRiskTier } from "./scoring/error-risk";

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
