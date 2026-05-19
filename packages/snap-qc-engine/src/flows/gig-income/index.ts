import {
  INCOME_CITATIONS,
  grossIncomeLimitMonthly,
} from "@civica/snap-calculator";
import type {
  Citation,
  Defensibility,
  DefensibilityFactor,
  GigIncomeInput,
  GigIncomePackage,
  Warning,
} from "../../schemas";

export interface GigEvaluationOptions {
  now?: () => string;
}

export interface GigEvaluationResult {
  evidence_package: GigIncomePackage;
  defensibility_score: Defensibility;
  defensibility_factors: DefensibilityFactor[];
  citations: Citation[];
  warnings: Warning[];
}

export function buildGigIncomePackage(
  input: GigIncomeInput,
  options: GigEvaluationOptions = {},
): GigIncomePackage {
  const now = options.now ?? (() => new Date().toISOString());

  const verified = input.sources
    .filter((s) => s.verification_method === "argyle_api")
    .reduce((sum, s) => sum + s.monthly_average, 0);

  const bankCorroborated = input.sources
    .filter((s) => s.verification_method === "plaid_deposits")
    .reduce((sum, s) => sum + s.monthly_average, 0);

  const selfCash = input.sources
    .filter((s) => s.type === "cash")
    .reduce((sum, s) => sum + s.monthly_average, 0);

  const declared = verified + bankCorroborated + selfCash;
  const gap = Math.round((bankCorroborated - verified) * 100) / 100;
  const reconciliation_flag =
    verified > 0 && Math.abs(gap) / Math.max(verified, 1) > 0.25;

  return {
    flow: "gig-income",
    applicant_name: input.applicant_name,
    state_code: input.state_code,
    income_sources: input.sources,
    total_monthly_verified: verified,
    total_monthly_bank_corroborated: bankCorroborated,
    total_monthly_self_declared_cash: selfCash,
    total_monthly_declared: declared,
    reconciliation_gap: gap,
    reconciliation_flag,
    cash_attestation_signed: input.cash_attestation_signed,
    cash_log: input.cash_log,
    snap_gross_income_limit_1person: grossIncomeLimitMonthly(1),
    snap_bbce_applies: input.state_code === "CA",
    regulatory_citations: INCOME_CITATIONS[input.state_code],
    generated_at: now(),
  };
}

export function evaluateGigIncome(
  input: GigIncomeInput,
  options: GigEvaluationOptions = {},
): GigEvaluationResult {
  const pkg = buildGigIncomePackage(input, options);

  const factors: DefensibilityFactor[] = [];
  const warnings: Warning[] = [];

  if (pkg.total_monthly_verified > 0) {
    factors.push({
      name: "argyle_payroll_verified",
      weight: "positive",
      detail: `$${pkg.total_monthly_verified.toFixed(2)} verified via payroll API`,
    });
  }
  if (pkg.total_monthly_bank_corroborated > 0) {
    factors.push({
      name: "plaid_deposits_corroborated",
      weight: "positive",
      detail: `$${pkg.total_monthly_bank_corroborated.toFixed(2)} corroborated by bank deposits`,
    });
  }
  if (pkg.total_monthly_self_declared_cash > 0) {
    factors.push({
      name: "cash_self_declared",
      weight: pkg.cash_attestation_signed ? "neutral" : "negative",
      detail: pkg.cash_attestation_signed
        ? "Cash income attested under penalty of perjury"
        : "Cash income declared without signed attestation",
    });
  }

  if (pkg.reconciliation_flag) {
    factors.push({
      name: "reconciliation_gap",
      weight: "negative",
      detail: `Plaid/Argyle delta of $${pkg.reconciliation_gap.toFixed(2)} exceeds 25% threshold`,
    });
    warnings.push({
      code: "gig_income.reconciliation_gap",
      severity: "warning",
      message: "Plaid deposits differ from Argyle payroll by more than 25%",
    });
  }

  let score: Defensibility;
  const hasVerified = pkg.total_monthly_verified > 0;
  const hasCorroboration = pkg.total_monthly_bank_corroborated > 0;
  if (hasVerified && hasCorroboration && !pkg.reconciliation_flag) score = "strong";
  else if (hasVerified || hasCorroboration) score = "moderate";
  else score = "weak";

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
