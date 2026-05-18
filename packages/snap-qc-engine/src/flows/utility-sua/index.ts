import {
  STATE_SUA_RULES,
  determineSuaTier,
} from "@civica/snap-calculator";
import type {
  Citation,
  DefensibilityFactor,
  Defensibility,
  UtilityPackage,
  UtilitySuaInput,
  Warning,
} from "../../schemas.js";

export { determineSuaTier };

export interface UtilityEvaluationOptions {
  now?: () => string;
}

export interface UtilityEvaluationResult {
  evidence_package: UtilityPackage;
  defensibility_score: Defensibility;
  defensibility_factors: DefensibilityFactor[];
  citations: Citation[];
  warnings: Warning[];
}

export function buildUtilityPackage(
  input: UtilitySuaInput,
  options: UtilityEvaluationOptions = {},
): UtilityPackage {
  const now = options.now ?? (() => new Date().toISOString());

  const tier = determineSuaTier(input.intake);
  const u = input.intake.utilities_paid_by_applicant;
  const declaresPayingAny =
    u.heat_gas || u.electricity || u.cooling || u.water || u.phone_internet;
  const rules = STATE_SUA_RULES[input.intake.state_code];

  let basis: UtilityPackage["basis"];
  if (input.accounts.length === 0) {
    basis = "self_declared";
  } else if (declaresPayingAny && !input.name_match) {
    basis = "conflicting";
  } else if (input.name_match && declaresPayingAny) {
    basis = "api_confirmed";
  } else {
    basis = "self_declared";
  }

  const tierAmount =
    tier === "full"
      ? rules.amounts_usd.full
      : tier === "limited"
        ? rules.amounts_usd.limited
        : tier === "telephone"
          ? rules.amounts_usd.telephone
          : 0;

  return {
    flow: "utility",
    applicant_name: input.applicant_name,
    service_address: input.service_address,
    state_code: input.intake.state_code,
    tier,
    tier_amount_usd: tierAmount,
    rule_citation: rules.citation,
    basis,
    utility_accounts_found: input.accounts,
    name_match: input.name_match,
    intake_responses: input.intake,
    generated_at: now(),
    attestation_required: basis !== "api_confirmed",
  };
}

export function evaluateUtilitySua(
  input: UtilitySuaInput,
  options: UtilityEvaluationOptions = {},
): UtilityEvaluationResult {
  const pkg = buildUtilityPackage(input, options);

  const factors: DefensibilityFactor[] = [];
  const warnings: Warning[] = [];

  if (pkg.basis === "api_confirmed") {
    factors.push({
      name: "utility_account_name_match",
      weight: "positive",
      detail: "UtilityAPI account holder matches applicant name",
    });
  } else if (pkg.basis === "conflicting") {
    factors.push({
      name: "utility_account_name_mismatch",
      weight: "negative",
      detail: "Account holder differs from applicant; attestation required",
    });
    warnings.push({
      code: "utility.account_holder_mismatch",
      severity: "warning",
      message:
        "Applicant declares paying utilities but account is held by someone else",
    });
  } else {
    factors.push({
      name: "utility_self_declared",
      weight: "neutral",
      detail: "No UtilityAPI account match; relying on attestation",
    });
  }

  if (pkg.tier === "none") {
    factors.push({
      name: "no_qualifying_utility",
      weight: "neutral",
      detail: "No SUA tier applies",
    });
  }

  let score: Defensibility;
  if (pkg.basis === "api_confirmed") score = "strong";
  else if (pkg.basis === "conflicting") score = "weak";
  else score = "moderate";

  const citations: Citation[] = [
    { authority: pkg.state_code === "CA" ? "CA CDSS" : "MA DTA", reference: pkg.rule_citation },
  ];

  return {
    evidence_package: pkg,
    defensibility_score: score,
    defensibility_factors: factors,
    citations,
    warnings,
  };
}
