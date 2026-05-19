import type {
  BenefitImpactInput,
  BenefitImpactPackage,
  Citation,
  Defensibility,
  DefensibilityFactor,
  Warning,
} from "../../schemas.js";

export interface BenefitImpactOptions {
  now?: () => string;
}

export interface BenefitImpactResult {
  evidence_package: BenefitImpactPackage;
  defensibility_score: Defensibility;
  defensibility_factors: DefensibilityFactor[];
  citations: Citation[];
  warnings: Warning[];
}

// Earned-income deduction rate: 20% per 7 CFR 273.9(d)(1).
const EID_RATE = 0.20;
// Benefit reduction rate: 30% of net countable income per 7 CFR 273.10(e)(1)(i).
const BENEFIT_REDUCTION_RATE = 0.30;

function roundDollar(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildBenefitImpactPackage(
  input: BenefitImpactInput,
  options: BenefitImpactOptions = {},
): BenefitImpactPackage {
  const now = options.now ?? (() => new Date().toISOString());
  const { job_offer } = input;

  const isFws = job_offer.type === "fws";

  // FWS income is excluded from SNAP income entirely (7 CFR 273.9(c)(3)).
  // All other earned income is subject to the 20% EID before the 30% benefit reduction.
  const fwsExcluded = isFws ? job_offer.monthly_amount : 0;
  const countedIncome = isFws ? 0 : job_offer.monthly_amount;
  const eidApplied = isFws ? 0 : roundDollar(countedIncome * EID_RATE);
  const netCountedIncome = roundDollar(countedIncome - eidApplied);
  const benefitReduction = roundDollar(netCountedIncome * BENEFIT_REDUCTION_RATE);
  const projectedBenefit = Math.max(0, roundDollar(input.current_benefit_usd - benefitReduction));
  const benefitChange = roundDollar(projectedBenefit - input.current_benefit_usd);

  const citations: string[] = isFws
    ? [
        "7 CFR 273.9(c)(3) — Federal Work-Study earnings excluded from income",
        "7 CFR 273.5(b)(5) — Student exemption: Federal Work-Study participant",
      ]
    : [
        "7 CFR 273.9(d)(1) — 20% earned-income deduction",
        "7 CFR 273.10(e)(1)(i) — 30% of net income benefit reduction",
      ];

  if (job_offer.type === "platform_gig") {
    citations.push("OBBBA §10102 — Gig platform work counts toward 80-hour monthly work-activity requirement");
  }

  return {
    flow: "benefit-impact-projection",
    applicant_name: input.applicant_name,
    state_code: input.state_code,
    household_size: input.household_size,
    job_type: job_offer.type,
    employer_name: job_offer.employer_name,
    gross_job_income_usd: job_offer.monthly_amount,
    fws_excluded_usd: fwsExcluded,
    counted_income_usd: countedIncome,
    eid_applied_usd: eidApplied,
    benefit_reduction_usd: benefitReduction,
    current_benefit_usd: input.current_benefit_usd,
    projected_benefit_usd: projectedBenefit,
    benefit_change_usd: benefitChange,
    regulatory_citations: citations,
    generated_at: now(),
  };
}

export function evaluateBenefitImpact(
  input: BenefitImpactInput,
  options: BenefitImpactOptions = {},
): BenefitImpactResult {
  const pkg = buildBenefitImpactPackage(input, options);

  const factors: DefensibilityFactor[] = [
    {
      name: "income_type",
      weight: pkg.job_type === "fws" ? "positive" : "neutral",
      detail:
        pkg.job_type === "fws"
          ? "FWS income excluded from SNAP calculation under 7 CFR 273.9(c)(3)"
          : pkg.job_type === "w2"
            ? "W-2 income subject to 20% EID; 30% benefit reduction on net"
            : "Gig income variable; projection uses stated monthly average",
    },
  ];

  const warnings: Warning[] = [];

  if (pkg.job_type === "platform_gig") {
    warnings.push({
      code: "benefit_impact.gig_income_variable",
      message:
        "Gig income varies monthly. Benefit impact is an estimate based on the stated monthly average. Actual recalculation happens when each paycheck is confirmed via Argyle.",
      severity: "info",
    });
  }

  if (pkg.projected_benefit_usd === 0 && pkg.current_benefit_usd > 0) {
    warnings.push({
      code: "benefit_impact.cliff_event",
      message:
        "Projected benefit reaches $0. This income level exceeds the gross income limit for this household size. Navigator outreach recommended before accepting this offer.",
      severity: "critical",
    });
  }

  const score: Defensibility =
    pkg.job_type === "fws" ? "strong" : warnings.some((w) => w.severity === "critical") ? "weak" : "moderate";

  return {
    evidence_package: pkg,
    defensibility_score: score,
    defensibility_factors: factors,
    citations: citations(pkg.regulatory_citations),
    warnings,
  };
}

function citations(refs: string[]): Citation[] {
  return refs.map((ref) => ({ authority: "federal", reference: ref }));
}
