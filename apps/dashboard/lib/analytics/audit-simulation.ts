// ---------------------------------------------------------------------------
// Audit-expectation simulation — pillar 2 of the /compliance dashboard.
//
// Sankey-shaped problem-definition data: three stages flowing left to right.
//
//   STAGE 1 — Who applies     (household-type share of SNAP caseload)
//   STAGE 2 — Where the error enters  (calibrated error categories)
//   STAGE 3 — How it lands    (overpayment / underpayment / procedural / denial)
//
// Civica is INTENTIONALLY ABSENT from this panel. The diagnostic stands on
// its own; pillar 5 is where Civica's cohort tracks against the baseline.
//
// Data sources behind the numbers:
//   - USDA FNS SNAP QC Public-Use File FY2023 (microdata; weighted shares)
//   - USDA FNS national caseload demographic distribution (published)
//   - packages/snap-qc-engine ERROR_WEIGHT (calibrated against CA FY2024 PER)
//   - TODOS.md TODO-4 (27.3% earned-income drives 13.95% PER vs 5.84%)
//
// Stage 3 outcome split is the least-precise piece: federal QC reports
// overpayments and underpayments cleanly, but the procedural-denial vs
// eligibility-denial breakdown leans on FOIA-pending CDSS data. Marked as
// such in the legend.
// ---------------------------------------------------------------------------

export type StageKind = "intake" | "error" | "outcome";
export type SourceKind = "calibrated" | "published" | "estimate";

export interface SankeyNodeData {
  /** Unique id used by d3-sankey to reference nodes in links. */
  id: string;
  /** Plain-English label shown next to the node bar. */
  label: string;
  /** Stage in the left-to-right flow. Drives x-position by node assignment. */
  stage: StageKind;
  /** Optional one-line caption shown under the label on hover. */
  caption?: string;
}

export interface SankeyLinkData {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Flow weight (share of total error volume on this path, in percentage points). */
  value: number;
  /** Quality of the underlying figure — drives "estimate / calibrated / published" tag. */
  sourceKind: SourceKind;
}

// ---------------------------------------------------------------------------
// Stage 1 — Who applies
// USDA FNS published caseload demographic distribution (national FY2023);
// earned-income figure anchored to TODO-4 (27.3%).
// ---------------------------------------------------------------------------
const INTAKE_NODES: SankeyNodeData[] = [
  {
    id: "intake:earned",
    label: "Working households",
    stage: "intake",
    caption: "Households with earned income from wages or self-employment. Roughly 27% of the SNAP caseload; drives ~14% PER versus 6% for non-earners.",
  },
  {
    id: "intake:elderly",
    label: "Elderly households",
    stage: "intake",
    caption: "Households with a member 60 or older. Roughly 24% of the caseload.",
  },
  {
    id: "intake:disabled",
    label: "Households with disability",
    stage: "intake",
    caption: "Households with a member receiving SSDI or with a documented disability. Roughly 17% of the caseload.",
  },
  {
    id: "intake:fixed",
    label: "Fixed-income / TANF / SSI",
    stage: "intake",
    caption: "Households on fixed transfer payments without earned income. Roughly 22% of the caseload.",
  },
  {
    id: "intake:other",
    label: "Other non-earner",
    stage: "intake",
    caption: "Households with neither earned income nor a categorical fast-track. Roughly 10% of the caseload.",
  },
];

// ---------------------------------------------------------------------------
// Stage 2 — Where the error enters
// snap-qc-engine ERROR_WEIGHT, calibrated to CA FY2024 10.98% PER.
// ---------------------------------------------------------------------------
const ERROR_NODES: SankeyNodeData[] = [
  {
    id: "error:utility",
    label: "Utility / shelter misreport",
    stage: "error",
    caption: "Wrong utility flags, wrong rent figure, or wrong standard utility allowance tier. ~50.5% of all errored cases nationally.",
  },
  {
    id: "error:income",
    label: "Earned / gig income misreport",
    stage: "error",
    caption: "Inconsistent paystubs, gig income not captured, or self-employment income misstated. ~26.8% of errored cases.",
  },
  {
    id: "error:lease",
    label: "Shared lease / housing ambiguity",
    stage: "error",
    caption: "Sublease, shared tenancy, or roommate-vs-household confusion. ~11.4% of errored cases.",
  },
  {
    id: "error:asset",
    label: "Asset / resource declaration",
    stage: "error",
    caption: "Undeclared accounts, vehicles wrongly counted, retirement assets misclassified. ~8.2% of errored cases.",
  },
  {
    id: "error:other",
    label: "Categorical or other",
    stage: "error",
    caption: "Wrong categorical-eligibility routing or miscellaneous errors not in the four big buckets. ~3.1% of errored cases.",
  },
];

// ---------------------------------------------------------------------------
// Stage 3 — How it lands
// Overpayment / underpayment from FNS QC (precise). Denial split estimated
// from CDSS dashboards; full denial-reason breakdown is FOIA-pending.
// ---------------------------------------------------------------------------
const OUTCOME_NODES: SankeyNodeData[] = [
  {
    id: "outcome:overpay",
    label: "Overpayment",
    stage: "outcome",
    caption: "Household received more than the rules allow. Roughly 55% of all errored cases — the largest single loss vector, often clawed back from the household later as an overpayment debt.",
  },
  {
    id: "outcome:underpay",
    label: "Underpayment",
    stage: "outcome",
    caption: "Household received less than the rules allow. Roughly 15% of errored cases. Households generally don't know they were underpaid.",
  },
  {
    id: "outcome:procedural",
    label: "Procedural denial",
    stage: "outcome",
    caption: "Application denied for missing paperwork, a missed interview, or a late submission — not for failing the eligibility tests. The largest single source of preventable benefit loss.",
  },
  {
    id: "outcome:eligibility",
    label: "Eligibility denial",
    stage: "outcome",
    caption: "Application denied because the household did not actually meet the eligibility rules.",
  },
];

// ---------------------------------------------------------------------------
// Links — flow weights in percentage points of total errored-case volume.
// Within each stage→next-stage transition, weights are apportioned by:
//   - Stage 1→2: which household types over-represent in each error category.
//     Earned-income tilts heavily into income + utility/shelter; elderly +
//     disabled concentrate in utility/shelter (high shelter costs); etc.
//   - Stage 2→3: each error category's outcome distribution. Income misreports
//     skew overpayment; asset issues skew toward denial; utility/shelter
//     splits ~3:1 overpayment:procedural.
// Sum of all Stage 1→2 weights equals sum of all Stage 2→3 weights (~100).
// ---------------------------------------------------------------------------
const LINKS: SankeyLinkData[] = [
  // Stage 1 → Stage 2
  { source: "intake:earned",   target: "error:income",   value: 18.0, sourceKind: "calibrated" },
  { source: "intake:earned",   target: "error:utility",  value: 12.0, sourceKind: "estimate" },
  { source: "intake:earned",   target: "error:lease",    value: 4.5,  sourceKind: "estimate" },
  { source: "intake:earned",   target: "error:asset",    value: 2.5,  sourceKind: "estimate" },

  { source: "intake:elderly",  target: "error:utility",  value: 15.5, sourceKind: "estimate" },
  { source: "intake:elderly",  target: "error:income",   value: 2.0,  sourceKind: "estimate" },
  { source: "intake:elderly",  target: "error:asset",    value: 2.0,  sourceKind: "estimate" },
  { source: "intake:elderly",  target: "error:other",    value: 1.0,  sourceKind: "estimate" },

  { source: "intake:disabled", target: "error:utility",  value: 10.0, sourceKind: "estimate" },
  { source: "intake:disabled", target: "error:income",   value: 2.5,  sourceKind: "estimate" },
  { source: "intake:disabled", target: "error:asset",    value: 1.5,  sourceKind: "estimate" },
  { source: "intake:disabled", target: "error:lease",    value: 2.0,  sourceKind: "estimate" },

  { source: "intake:fixed",    target: "error:utility",  value: 9.0,  sourceKind: "estimate" },
  { source: "intake:fixed",    target: "error:income",   value: 3.0,  sourceKind: "estimate" },
  { source: "intake:fixed",    target: "error:lease",    value: 3.5,  sourceKind: "estimate" },
  { source: "intake:fixed",    target: "error:other",    value: 1.5,  sourceKind: "estimate" },

  { source: "intake:other",    target: "error:utility",  value: 4.0,  sourceKind: "estimate" },
  { source: "intake:other",    target: "error:income",   value: 1.3,  sourceKind: "estimate" },
  { source: "intake:other",    target: "error:lease",    value: 1.4,  sourceKind: "estimate" },
  { source: "intake:other",    target: "error:asset",    value: 2.2,  sourceKind: "estimate" },
  { source: "intake:other",    target: "error:other",    value: 0.6,  sourceKind: "estimate" },

  // Stage 2 → Stage 3
  { source: "error:utility",   target: "outcome:overpay",     value: 33.0, sourceKind: "calibrated" },
  { source: "error:utility",   target: "outcome:underpay",    value: 7.5,  sourceKind: "calibrated" },
  { source: "error:utility",   target: "outcome:procedural",  value: 8.5,  sourceKind: "estimate" },
  { source: "error:utility",   target: "outcome:eligibility", value: 1.5,  sourceKind: "estimate" },

  { source: "error:income",    target: "outcome:overpay",     value: 16.0, sourceKind: "calibrated" },
  { source: "error:income",    target: "outcome:underpay",    value: 3.5,  sourceKind: "calibrated" },
  { source: "error:income",    target: "outcome:procedural",  value: 5.8,  sourceKind: "estimate" },
  { source: "error:income",    target: "outcome:eligibility", value: 1.5,  sourceKind: "estimate" },

  { source: "error:lease",     target: "outcome:overpay",     value: 4.0,  sourceKind: "estimate" },
  { source: "error:lease",     target: "outcome:underpay",    value: 1.5,  sourceKind: "estimate" },
  { source: "error:lease",     target: "outcome:procedural",  value: 5.0,  sourceKind: "estimate" },
  { source: "error:lease",     target: "outcome:eligibility", value: 0.9,  sourceKind: "estimate" },

  { source: "error:asset",     target: "outcome:overpay",     value: 2.0,  sourceKind: "estimate" },
  { source: "error:asset",     target: "outcome:underpay",    value: 1.5,  sourceKind: "estimate" },
  { source: "error:asset",     target: "outcome:procedural",  value: 3.0,  sourceKind: "estimate" },
  { source: "error:asset",     target: "outcome:eligibility", value: 1.7,  sourceKind: "estimate" },

  { source: "error:other",     target: "outcome:overpay",     value: 0.5,  sourceKind: "estimate" },
  { source: "error:other",     target: "outcome:underpay",    value: 0.4,  sourceKind: "estimate" },
  { source: "error:other",     target: "outcome:procedural",  value: 1.5,  sourceKind: "estimate" },
  { source: "error:other",     target: "outcome:eligibility", value: 0.7,  sourceKind: "estimate" },
];

export function sankeyNodes(): SankeyNodeData[] {
  return [...INTAKE_NODES, ...ERROR_NODES, ...OUTCOME_NODES];
}

export function sankeyLinks(): SankeyLinkData[] {
  return LINKS;
}

// ---------------------------------------------------------------------------
// Provenance strip — the analytical depth that should be the header,
// not the footer.
// ---------------------------------------------------------------------------
export interface ProvenanceTile {
  label: string;
  value: string;
  caption?: string;
}

const PROVENANCE: ProvenanceTile[] = [
  {
    label: "Microdata",
    value: "USDA QC PUF FY2023",
    caption: "household-month records used for the calibration",
  },
  {
    label: "Calibration",
    value: "snap-qc-engine ERROR_WEIGHT",
    caption: "anchored to CA FY2024 10.98% PER",
  },
  {
    label: "Coverage",
    value: "50 states · 58 CA counties",
    caption: "3 FOIA feeds pending refinement",
  },
  {
    label: "Trendline",
    value: "FY2019 → FY2024",
    caption: "six fiscal years of payment-error reporting",
  },
];

export function provenanceTiles(): ProvenanceTile[] {
  return PROVENANCE;
}

// ---------------------------------------------------------------------------
// Headline takeaway — annotation overlay on the dominant flow band.
// Working households → utility/shelter + earned-income → overpayment is
// roughly (12 + 18) * (overpayment share) ≈ 30 pts of total error volume.
// ---------------------------------------------------------------------------
export const HEADLINE_TAKEAWAY = {
  shareOfErrorVolume: 30,
  text:
    "Roughly 30% of all national SNAP losses live on one path — working households whose income or shelter answers don't match what auditors expect, mostly landing as overpayments the household later has to repay.",
};
