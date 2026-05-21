// ---------------------------------------------------------------------------
// Verification stack — pillar 4 of the /compliance dashboard.
//
// What Civica actually deploys to pre-verify an applicant — at intake,
// around the renewal deadline, and if a packet hits a snag. Each tool is
// classed by how defensible its evidence is and whether it's running in
// production today, planned, or being phased out.
//
// AUDIENCE IS LAYMAN — investors, state partners, prospective CBO licensees,
// members of the public. Plain-English summaries lead; technical routing
// sits in the smaller text.
//
// Static for now; post-MVP, swap for a query against a usage-telemetry
// table so the stack page reflects actual deployment rates.
// ---------------------------------------------------------------------------

export type VerificationTier = "Strong" | "Moderate" | "Weak" | "Discretionary";
export type VerificationStatus = "Live" | "Planned" | "Sunset candidate";
export type VerificationGroup =
  | "intake"
  | "renewal"
  | "post-decision";

export interface VerificationTool {
  /** Which phase of the applicant journey this tool serves. */
  group: VerificationGroup;
  /** Plain-English label: what rule, deduction, or risk this tool addresses. */
  servesRule: string;
  /** Short tool name shown as the row header. */
  tool: string;
  /** Plain-English description of what the tool produces as evidence. */
  produces: string;
  /** Plain-English description of where that evidence flows downstream. */
  routesTo: string;
  /** Defensibility tier of the evidence. */
  tier: VerificationTier;
  /** Lifecycle status of the tool. */
  status: VerificationStatus;
  /** Optional one-line caveat or footnote. */
  caveat?: string;
}

const TOOLS: VerificationTool[] = [
  // -------------------------------------------------------------------------
  // Group 1 — Before the packet ships (initial verification)
  // -------------------------------------------------------------------------
  {
    group: "intake",
    servesRule: "Earned income (paystubs)",
    tool: "Argyle payroll connection",
    produces:
      "Authenticated pay-frequency, year-to-date gross income, employer name, and hours worked, pulled directly from the applicant's payroll provider after the applicant consents.",
    routesTo:
      "Earned-income calculation step, plus the work-requirement (ABAWD) hours signal for §10102.",
    tier: "Strong",
    status: "Live",
    caveat: "Treated as corroborating evidence; the documentation of record remains employer-issued pay records.",
  },
  {
    group: "intake",
    servesRule: "Fast-track entry (categorical eligibility)",
    tool: "TANF / SSI categorical question + California BBCE auto-route",
    produces:
      "Yes/no flag that the applicant is already on TANF or SSI; in California, the engine also auto-routes households at or below 200% of the poverty line through the BBCE pathway.",
    routesTo: "Eligibility engine — sets which gates the household skips.",
    tier: "Strong",
    status: "Live",
  },
  {
    group: "intake",
    servesRule: "Identity",
    tool: "Photo ID upload + on-device document classifier",
    produces:
      "Document type (driver's license, state ID, passport) and a name-match check against what the applicant entered.",
    routesTo: "Identity verification step on the application.",
    tier: "Moderate",
    status: "Live",
    caveat: "Liveness check planned would lift this to Strong.",
  },
  {
    group: "intake",
    servesRule: "Utility costs (for shelter deduction)",
    tool: "Self-attested utility flags + deterministic allowance schedule",
    produces:
      "Yes/no answers on which utilities the household pays for, mapped automatically to the state's standard utility allowance — California's full HCSUA is $663/month.",
    routesTo:
      "Shelter-deduction calculation in the SNAP benefit engine.",
    tier: "Moderate",
    status: "Live",
    caveat: "A direct UtilityAPI integration would lift this to Strong by reading actual utility billing.",
  },
  {
    group: "intake",
    servesRule: "Housing cost (rent or mortgage)",
    tool: "Lease or mortgage upload + on-device OCR",
    produces:
      "Monthly rent or mortgage amount extracted from the uploaded document, with applicant confirmation before it counts.",
    routesTo: "Shelter-deduction calculation.",
    tier: "Moderate",
    status: "Live",
    caveat: "Sublease and shared-tenancy cases route to navigator review.",
  },
  {
    group: "intake",
    servesRule: "Sublease and shared-tenancy detection",
    tool: "Sublease classifier",
    produces:
      "Probability score that an uploaded lease is a sublease or shared-tenancy arrangement rather than a primary tenancy.",
    routesTo:
      "Routes ambiguous cases to navigator review instead of letting them auto-flow through the shelter-deduction path.",
    tier: "Moderate",
    status: "Planned",
  },
  {
    group: "intake",
    servesRule: "Dependent care costs",
    tool: "Receipt or invoice upload",
    produces:
      "Monthly dollar amount the household pays out-of-pocket for child care or adult dependent care, captured from an uploaded receipt or invoice.",
    routesTo: "Dependent-care deduction step.",
    tier: "Weak",
    status: "Live",
    caveat: "Self-reported amount only; no third-party verification of the provider today.",
  },
  {
    group: "intake",
    servesRule: "Asset / resource declarations",
    tool: "Self-attested asset declaration",
    produces:
      "Account types and balances the applicant enters at intake.",
    routesTo:
      "Federal asset test (skipped in California since SB 1090).",
    tier: "Weak",
    status: "Live",
    caveat: "A Plaid-balance integration would lift this to Strong in non-BBCE states.",
  },
  {
    group: "intake",
    servesRule: "Expedited-eligibility detection",
    tool: "Navigator distress-review gate",
    produces:
      "Amber banner that fires for navigators when an applicant is unemployed with gross income under $150 — the federal expedited threshold — and the expedited flag has not been answered.",
    routesTo: "Forces a confirm/deny decision before the packet can move to Ready for Handoff.",
    tier: "Strong",
    status: "Live",
  },

  // -------------------------------------------------------------------------
  // Group 2 — Around the renewal deadline (the recertification companion)
  // -------------------------------------------------------------------------
  {
    group: "renewal",
    servesRule: "Renewal interview readiness",
    tool: "Phantom recert (60-day shadow run)",
    produces:
      "A complete dry-run of the renewal interview using the household's stored answers — sixty days before the real recertification deadline. Surfaces documentation gaps and answer drift before they cause a real denial.",
    routesTo:
      "Phantom-recert summary screen + checklist of items the household needs to refresh.",
    tier: "Strong",
    status: "Live",
  },
  {
    group: "renewal",
    servesRule: "Document freshness for renewal",
    tool: "Expiration calendar",
    produces:
      "Per-document forecast of which uploaded items (paystubs, lease, utility bills, ID) will be stale by the recertification deadline.",
    routesTo:
      "Just-in-time reminder scheduler — flags the optimal day to capture each replacement document.",
    tier: "Strong",
    status: "Live",
  },
  {
    group: "renewal",
    servesRule: "On-time recertification submission",
    tool: "Just-in-time reminders (push + SMS)",
    produces:
      "Scheduled prompts on the optimal day to upload each refreshed document and to confirm the renewal interview date — anchored to the household's confirmed recert date in their county.",
    routesTo:
      "Recert notification service. Identifiers follow `co.civica.recert.{document_type}.{action}` for clean replacement.",
    tier: "Moderate",
    status: "Live",
  },
  {
    group: "renewal",
    servesRule: "Refreshed packet before recert deadline",
    tool: "AI-refreshed renewal packet",
    produces:
      "Before the recert deadline the QC engine re-runs on updated income and asset signals and emits a refreshed evidence packet the navigator can confirm and hand off.",
    routesTo: "Navigator review queue with a 'recert ready' tag.",
    tier: "Strong",
    status: "Live",
  },
  {
    group: "renewal",
    servesRule: "Monthly engagement + recert readiness",
    tool: "EBT balance + transaction visibility",
    produces:
      "Real-time EBT card balance, reload date, and recent transactions surfaced in-app — gives the household a reason to open Civica every month between recerts. The engagement loop that makes every other recert tool actually land.",
    routesTo:
      "Keeps users active so recert reminders fire on warm contacts, not cold ones. Balance-pattern signals (sudden zero, missed reload, unusual depletion) trigger pre-emptive navigator outreach before the household notices a problem.",
    tier: "Strong",
    status: "Planned",
    caveat: "Requires state EBT processor integration (CA: FIS via ebt.ca.gov pipeline) or USDA Project Connect pathway. Some states already expose card-balance APIs; CA is in roadmap. Interim: user-pasted balance + receipt OCR.",
  },

  // -------------------------------------------------------------------------
  // Group 3 — If the packet hits a snag (post-decision support)
  // -------------------------------------------------------------------------
  {
    group: "post-decision",
    servesRule: "Procedural denial recovery",
    tool: "Procedural appeal drafter",
    produces:
      "Pre-filled fair-hearing request when a household is denied for procedural reasons (missed appointment, missing paperwork, late submission). Uses a template — not a free LLM call — keyed off the 7 CFR 273.2 failure-vs-refusal-to-cooperate distinction.",
    routesTo:
      "Appeal review screen for navigator confirmation, then export as PDF or to the county portal.",
    tier: "Moderate",
    status: "Live",
    caveat: "Legal review of every state × language template is mandatory before the feature flag flips on.",
  },
];

export function verificationTools(): VerificationTool[] {
  return TOOLS;
}

export function verificationStackSummary(): {
  strongOrModerate: number;
  total: number;
  liveTools: number;
  recertTools: number;
} {
  const live = TOOLS.filter((t) => t.status === "Live");
  return {
    liveTools: live.length,
    strongOrModerate: live.filter((t) => t.tier === "Strong" || t.tier === "Moderate").length,
    total: live.length,
    recertTools: live.filter((t) => t.group === "renewal").length,
  };
}
