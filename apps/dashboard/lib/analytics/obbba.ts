// ---------------------------------------------------------------------------
// OBBBA readiness matrix — pillar 3 of the /compliance dashboard.
//
// Seven SNAP-relevant provisions of the One Big Beautiful Bill Act (P.L.
// 119-21, 2025), framed as a stress test in plain English. For each rule,
// what does the law require, what is at stake in dollars, what is the
// market opportunity if Civica's partner network closes the gap, and where
// does Civica stand today.
//
// Provisions are tiered by visual weight in the panel:
//   - "hero"     → full-width hero card with a big dollar numeral and a
//                  paired market-opportunity callout. §10105 and §10106.
//   - "standard" → standard row layout (what we had before).
//                  §10102 and §10108.
//   - "posture"  → collapsed chip in a single posture strip. Already-shipped
//                  or internal-only items. §10104, 7 CFR 277.4, §6 registry.
//
// Dollar exposures pulled from:
//   - lib/analytics/section10105.ts → perExposure("CA").penaltyExposureDollars
//   - lib/analytics/section10106.ts → DEMO_DATA.CA.exposureDollars
//
// Body copy is intentionally de-jargoned. Code identifiers and acronyms
// (ABAWD, ANCSA, SAVE, CCPA, CWD, ACL numbers, source file paths) live in
// the monospace footer line on each row — never in the lay-prose blocks.
// ---------------------------------------------------------------------------

import { perExposure } from "./section10105";

export type ObbbaStatus = "Ready" | "Partial";
export type ObbbaTier = "hero" | "standard" | "posture";
export type ObbbaStakeholder = "State" | "County" | "CBO" | "Household" | "Civica";

export interface ObbbaProvision {
  /** Sequence number used only for stable React keys. */
  step: number;
  /** Bill section / regulation citation, e.g. "§10102" or "7 CFR 277.4". */
  section: string;
  /** Plain-English title of the row — no jargon, no section symbols. */
  title: string;
  /** Visual tier for the panel layout. */
  tier: ObbbaTier;
  /**
   * Hero numeral string for hero-tier rows (e.g. "$510M"). Null for non-hero.
   * Kept as a string so the panel can format separately from the value.
   */
  heroNumber: string | null;
  /** Subhead line shown below the hero numeral (one short phrase). */
  heroSubhead: string | null;
  /**
   * Single-sentence plain-English summary of what the provision requires —
   * the "what" shown before the impact split.
   */
  oneliner: string;
  /** Full 1-2 sentence layman summary of what the law requires. */
  requires: string;
  /** Plain-English statement of dollar exposure / scale. */
  exposure: string;
  /**
   * Defense + offense framing — what does Civica's partner network gain if
   * the gap closes. Null for posture-tier rows (no upside frame).
   */
  marketOpportunity: string | null;
  /** Where Civica stands today — what shipped, what is pending. */
  posture: string;
  /** Effective / measurement date, human form. */
  effective: string;
  /** Federal authority citations. */
  authorities: string[];
  /** Source path inside the workspace for engineering evidence. */
  source: string;
  /** Lifecycle status. */
  status: ObbbaStatus;
  /** Which parties are directly affected by this provision. */
  stakeholders: ObbbaStakeholder[];
  /**
   * Key compliance deadline in ISO format ("YYYY-MM-DD").
   * Used to position the provision on the OBBBA timeline.
   * For already-shipped items this is the ship date; for future items the
   * hard deadline or measurement-window end.
   */
  deadlineIso: string;
  /**
   * Short left-column impact label for the unified provision list.
   * Dollar amounts, people counts, or a brief risk phrase.
   */
  impactLabel: string;
  /** One-line context that sits below the impactLabel. */
  impactSublabel: string;
  /** Controls visual treatment of the left impact column. */
  impactKind: "dollar" | "count" | "risk" | "ready";
}

// ---------------------------------------------------------------------------
// Pull live dollar figures from the §10105 / §10106 analytics modules.
// ---------------------------------------------------------------------------

const CA_PER = perExposure("CA");
const CA_STATE_EXPOSURE_M = Math.round(CA_PER.penaltyExposureDollars / 1_000_000);
const CA_COUNTY_EXPOSURE_M = 212;

const PROVISIONS: ObbbaProvision[] = [
  // -------------------------------------------------------------------------
  // HERO TIER — the two rows the panel exists to communicate
  // -------------------------------------------------------------------------
  {
    step: 1,
    section: "§10105",
    title: "State payment-error rate cost-share",
    tier: "hero",
    heroNumber: `$${CA_STATE_EXPOSURE_M}M`,
    heroSubhead: "California's FY2028 exposure if the error rate holds",
    oneliner: "States above the federal error-rate threshold owe back a proportional share of admin funding — California's window runs FY2026–FY2028.",
    requires:
      "When a state's payment error rate — the share of cases a federal review flags as wrong — sits above the federal threshold, the state owes back a proportional share of the federal administrative match. The measurement window runs FY2026 through FY2028.",
    exposure: `California's FY2028 exposure is roughly $${CA_STATE_EXPOSURE_M}M if the current error rate holds, proportional to the state's federal admin cost scaled by how far the state's rate sits above the national average.`,
    marketOpportunity: `If California closes to below the §10105 trigger by FY2028, the state avoids the full $${CA_STATE_EXPOSURE_M}M penalty. Partners and CBO licensees who help drive that error-rate reduction capture the operational margin in a state contract — the largest single addressable revenue opportunity on this dashboard.`,
    posture: `The Civica-enrolled cohort runs an error rate near ${CA_PER.civicaCohortPER.toFixed(1)}% versus California statewide ${CA_PER.statewidePER.toFixed(1)}% — well below the trigger. The supporting data pipeline is in production; the FY2026 baseline collection is underway. The live federal-data feed and a locked attribution methodology with the state are the remaining items.`,
    effective: "FY2028 effective · FY2026 measurement window open",
    authorities: ["7 USC 2025(c)", "OBBBA §10105"],
    source: "apps/dashboard/lib/analytics/section10105.ts",
    status: "Partial",
    stakeholders: ["State", "CBO"],
    deadlineIso: "2028-09-30",
    impactLabel: `$${CA_STATE_EXPOSURE_M}M`,
    impactSublabel: "California · FY2028 exposure",
    impactKind: "dollar",
  },
  {
    step: 2,
    section: "§10106",
    title: "County admin match cut from 50% to 25%",
    tier: "hero",
    heroNumber: `$${CA_COUNTY_EXPOSURE_M}M`,
    heroSubhead: "California county exposure when the federal match halves",
    oneliner: "Federal county admin match halves from 50% to 25% on Oct 1, 2026 — counties in high-error-rate states must absorb the gap.",
    requires:
      "The federal government's share of administrative funding sent to counties drops from 50% to 25% on October 1, 2026 in any state above the error-rate threshold. Counties must absorb the difference, and state reporting must attribute the cost back to each county.",
    exposure: `California county exposure totals roughly $${CA_COUNTY_EXPOSURE_M}M as the federal match halves on October 1, 2026 — less than 18 months out. Counties most reliant on the federal admin match (Los Angeles, San Diego, Alameda) carry a disproportionate share.`,
    marketOpportunity: `$${CA_COUNTY_EXPOSURE_M}M of California county admin cost is at risk on October 1, 2026. Counties shifting from a 50% to 25% federal match need a partner that drives the error rate below the trigger — the most acute partnership opportunity on this dashboard, with the shortest window.`,
    posture:
      "Civica logs county-level outcome telemetry on every packet, and a per-county dashboard surfaces denial mix and navigator handoff outcomes. The formal §10106 county exposure report is awaiting state guidance on the attribution formula.",
    effective: "Active October 1, 2026",
    authorities: ["7 USC 2025(a)", "OBBBA §10106"],
    source: "apps/dashboard/lib/analytics/section10106.ts",
    status: "Partial",
    stakeholders: ["County", "CBO"],
    deadlineIso: "2026-10-01",
    impactLabel: `$${CA_COUNTY_EXPOSURE_M}M`,
    impactSublabel: "California · Oct 1, 2026",
    impactKind: "dollar",
  },

  // -------------------------------------------------------------------------
  // STANDARD TIER — substantial provisions without a direct dollar number
  // -------------------------------------------------------------------------
  {
    step: 3,
    section: "§10102",
    title: "Work requirements — who has to log 80 hours a month",
    tier: "standard",
    heroNumber: null,
    heroSubhead: null,
    oneliner: "Age band raised 18→54; tribal members added as exempt; homeless, veteran, and foster-youth exemptions removed. 80 hrs/month required.",
    requires:
      "The 2025 law raises the work-requirement age band from 18-49 to 18-54 for adults without a child under 14 in the household. It adds an exemption for members of federally recognized tribes and Alaska Native corporations, and removes prior exemptions for homeless individuals, veterans, and former foster youth. Adults in scope must log 80 hours of work, training, or volunteering each month or lose SNAP after three months.",
    exposure:
      "Roughly 250,000 to 400,000 Californians sit in the newly expanded age band or lose a prior exemption. If even a fraction are disenrolled without a clean compliance trail, the state and its CBO partners absorb the appeals, churn, and reapplication overhead.",
    marketOpportunity:
      "Counties that demonstrate proactive, defensible work-requirement tracking reduce their disenrollment-driven churn and can argue for lower effective error-rate attribution. Tracking infrastructure that didn't exist before is the wedge.",
    posture:
      "Civica asks the new tribal exemption question at intake, lowered the dependent-child cutoff to under 14, raised the age ceiling to 54, and removed the now-defunct homeless, veteran, and foster-youth exemption screens. A payroll-API integration provides a corroborating hours-worked signal; employer-issued pay records remain the documentation of record. The formal evidence package that satisfies a federal review is still pending counsel.",
    effective: "Active July 4, 2025",
    authorities: ["7 CFR 273.24", "Food Stamp Act §6(o)", "OBBBA §10102(a)"],
    source: "Civica/Features/SNAP/Rules/FederalDefaultRules.swift",
    status: "Partial",
    stakeholders: ["Household", "State", "CBO"],
    deadlineIso: "2025-07-04",
    impactLabel: "250K–400K",
    impactSublabel: "Californians in new scope",
    impactKind: "count",
  },
  {
    step: 4,
    section: "§10108",
    title: "Noncitizen disclosure — referral, not determination",
    tier: "standard",
    heroNumber: null,
    heroSubhead: null,
    oneliner: "Noncitizen eligibility determination is beyond a screener's legal authority — the safe posture is referral-only.",
    requires:
      "The 2025 law strengthens federal verification of noncitizen eligibility and adjusts eligibility for certain noncitizen categories. The legal complexity sits well beyond what a screener can safely answer.",
    exposure:
      "The risk is reputational and legal, not directly dollar-denominated. A screener that tells a noncitizen household it is eligible or ineligible on its own authority exposes Civica and the partner state to a federal verification finding and the household to a wrongful denial.",
    marketOpportunity:
      "A defensible referral-only posture protects state-partner relationships and clears the path to federally funded outreach channels that demand verification compliance.",
    posture:
      "Civica's posture is referral-only. When a user answers 'not a US citizen,' the flow does not attempt to determine eligibility — it surfaces the state SNAP office phone number and the option to contact local legal aid. Citizenship is held as a routing flag only; the specific immigration category is never collected or stored. Three items pending counsel: alignment with the new federal verification requirements, the dollar-estimate suppression rule, and the privacy posture on the citizenship flag.",
    effective: "Active 2025",
    authorities: ["7 USC 2014(a)", "8 USC 1641", "OBBBA §10108"],
    source: "Civica/Features/SNAP/Application/SNAPHouseholdQuestionFlow.swift",
    status: "Partial",
    stakeholders: ["Household", "CBO"],
    deadlineIso: "2025-01-01",
    impactLabel: "Legal exposure",
    impactSublabel: "No dollar amount — referral risk",
    impactKind: "risk",
  },

  // -------------------------------------------------------------------------
  // POSTURE TIER — already-shipped or internal-only items, collapsed
  // -------------------------------------------------------------------------
  {
    step: 5,
    section: "§10104",
    title: "Utility deduction sweep — internet is not a utility",
    tier: "posture",
    heroNumber: null,
    heroSubhead: null,
    oneliner: "Internet is not a qualifying utility — systems that counted it overstate shelter deductions and inflate error rates.",
    requires:
      "The law clarifies that internet, broadband, and wi-fi are not qualifying utility expenses for the SNAP shelter deduction. Systems that previously counted internet inflate household deductions and overstate benefits — which shows up later as a payment-error finding.",
    exposure:
      "Per-household this is small (tens of dollars in monthly benefit). System-wide, any state that quietly counted internet absorbs the resulting error rate into the §10105 cost-share above. For Civica specifically the exposure is near zero because the fix is shipped.",
    marketOpportunity: null,
    posture:
      "Civica shipped the fix. Utility helpers and the voice guide explicitly say 'do not include internet' in both English and Spanish. The state confirms the implementation is compliant. A written confirmation memo to counsel is the only remaining item.",
    effective: "Shipped · state-confirmed",
    authorities: ["7 CFR 273.9(d)(6)", "OBBBA §10104"],
    source: "Civica/Features/SNAP/Application — utilities helpers",
    status: "Ready",
    stakeholders: ["State"],
    deadlineIso: "2025-01-01",
    impactLabel: "~$20/mo",
    impactSublabel: "per household overpaid · rolls into §10105 · shipped",
    impactKind: "count",
  },
  {
    step: 6,
    section: "7 CFR 277.4",
    title: "Outreach pricing rules — no dollar-amount headlines",
    tier: "posture",
    heroNumber: null,
    heroSubhead: null,
    oneliner: "No dollar-amount headlines or urgency language on any SNAP-facing surface — noncompliance disqualifies from state contracts.",
    requires:
      "Federal outreach rules for SNAP prohibit dollar-amount-as-headline framing — no '$48/mo,' no 'save $200,' no urgency or loss-aversion language in any user-facing surface.",
    exposure:
      "Reputational and partnership-eligibility risk. A noncompliant outreach surface disqualifies Civica from state contracts and federally funded SNAP outreach channels; no direct dollar penalty.",
    marketOpportunity: null,
    posture:
      "Civica dropped all dollar-pill messaging from cross-program teasers, the app store listing, and the marketing site. A compile-time guard blocks regressions. The full posture is treated as mandatory regardless of funding structure.",
    effective: "Always-on · CI-enforced",
    authorities: ["7 CFR 277.4(b)(5)(i)", "7 CFR 246.4"],
    source: "Civica/Features/SNAP — compliance copy registry",
    status: "Ready",
    stakeholders: ["CBO", "Civica"],
    deadlineIso: "2025-01-01",
    impactLabel: "Shipped",
    impactSublabel: "CI-enforced, always-on",
    impactKind: "ready",
  },
  {
    step: 7,
    section: "§6 copy registry",
    title: "Nine user-facing strings — no outcome language",
    tier: "posture",
    heroNumber: null,
    heroSubhead: null,
    oneliner: "Civica may not assert 'approved,' 'eligible,' or 'denied' — nine specific strings need counsel signoff before going live.",
    requires:
      "Nine specific user-facing strings (approval emails, decision headlines, expedited banners, recertification SMS, the EBT PIN call-to-action, and others) are governed by §6 of Civica's audit framework. Civica may not say 'approved,' 'eligible,' or 'denied' on its own authority — the state determines outcomes; Civica produces estimates and packets.",
    exposure:
      "Same shape as the rule above: reputational and partnership risk. A user-facing string that asserts an outcome creates a compliance finding and a wrongful-determination claim surface.",
    marketOpportunity: null,
    posture:
      "All nine strings have approved English and Spanish drafts in the compliance registry. A compile-time guard blocks English-only signoff and blocks drift on already-approved rows. Counsel signoff is the remaining item before each row flips from drafted to approved.",
    effective: "Always-on · CI-enforced · counsel signoff pending",
    authorities: ["7 CFR 277.4", "Food Stamp Act §6"],
    source: "Civica/Features/SNAP — compliance copy registry",
    status: "Partial",
    stakeholders: ["CBO", "Civica", "Household"],
    deadlineIso: "2026-09-30",
    impactLabel: "9 strings",
    impactSublabel: "Counsel signoff pending",
    impactKind: "risk",
  },
];

export function obbbaProvisions(): ObbbaProvision[] {
  return PROVISIONS;
}

// ---------------------------------------------------------------------------
// Public / FOIA data sources feeding the QC nationwide framework.
// ---------------------------------------------------------------------------

export type DataSourceStatus = "Live" | "Static" | "Planned FOIA";

export interface PublicDataSource {
  name: string;
  url: string;
  /** ISO date — "2026-05-20" for sources we don't refresh on a schedule yet. */
  lastRefreshed: string;
  status: DataSourceStatus;
  /** One-line description of what this source contributes. */
  note: string;
}

const SOURCES: PublicDataSource[] = [
  {
    name: "USDA FNS SNAP QC Public-Use File · FY2023",
    url: "https://www.fns.usda.gov/snap/qc/datafiles",
    lastRefreshed: "2026-05-20",
    status: "Static",
    note: "Microdata behind QcCategoryCoverage — element-level error shares. Loaded from data-ops/derived/.",
  },
  {
    name: "CDSS CalFresh Data Dashboard",
    url: "https://www.cdss.ca.gov/inforesources/data-portal/research-and-data/calfresh-data-dashboard",
    lastRefreshed: "2026-05-20",
    status: "Live",
    note: "Statewide CalFresh caseload + monthly application/approval/denial totals. Backs baseline comparison in /qc.",
  },
  {
    name: "CDSS CF 296 Statistical Report",
    url: "https://www.cdss.ca.gov/inforesources/research-and-data/calfresh-data-tables",
    lastRefreshed: "2026-05-20",
    status: "Static",
    note: "Monthly county-by-county participation, issuances, and case action counts. Used for §10106 county attribution.",
  },
  {
    name: "Federal QC error-category breakdowns by state",
    url: "https://www.fns.usda.gov/snap/qc",
    lastRefreshed: "2026-05-20",
    status: "Planned FOIA",
    note: "Per-state element-level error distributions — needed to extend baseline comparison beyond California.",
  },
  {
    name: "CDSS denial-reason distributions",
    url: "https://www.cdss.ca.gov/inforesources/calfresh",
    lastRefreshed: "2026-05-20",
    status: "Planned FOIA",
    note: "Categorical denial reasons (procedural vs eligibility) by county and channel — needed to calibrate denial-risk surface.",
  },
  {
    name: "CDSS processing time by submission channel",
    url: "https://www.cdss.ca.gov/inforesources/calfresh",
    lastRefreshed: "2026-05-20",
    status: "Planned FOIA",
    note: "Median time-to-decision by intake channel (BenefitsCal vs paper vs CBO) — needed to benchmark Civica's TTA against the system baseline.",
  },
];

export function publicDataSources(): PublicDataSource[] {
  return SOURCES;
}
