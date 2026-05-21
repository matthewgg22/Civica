// ---------------------------------------------------------------------------
// SNAP rules framework — pillar 1 of the /compliance dashboard.
//
// Three sections, in order:
//   1. eligibilityGates()      — who can apply (federal baseline gates).
//   2. federalCalculationSteps() — the 7-step federal calc chain, no state
//                                  overlay mixed in.
//   3. californiaOverlays()    — CA-specific deltas (BBCE, SB 1090, HCSUA).
//
// All dollar figures are the FY2026 federal + CA values from the signed
// source-citation table at `docs/SNAP-source-citation-signoff.md` (Q19 of
// COMPLIANCE_AUDIT_OBBBA.md). When FY27 lands (Oct 2026), update from the
// new signed table.
// ---------------------------------------------------------------------------

export type FrameworkStatus = "Implemented" | "Partial" | "Discretionary";

export interface FrameworkItem {
  /** Ordinal within its section. */
  step: number;
  /** Plain-English claim — used as the row header. */
  statement: string;
  /** One-sentence layman explainer immediately under the statement. */
  explainer: string;
  /** Key numbers / criteria for this item, human-readable. */
  figures: string;
  /** Federal + (when relevant) state authority citations. */
  authorities: string[];
  /** Source file path inside the workspace for the engine code. */
  source: string;
  /** Civica implementation status. */
  status: FrameworkStatus;
}

// ---------------------------------------------------------------------------
// 1. Eligibility gates — who can apply at all
// ---------------------------------------------------------------------------

const ELIGIBILITY_GATES: FrameworkItem[] = [
  {
    step: 1,
    statement: "You must be a US citizen or qualified non-citizen.",
    explainer:
      "Citizens and certain legal permanent residents, refugees, asylees, and other qualified non-citizens may apply. Most LPRs face a five-year waiting period unless they're a child, refugee, or disabled. Undocumented household members can't receive benefits but a mixed-status household can still apply for eligible members.",
    figures: "US citizen · LPR (5+ years, with exceptions) · refugee · asylee · withholding of deportation",
    authorities: ["7 CFR 273.4", "PRWORA 1996 §401-402"],
    source: "intake citizenship gate — applicationFlow/IdentityStep",
    status: "Implemented",
  },
  {
    step: 2,
    statement: "Your household income must fall below the federal gates.",
    explainer:
      "Most households pass two income tests: gross monthly income at or below 130% of the federal poverty line, and net monthly income (after deductions) at or below 100% of FPL. Households entering through categorical eligibility (already on TANF or SSI) skip the gross test.",
    figures: "Gross 130% FPL · Net 100% FPL · HH 4 gross: $3,483/mo · HH 4 net: $2,680/mo",
    authorities: ["7 CFR 273.9(a)"],
    source: "snap-calculator/index.ts → grossIncomeLimitMonthly, netIncomeLimitMonthly",
    status: "Implemented",
  },
  {
    step: 3,
    statement: "Your countable assets must fall below the resource limit.",
    explainer:
      "Federally, households may not hold more than $3,000 in countable assets — $4,500 if any member is elderly (60+) or disabled. Primary home, one vehicle, and retirement accounts don't count. Many states have eliminated or waived this test via BBCE; California eliminated it entirely (see overlays below).",
    figures: "$3,000 standard · $4,500 elderly / disabled · primary home & 1 vehicle excluded",
    authorities: ["7 CFR 273.8"],
    source: "snap-calculator/asset-rules.ts → STATE_ASSET_RULES",
    status: "Implemented",
  },
  {
    step: 4,
    statement: "Able-bodied adults without young dependents must meet a work requirement.",
    explainer:
      "Adults aged 18-54 (raised from 49 by the 2025 federal law) without a child under 14 in the household must work, train, or volunteer at least 80 hours per month to stay on SNAP beyond 3 months in any 36-month period. Exemptions include people unable to work for medical reasons, pregnant individuals, those caring for an incapacitated household member, and members of federally recognized tribes or Alaska Native (ANCSA) corporations. The 2025 law removed prior exemptions for homeless individuals, veterans, and foster-youth alumni.",
    figures: "80 hrs/mo · ages 18-54 · dependent-child cutoff: under 14 · 3-month limit per 36 months",
    authorities: ["7 CFR 273.24", "Food Stamp Act §6(o)", "OBBBA §10102 (2025)"],
    source: "packages/snap-rules → work-requirements/",
    status: "Partial",
  },
  {
    step: 5,
    statement: "Higher-education students face additional restrictions.",
    explainer:
      "Students aged 18-49 enrolled at least half-time in higher education are ineligible unless they meet at least one exemption: working 20+ hours per week, participating in a state or federal work-study program, caring for a young child, receiving TANF, or enrolled through a SNAP Employment & Training program.",
    figures: "Age 18-49 · ≥ half-time enrolled · exempt via work, caregiving, or program participation",
    authorities: ["7 CFR 273.5"],
    source: "intake student-status gate — applicationFlow/StudentStep",
    status: "Implemented",
  },
];

// ---------------------------------------------------------------------------
// 2. Federal calculation chain — how the benefit is computed (federal only)
// ---------------------------------------------------------------------------

const FEDERAL_CALC_STEPS: FrameworkItem[] = [
  {
    step: 1,
    statement: "The first 20% of earned income doesn't count.",
    explainer:
      "To recognize that working households absorb transportation, taxes, and other job-related costs, SNAP automatically discounts 20% of any wages or self-employment income before any further tests apply. This deduction is universal and requires no documentation.",
    figures: "gross_earned × 0.80",
    authorities: ["7 CFR 273.9(d)(2)"],
    source: "snap-calculator/index.ts → calculateSnapBenefit step 1",
    status: "Implemented",
  },
  {
    step: 2,
    statement: "Every household subtracts a flat standard deduction sized to its members.",
    explainer:
      "A fixed dollar amount comes off remaining income, replacing all the small itemized non-shelter living costs that would otherwise need to be deducted line by line. The amount scales with household size and is republished every fiscal year by USDA.",
    figures: "HH 1-3: $209 · HH 4: $223 · HH 5: $261 · HH 6+: $299",
    authorities: ["7 CFR 273.9(d)(1)"],
    source: "snap-calculator/index.ts → STANDARD_DEDUCTION",
    status: "Implemented",
  },
  {
    step: 3,
    statement: "Out-of-pocket child or dependent care reduces countable income.",
    explainer:
      "If a household member pays for childcare, after-school care, or care for a disabled adult so another member can work, train, or attend school, those costs further reduce income up to a per-dependent cap.",
    figures: "Up to $200/mo per child under 2 · up to $175/mo per other dependent",
    authorities: ["7 CFR 273.9(d)(4)"],
    source: "snap-calculator/index.ts → DEP_CARE_CAP_*",
    status: "Implemented",
  },
  {
    step: 4,
    statement: "Excessive rent and utility costs reduce countable income further.",
    explainer:
      "When shelter costs (rent or mortgage plus utilities) exceed half of remaining income, the excess subtracts up to a federal cap. Households with an elderly or disabled member deduct shelter without any cap at all. Utility costs are valued through a state-published Standard Utility Allowance schedule rather than itemized bills.",
    figures: "Federal cap $744/mo · waived if elderly or disabled · SUA tiered (full / limited / telephone)",
    authorities: ["7 CFR 273.9(d)(6)"],
    source: "snap-calculator/index.ts → SHELTER_DEDUCTION_CAP, SUA_AMOUNTS",
    status: "Implemented",
  },
  {
    step: 5,
    statement: "After every deduction, net income must sit at or below the poverty line.",
    explainer:
      "Remaining income (after the earned-income, standard, dependent-care, and shelter deductions) must be at or under 100% of the federal poverty line for the household size. Households entering through categorical eligibility bypass this gate.",
    figures: "HH 1: $1,305/mo · HH 4: $2,680/mo · +$459/person",
    authorities: ["7 CFR 273.9(a)(2)"],
    source: "snap-calculator/index.ts → netIncomeLimitMonthly",
    status: "Implemented",
  },
  {
    step: 6,
    statement: "The benefit equals the maximum food allotment minus 30% of net income.",
    explainer:
      "SNAP assumes households contribute 30% of their net income toward food and provides the rest, scaled to the Thrifty Food Plan maximum for the household size. The maximum is republished annually each October.",
    figures: "Max HH 1: $298 · HH 4: $994 · +$218/person · benefit = max − (net × 0.30)",
    authorities: ["7 CFR 273.10(e)"],
    source: "snap-calculator/index.ts → calculateSnapBenefit final step",
    status: "Implemented",
  },
  {
    step: 7,
    statement: "Very small benefits are raised to a federal minimum floor.",
    explainer:
      "For 1- and 2-person households where the formula produces a tiny benefit, federal law floors the allotment at a minimum amount so no eligible small household receives near-zero. Larger households have no minimum.",
    figures: "Min $24/mo (HH 1-2 only) · no minimum for HH 3+",
    authorities: ["7 CFR 273.10(e)(2)(ii)"],
    source: "snap-calculator/index.ts → calculateSnapBenefit minimum floor",
    status: "Implemented",
  },
];

// ---------------------------------------------------------------------------
// 3. California overlays — what CA changes on top of the federal baseline
// ---------------------------------------------------------------------------

const CALIFORNIA_OVERLAYS: FrameworkItem[] = [
  {
    step: 1,
    statement: "California eliminated the asset test entirely.",
    explainer:
      "Effective January 2020, California removed the federal $3,000 / $4,500 resource limit for SNAP (CalFresh) applicants. Households still report assets at intake for federal reporting purposes, but the state does not turn anyone away for holding too much in countable resources.",
    figures: "No asset test · all federal resource limits waived in CA",
    authorities: ["CA SB 1090 (2019)"],
    source: "snap-calculator/asset-rules.ts → STATE_ASSET_RULES['CA']",
    status: "Implemented",
  },
  {
    step: 2,
    statement: "BBCE lifts the gross-income gate from 130% to 200% of FPL.",
    explainer:
      "California's Broad-Based Categorical Eligibility pathway means any household receiving even a token TANF-funded service is treated as categorically eligible — and qualifies under a gross-income limit of 200% FPL instead of the federal 130%. The net income test is also waived for BBCE households.",
    figures: "Gross ~200% FPL · net test waived · HH 4 MCE: $5,360/mo (vs federal $3,483)",
    authorities: ["CA CDSS ACL 11-27", "7 CFR 273.2(j)"],
    source: "snap-calculator/index.ts → isCaBbceEligible, bbceIncomeLimitMonthly",
    status: "Implemented",
  },
  {
    step: 3,
    statement: "California's standard utility allowance includes air conditioning costs.",
    explainer:
      "California's HCSUA (Heating and Cooling Standard Utility Allowance) covers full utilities at $663/month — recognizing that A/C costs in much of the state are a year-round housing expense, not a seasonal one. Households claiming any heating or cooling utility cost qualify for the full HCSUA, not a partial allowance.",
    figures: "HCSUA $663/mo full · LUA $170 limited · TUA $20 telephone-only",
    authorities: ["CA CDSS MPP 63-503.43"],
    source: "snap-calculator/sua-rules.ts → STATE_SUA_RULES['CA']",
    status: "Implemented",
  },
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function eligibilityGates(): FrameworkItem[] {
  return ELIGIBILITY_GATES;
}

export function federalCalculationSteps(): FrameworkItem[] {
  return FEDERAL_CALC_STEPS;
}

export function californiaOverlays(): FrameworkItem[] {
  return CALIFORNIA_OVERLAYS;
}

// ---------------------------------------------------------------------------
// 4. Under-enrolled populations — applying the rules
//
// Now that the rules are on the page, who do they actually reach today? This
// section names populations that qualify under the criteria above but where
// participation lags eligibility. It primes the audience for the strategic
// focus areas (working students, gig workers) without yet introducing Civica.
// ---------------------------------------------------------------------------

export interface UnderEnrolledPopulation {
  step: number;
  /** Who the population is — plain-English label. */
  population: string;
  /** One-line cue used inside the card under the hero gap number. */
  headlineCue: string;
  /** National eligible population in millions of households. */
  eligibleMillions: number;
  /** National enrolled population in millions of households. */
  enrolledMillions: number;
  /** Longer layman explainer — shown in the expand drawer only. */
  qualifiesBecause: string;
  /** Which earlier section / gate / step / overlay routes them in. */
  ruleAnchors: string[];
  /** Longer explanation — shown in the expand drawer only. */
  whyTheyDontApply: string;
  /** Source citation strings (USDA, CDSS, GAO, etc.). */
  sources: string[];
}

const UNDER_ENROLLED: UnderEnrolledPopulation[] = [
  {
    step: 1,
    population: "Working college students",
    headlineCue: "Most assume work or parental support disqualifies them",
    eligibleMillions: 3.5,
    enrolledMillions: 1.2,
    qualifiesBecause:
      "Higher-ed students aged 18-49 enrolled at least half-time are restricted by default, but the federal exemption pathways are real and wide — working 20+ hours per week, federal or state work-study, caring for a young child, receiving TANF, or enrolling through a SNAP Employment & Training program. A working student on work-study with no parental support typically qualifies.",
    ruleAnchors: ["Section A · gate 5 (student restriction + exemptions)", "Section B · steps 1-3 (income deductions)"],
    whyTheyDontApply:
      "Most students assume that being a student — or having any parental support, or holding a part-time job — disqualifies them. Campus financial-aid offices rarely flag SNAP proactively, and the student exemption framework is one of the least-understood corners of the rules.",
    sources: ["GAO-19-95 (Food Insecurity report)", "USDA FNS SNAP Student Eligibility Guidance"],
  },
  {
    step: 2,
    population: "Working low-wage & gig-income households",
    headlineCue: "Assume any wages disqualify; gig income especially invisible to intake forms",
    eligibleMillions: 14.0,
    enrolledMillions: 11.0,
    qualifiesBecause:
      "The federal 20% earned-income deduction (Section B step 1), the dependent-care deduction (step 3), and California's BBCE pathway (Section C overlay 2 — gross income up to 200% of poverty) mean that many working families qualify even at incomes that intuitively feel too high to apply.",
    ruleAnchors: ["Section B · steps 1, 3 (earned-income + dependent-care deductions)", "Section C · overlay 2 (CA BBCE @ 200% FPL)"],
    whyTheyDontApply:
      "Working applicants commonly assume that any wages or self-employment income disqualifies them. Gig-economy income is especially invisible to traditional intake — drivers, couriers, and platform workers rarely think of themselves as eligible for food benefits.",
    sources: ["USDA FNS Trends in SNAP Participation Rates", "CDSS CalFresh Participation Studies"],
  },
  {
    step: 3,
    population: "Mixed-immigration-status households",
    headlineCue: "Fear of enforcement consequences for non-eligible members deters partial enrollment",
    eligibleMillions: 3.5,
    enrolledMillions: 2.1,
    qualifiesBecause:
      "Eligible US citizens and qualified non-citizens in mixed-status households can apply for the eligible members. Federal rules permit partial enrollment, and immigration status is not collected as an identifier — the screener can route to state SNAP office or legal aid (Section A · gate 1 plus the §10108 referral approach).",
    ruleAnchors: ["Section A · gate 1 (citizenship — qualified non-citizen pathways)", "Pillar 3 · §10108 referral-only posture"],
    whyTheyDontApply:
      "Fear of immigration enforcement consequences for the household's non-eligible members dominates the calculus — even when the rules permit and protect partial enrollment. Outreach requires trusted intermediaries — CBOs, legal aid, schools — more than any rules-explanation product can provide alone.",
    sources: ["USDA FNS Immigrant Eligibility Guidance", "Center on Budget and Policy Priorities"],
  },
  {
    step: 4,
    population: "Elderly households (60+)",
    headlineCue: "Pre-SB 1090 belief that home equity or retirement disqualifies; lasting stigma in the over-65 cohort",
    eligibleMillions: 14.0,
    enrolledMillions: 5.9,
    qualifiesBecause:
      "California eliminated the asset test entirely (Section C overlay 1 · SB 1090), the BBCE pathway lifts the income gate to 200% of poverty (Section C overlay 2), and the federal shelter deduction is uncapped for elderly or disabled households (Section B step 4) — together making most low-fixed-income elderly homeowners eligible regardless of asset value.",
    ruleAnchors: ["Section C · overlay 1 (CA SB 1090)", "Section C · overlay 2 (CA BBCE)", "Section B · step 4 (uncapped shelter for elderly/disabled)"],
    whyTheyDontApply:
      "Lingering pre-SB 1090 cultural memory — elderly applicants assume home equity or retirement accounts disqualify them. SNAP also carries lasting stigma in the over-65 cohort that other transfer programs (Medicare, Social Security) do not.",
    sources: ["USDA FNS SNAP Participation by Demographic Group", "CDSS Senior CalFresh Outreach Reports"],
  },
];

export function underEnrolledPopulations(): UnderEnrolledPopulation[] {
  return UNDER_ENROLLED;
}

export function frameworkCoverageSummary(): {
  gates: number;
  calcSteps: number;
  caOverlays: number;
  underEnrolled: number;
  fiscalYear: string;
} {
  return {
    gates: ELIGIBILITY_GATES.length,
    calcSteps: FEDERAL_CALC_STEPS.length,
    caOverlays: CALIFORNIA_OVERLAYS.length,
    underEnrolled: UNDER_ENROLLED.length,
    fiscalYear: "FY2026",
  };
}
