import { STATE_ASSET_RULES } from "@civica/snap-calculator";
import type {
  AssetPackage,
  AssetsInput,
  Citation,
  Defensibility,
  DefensibilityFactor,
  Warning,
} from "../../schemas";

export interface AssetsEvaluationOptions {
  now?: () => string;
}

export interface AssetsEvaluationResult {
  evidence_package: AssetPackage;
  defensibility_score: Defensibility;
  defensibility_factors: DefensibilityFactor[];
  citations: Citation[];
  warnings: Warning[];
}

export function buildAssetPackage(
  input: AssetsInput,
  options: AssetsEvaluationOptions = {},
): AssetPackage {
  const now = options.now ?? (() => new Date().toISOString());

  const rules = STATE_ASSET_RULES[input.state_code];
  const total = input.assets.reduce((s, a) => s + a.countable_value, 0);
  const limit = input.elderly_or_disabled
    ? rules.elderly_disabled_limit_usd
    : rules.standard_limit_usd;

  let result: AssetPackage["asset_test_result"];
  if (!rules.asset_test_applies) {
    result = "not_applicable";
  } else {
    result = total <= limit ? "pass" : "fail";
  }

  return {
    flow: "assets",
    applicant_name: input.applicant_name,
    state_code: input.state_code,
    assets: input.assets,
    total_countable_assets: total,
    asset_limit_usd: limit,
    asset_test_applies: rules.asset_test_applies,
    asset_test_result: result,
    regulatory_citations: rules.citations,
    generated_at: now(),
  };
}

export function evaluateAssets(
  input: AssetsInput,
  options: AssetsEvaluationOptions = {},
): AssetsEvaluationResult {
  const pkg = buildAssetPackage(input, options);

  const factors: DefensibilityFactor[] = [];
  const warnings: Warning[] = [];

  const verifiedCount = pkg.assets.filter(
    (a) => a.verification_method === "plaid_balance" || a.verification_method === "document_upload",
  ).length;
  const totalCount = pkg.assets.length;

  if (totalCount === 0) {
    factors.push({
      name: "no_assets_declared",
      weight: "neutral",
      detail: "Applicant declared no assets",
    });
  } else if (verifiedCount === totalCount) {
    factors.push({
      name: "all_assets_verified",
      weight: "positive",
      detail: "Every declared asset has Plaid or document verification",
    });
  } else if (verifiedCount > 0) {
    factors.push({
      name: "partial_asset_verification",
      weight: "neutral",
      detail: `${verifiedCount}/${totalCount} assets verified; rest self-declared`,
    });
  } else {
    factors.push({
      name: "self_declared_assets",
      weight: "negative",
      detail: "All assets self-declared without third-party verification",
    });
  }

  if (pkg.asset_test_result === "fail") {
    factors.push({
      name: "asset_test_exceeded",
      weight: "negative",
      detail: `Countable $${pkg.total_countable_assets} exceeds limit $${pkg.asset_limit_usd}`,
    });
    warnings.push({
      code: "assets.over_limit",
      severity: "critical",
      message: "Countable assets exceed state limit",
    });
  }

  let score: Defensibility;
  if (pkg.asset_test_result === "not_applicable") {
    score = totalCount === 0 || verifiedCount === totalCount ? "strong" : "moderate";
  } else if (pkg.asset_test_result === "pass") {
    score = verifiedCount === totalCount && totalCount > 0 ? "strong" : "moderate";
  } else {
    score = "weak";
  }

  const citations: Citation[] = pkg.regulatory_citations.map((reference) => ({
    authority: reference.startsWith("7 CFR")
      ? "7 CFR Part 273"
      : pkg.state_code === "CA"
        ? "CA CDSS"
        : "MA DTA",
    reference,
  }));

  return {
    evidence_package: pkg,
    defensibility_score: score,
    defensibility_factors: factors,
    citations,
    warnings,
  };
}
