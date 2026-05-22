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
    authorities: [],
    source: "intake citizenship gate — applicationFlow/IdentityStep",
    status: "Implemented",
  },
  {
    step: 2,
    statement: "Your household income must fall below the federal gates.",
    explainer:
      "Most households pass two income tests: gross monthly income at or below 130% of the federal poverty line, and net monthly income (after deductions) at or below 100% of FPL. Households entering through categorical eligibility (already on TANF or SSI) skip the gross test.",
    figures: "Gross 130% FPL · Net 100% FPL · HH 4 gross: $3,483/mo · HH 4 net: $2,680/mo",
    authorities: [],
    source: "snap-calculator/index.ts → grossIncomeLimitMonthly, netIncomeLimitMonthly",
    status: "Implemented",
  },
  {
    step: 3,
    statement: "Your countable assets must fall below the resource limit.",
    explainer:
      "Federally, households may not hold more than $3,000 in countable assets — $4,500 if any member is elderly (60+) or disabled. Primary home, one vehicle, and retirement accounts don't count. Many states have eliminated or waived this test via BBCE; California eliminated it entirely (see overlays below).",
    figures: "$3,000 standard · $4,500 elderly / disabled · primary home & 1 vehicle excluded",
    authorities: [],
    source: "snap-calculator/asset-rules.ts → STATE_ASSET_RULES",
    status: "Implemented",
  },
  {
    step: 4,
    statement: "Able-bodied adults without young dependents must meet a work requirement.",
    explainer:
      "Adults aged 18-54 (raised from 49 by the 2025 federal law) without a child under 14 in the household must work, train, or volunteer at least 80 hours per month to stay on SNAP beyond 3 months in any 36-month period. Exemptions include people unable to work for medical reasons, pregnant individuals, those caring for an incapacitated household member, and members of federally recognized tribes or Alaska Native (ANCSA) corporations. The 2025 law removed prior exemptions for homeless individuals, veterans, and foster-youth alumni.",
    figures: "80 hrs/mo · ages 18-54 · dependent-child cutoff: under 14 · 3-month limit per 36 months",
    authorities: ["OBBBA §10102"],
    source: "packages/snap-rules → work-requirements/",
    status: "Partial",
  },
  {
    step: 5,
    statement: "Higher-education students face additional restrictions.",
    explainer:
      "Students aged 18-49 enrolled at least half-time in higher education are ineligible unless they meet at least one exemption: working 20+ hours per week, participating in a state or federal work-study program, caring for a young child, receiving TANF, or enrolled through a SNAP Employment & Training program.",
    figures: "Age 18-49 · ≥ half-time enrolled · exempt via work, caregiving, or program participation",
    authorities: [],
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
    authorities: [],
    source: "snap-calculator/index.ts → calculateSnapBenefit step 1",
    status: "Implemented",
  },
  {
    step: 2,
    statement: "Every household subtracts a flat standard deduction sized to its members.",
    explainer:
      "A fixed dollar amount comes off remaining income, replacing all the small itemized non-shelter living costs that would otherwise need to be deducted line by line. The amount scales with household size and is republished every fiscal year by USDA.",
    figures: "HH 1-3: $209 · HH 4: $223 · HH 5: $261 · HH 6+: $299",
    authorities: [],
    source: "snap-calculator/index.ts → STANDARD_DEDUCTION",
    status: "Implemented",
  },
  {
    step: 3,
    statement: "Out-of-pocket child or dependent care reduces countable income.",
    explainer:
      "If a household member pays for childcare, after-school care, or care for a disabled adult so another member can work, train, or attend school, those costs further reduce income up to a per-dependent cap.",
    figures: "Up to $200/mo per child under 2 · up to $175/mo per other dependent",
    authorities: [],
    source: "snap-calculator/index.ts → DEP_CARE_CAP_*",
    status: "Implemented",
  },
  {
    step: 4,
    statement: "Excessive rent and utility costs reduce countable income further.",
    explainer:
      "When shelter costs (rent or mortgage plus utilities) exceed half of remaining income, the excess subtracts up to a federal cap. Households with an elderly or disabled member deduct shelter without any cap at all. Utility costs are valued through a state-published Standard Utility Allowance schedule rather than itemized bills.",
    figures: "Federal cap $744/mo · waived if elderly or disabled · SUA tiered (full / limited / telephone)",
    authorities: [],
    source: "snap-calculator/index.ts → SHELTER_DEDUCTION_CAP, SUA_AMOUNTS",
    status: "Implemented",
  },
  {
    step: 5,
    statement: "After every deduction, net income must sit at or below the poverty line.",
    explainer:
      "Remaining income (after the earned-income, standard, dependent-care, and shelter deductions) must be at or under 100% of the federal poverty line for the household size. Households entering through categorical eligibility bypass this gate.",
    figures: "HH 1: $1,305/mo · HH 4: $2,680/mo · +$459/person",
    authorities: [],
    source: "snap-calculator/index.ts → netIncomeLimitMonthly",
    status: "Implemented",
  },
  {
    step: 6,
    statement: "The benefit equals the maximum food allotment minus 30% of net income.",
    explainer:
      "SNAP assumes households contribute 30% of their net income toward food and provides the rest, scaled to the Thrifty Food Plan maximum for the household size. The maximum is republished annually each October.",
    figures: "Max HH 1: $298 · HH 4: $994 · +$218/person · benefit = max − (net × 0.30)",
    authorities: [],
    source: "snap-calculator/index.ts → calculateSnapBenefit final step",
    status: "Implemented",
  },
  {
    step: 7,
    statement: "Very small benefits are raised to a federal minimum floor.",
    explainer:
      "For 1- and 2-person households where the formula produces a tiny benefit, federal law floors the allotment at a minimum amount so no eligible small household receives near-zero. Larger households have no minimum.",
    figures: "Min $24/mo (HH 1-2 only) · no minimum for HH 3+",
    authorities: [],
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
    authorities: ["CA CDSS ACL 11-27"],
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
  /** Labor union or partner org that can reach this cohort directly — shown in drawer when present. */
  distributionChannel?: string;
  /** Impact math: partner size × eligibility rate × avg benefit — shown in card summary for targeted groups. */
  distributionMath?: string;
  /**
   * True for the primary wedge — the population Civica is leading with today.
   * Drives brick-accent + "PRIMARY WEDGE" tag in the under-enrolled card.
   * Per rev1 design doc (2026-05-21), the 60+ via duty-of-care facility
   * operators path is primary; other rows are validated greenfield targets.
   */
  primary?: boolean;
}

const UNDER_ENROLLED: UnderEnrolledPopulation[] = [
  {
    step: 1,
    population: "Working college students",
    headlineCue: "Most assume work or parental support disqualifies them",
    eligibleMillions: 3.5,
    enrolledMillions: 1.2,
    qualifiesBecause:
      "Working 20+ hrs/week, work-study, or caring for a young child exempts students from the enrollment restriction. A working student on federal work-study with no parental support typically qualifies.",
    ruleAnchors: ["Section A · gate 5 (student restriction + exemptions)", "Section B · steps 1-3 (income deductions)"],
    whyTheyDontApply:
      "Students assume enrollment or a part-time job disqualifies them. Financial aid offices rarely flag SNAP; the exemption pathways are the least-understood corner of the rules.",
    sources: ["GAO-19-95 (Food Insecurity report)", "USDA FNS SNAP Student Eligibility Guidance"],
  },
  {
    step: 2,
    population: "Working low-wage & gig-income households",
    headlineCue: "~1M CA platform workers earning variable income — enrollment reachable in-app at point of onboarding",
    eligibleMillions: 14.0,
    enrolledMillions: 11.0,
    qualifiesBecause:
      "20% earned-income deduction + CA BBCE at 200% FPL means many platform workers qualify at incomes that feel too high to apply.",
    ruleAnchors: ["Section B · steps 1, 3 (earned-income + dependent-care deductions)", "Section C · overlay 2 (CA BBCE @ 200% FPL)"],
    whyTheyDontApply:
      "Platform workers assume wages disqualify them. The unlock is in-app enrollment at the moment income volatility is highest — they're already in a digital-first product context.",
    distributionChannel:
      "Gig platforms (Uber, DoorDash, Instacart) — in-app enrollment partnership at driver onboarding · UFCW grocery locals · direct mobile-first acquisition",
    distributionMath:
      "~1M CA platform workers → est. 30–40% eligible-but-unenrolled (derived: CA gig-income distribution × BBCE 200% FPL test; variable-income households systematically under-participate per USDA FNS SNAP participation gap data) → ~300–400K households → ~$70–90M/mo in unlocked CalFresh benefits",
    sources: [
      "USDA FNS Trends in SNAP Participation Rates (working low-income participation gap)",
      "CDSS CalFresh Participation Studies",
      "Note: 30–40% eligibility rate is model-derived from wage-distribution data, not a published survey figure for gig workers specifically.",
    ],
  },
  {
    step: 3,
    primary: true,
    population: "Elderly households (60+)",
    headlineCue: "Largest single gap (8.1M) · primary wedge via duty-of-care facility operators (RCFE, Section 202, PACE) where coordinators already own benefits enrollment as part of the job",
    eligibleMillions: 14.0,
    enrolledMillions: 5.9,
    qualifiesBecause:
      "SB 1090 eliminated CA's asset test; BBCE lifts the income gate to 200% FPL; shelter deduction is uncapped for elderly households. Most low-fixed-income homeowners qualify regardless of home equity.",
    ruleAnchors: ["Section C · overlay 1 (CA SB 1090)", "Section C · overlay 2 (CA BBCE)", "Section B · step 4 (uncapped shelter for elderly/disabled)"],
    whyTheyDontApply:
      "Pre-SB 1090 cultural memory: home equity and retirement accounts still feel disqualifying. SNAP carries stigma in the 60+ cohort that Medicare and Social Security don't. The unlock is not a consumer app — it's the social worker or service coordinator at the facility where the resident already lives, already trusts staff, and already has benefits enrollment in scope.",
    distributionChannel:
      "Duty-of-care facility operators (RCFE, Section 202 HUD-funded, PACE) — coordinator-deployed licensed navigator dashboard. CA RCFEs are licensed by CDSS (same agency that administers CalFresh); Section 202 coordinators are HUD-funded for exactly this work.",
    distributionMath:
      "100-resident facility → est. 40% eligible-but-unenrolled (derived: CA 60+ enrollment gap 58% nationally, plus typical facility-resident income profile concentrating at low-fixed-income) → ~40 enrollments × ~$1,680/yr avg CalFresh = ~$67K/yr in unlocked resident income per facility. CA Section 202 + RCFE footprint: ~3,500 licensed facilities → ceiling ~140K facilities-equivalent reach via multi-property operator contracts.",
    sources: ["USDA FNS SNAP Participation by Demographic Group", "CDSS Senior CalFresh Outreach Reports", "CDSS Community Care Licensing — RCFE Facility Counts", "HUD Section 202 Property Inventory · California"],
  },
  {
    step: 4,
    population: "Home care & seasonal agricultural workers",
    headlineCue: "Union-organized and nearly unreached — SEIU 2015 + UFW are the distribution keys into CA's highest-density eligible cohort",
    eligibleMillions: 4.0,
    enrolledMillions: 1.4,
    qualifiesBecause:
      "IHSS part-time hours + BBCE 200% FPL ceiling; agricultural seasonal gaps push income below 130% FPL. Union infrastructure already exists — Civica plugs into it.",
    ruleAnchors: [
      "Section B · steps 1–3 (earned-income, excess shelter, dependent-care deductions)",
      "Section C · overlay 2 (CA BBCE @ 200% FPL)",
    ],
    whyTheyDontApply:
      "Union halls navigate wages, not benefits. Stewards and organizers hold the trust relationships — what's missing is a navigation product inside those relationships.",
    distributionChannel:
      "SEIU 2015 (CA IHSS, ~400K members) · UFW (seasonal agricultural, CA-concentrated) · UNITE HERE Local 11 (hotel & food service, SoCal)",
    distributionMath:
      "SEIU 2015 alone: ~400K CA IHSS members → est. 50–60% eligible-but-unenrolled (derived: BLS IHSS wage range $18–22/hr × typical part-time hours → most fall below BBCE 200% FPL ceiling of $2,430/mo for HH1; CDSS IHSS Program Data confirms part-time predominance) → est. ~200–240K households → ~$46–55M/mo in unlocked CalFresh benefits",
    sources: [
      "BLS Occupational Employment Statistics — Home Health & Personal Care Aides",
      "USDA FNS Farm Worker SNAP Participation Study",
      "CDSS IHSS Program Data",
      "Note: 50–60% eligibility rate is model-derived from IHSS wage distribution × BBCE income test, not a published survey figure.",
    ],
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
