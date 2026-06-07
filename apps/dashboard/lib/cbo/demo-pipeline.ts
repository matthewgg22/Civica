// Lifecycle pipeline for /cbo-preview, de-faked (#real-engine).
//
// Households move through four phases:
//   Requesting assistance → Live application → Enrolled → Recertification
// The applicant ANSWERS are synthetic (public page, no PII), but the benefit
// estimate + verification checklist are computed live by @civica/snap-rules via
// the same facts-adapter a real packet uses. Synthetic input, REAL engine
// output. The phase + stage + history are the navigator-workflow overlay.

import { estimatePacketBenefit, type PacketAnswers } from "../engines/facts-adapter";

export const PIPELINE_STEPS = [
  "Eligibility screener",
  "Household & identity",
  "Income & employment",
  "Expenses & deductions",
  "Document verification",
  "Engine determination",
  "Navigator review",
  "Submitted to county",
] as const;

const TOTAL_STEPS = PIPELINE_STEPS.length;

export type Risk = "Low risk" | "Medium risk" | "High risk";

// The four lifecycle phases, in order. The funnel renders these left→right.
export type Phase = "requesting" | "live" | "enrolled" | "recert";
export const PHASES: { key: Phase; label: string; blurb: string; accent: string }[] = [
  { key: "requesting", label: "Requesting assistance", blurb: "Reached out — not yet submitted", accent: "bg-indigo" },
  { key: "live", label: "Live application", blurb: "In review with the county", accent: "bg-warning" },
  { key: "enrolled", label: "Enrolled", blurb: "Approved — receiving benefits", accent: "bg-pine" },
  { key: "recert", label: "Recertification", blurb: "Renewal due", accent: "bg-amber" },
];

export interface SurveyAnswer {
  section: string;
  question: string;
  answer: string;
  flagged?: boolean;
}

export interface TimelineEvent {
  label: string;
  when: string;
  by?: string;
}

interface DemoApplicant {
  id: string;
  caseId: string;
  name: string;
  county: string;
  phase: Phase;
  /** The specific stage within the phase, shown on the row. */
  stage: string;
  risk: Risk;
  updated: string;
  completedSteps: number;
  engineInputs: PacketAnswers;
  answers: SurveyAnswer[];
  docFlags: string[];
  history: TimelineEvent[];
}

export interface QueueApplication {
  id: string;
  caseId: string;
  name: string;
  county: string;
  phase: Phase;
  stage: string;
  risk: Risk;
  updated: string;
  completedSteps: number;
  answers: SurveyAnswer[];
  docFlags: string[];
  history: TimelineEvent[];
  estimatedBenefitUsd: number | null;
  verificationNeeds: string[];
  assumptions: string[];
}

export interface PhaseGroup {
  key: Phase;
  label: string;
  blurb: string;
  accent: string;
  cases: QueueApplication[];
}

const APPLICANTS: DemoApplicant[] = [
  // ── Requesting assistance ────────────────────────────────────────────────
  {
    id: "demo-pkt-aisha", caseId: "CF-2026-0211", name: "Aisha K.", county: "Los Angeles",
    phase: "requesting", stage: "Screener complete", risk: "Low risk", updated: "3h ago", completedSteps: 2,
    engineInputs: { household_size: "2", monthly_income: "1800", monthly_rent: "1400", monthly_utilities: "120", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "2 people" },
      { section: "Income", question: "Gross monthly income", answer: "$1,800" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,400" },
    ],
    docFlags: [],
    history: [{ label: "Reached out via web", when: "Oct 13", by: "Applicant" }, { label: "Screener completed", when: "Oct 13", by: "Applicant" }],
  },
  {
    id: "demo-pkt-daniel", caseId: "CF-2026-0209", name: "Daniel P.", county: "San Diego",
    phase: "requesting", stage: "Application drafted", risk: "Medium risk", updated: "1d ago", completedSteps: 3,
    engineInputs: { household_size: "1", monthly_income: "1450", monthly_rent: "1200", monthly_utilities: "0", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "1 person" },
      { section: "Income", question: "Gross monthly income", answer: "$1,450" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,200" },
      { section: "Documents", question: "Photo ID", answer: "Not yet uploaded", flagged: true },
    ],
    docFlags: ["Has not submitted — drafted 1 day ago, no progress"],
    history: [{ label: "Reached out via CBO", when: "Oct 12", by: "Navigator J. Ruiz" }, { label: "Started application", when: "Oct 12", by: "Applicant" }],
  },
  // ── Live application ──────────────────────────────────────────────────────
  {
    id: "demo-pkt-003-jasmine", caseId: "CF-2026-0188", name: "Jasmine T.", county: "Los Angeles",
    phase: "live", stage: "Documents requested", risk: "Medium risk", updated: "1d ago", completedSteps: 4,
    engineInputs: { household_size: "4", monthly_income: "3100", monthly_rent: "2050", monthly_utilities: "240", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "4 people" },
      { section: "Your household", question: "Children under 14?", answer: "Yes" },
      { section: "Income", question: "Gross monthly income", answer: "$3,100" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$2,050" },
      { section: "Monthly expenses", question: "Monthly utilities", answer: "$240" },
      { section: "Documents", question: "Photo ID", answer: "On hand" },
      { section: "Documents", question: "Proof of income", answer: "Not provided", flagged: true },
    ],
    docFlags: ["Income verification documents missing", "Most recent pay stub is older than 30 days"],
    history: [
      { label: "Submitted for review", when: "Oct 11", by: "Applicant" },
      { label: "Picked up for review", when: "Oct 12", by: "Navigator J. Ruiz" },
      { label: "Documents requested", when: "Oct 13", by: "Navigator J. Ruiz" },
    ],
  },
  {
    id: "demo-pkt-elena", caseId: "CF-2026-0184", name: "Elena V.", county: "San Francisco",
    phase: "live", stage: "Needs clarification", risk: "High risk", updated: "2d ago", completedSteps: 2,
    engineInputs: { household_size: "1", monthly_income: "1640", monthly_rent: "2400", monthly_utilities: "0", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "1 person" },
      { section: "Your household", question: "Has a Social Security Number?", answer: "Yes — does not match SSA records", flagged: true },
      { section: "Income", question: "Gross monthly income", answer: "$1,640" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$2,400 — exceeds area norm", flagged: true },
    ],
    docFlags: ["SSN does not match SSA records", "Reported rent exceeds area norm — verify shelter cost"],
    history: [
      { label: "Submitted for review", when: "Oct 12", by: "Applicant" },
      { label: "Clarification requested", when: "Oct 13", by: "Navigator A. Cole" },
    ],
  },
  {
    id: "demo-pkt-002-carlos", caseId: "CF-2026-0203", name: "Carlos R.", county: "Fresno",
    phase: "live", stage: "Interview scheduled", risk: "Medium risk", updated: "5h ago", completedSteps: 6,
    engineInputs: { household_size: "2", monthly_income: "1980", monthly_rent: "1320", monthly_utilities: "160", employment_status: "self_employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "2 people" },
      { section: "Income", question: "Income type", answer: "Self-employment", flagged: true },
      { section: "Income", question: "Gross monthly income", answer: "$1,980" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,320" },
      { section: "Documents", question: "Self-employment ledger", answer: "On hand" },
    ],
    docFlags: ["Self-employment income — manual review recommended"],
    history: [
      { label: "Submitted for review", when: "Oct 12", by: "Applicant" },
      { label: "Picked up for review", when: "Oct 13", by: "Navigator M. Diaz" },
      { label: "Interview scheduled", when: "Oct 14", by: "County" },
    ],
  },
  {
    id: "demo-pkt-sofia", caseId: "CF-2026-0201", name: "Sofia M.", county: "Sacramento",
    phase: "live", stage: "Submitted to county", risk: "Low risk", updated: "1d ago", completedSteps: 8,
    engineInputs: { household_size: "2", monthly_income: "1980", monthly_rent: "1320", monthly_utilities: "150", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "2 people" },
      { section: "Income", question: "Gross monthly income", answer: "$1,980" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,320" },
      { section: "Documents", question: "Proof of income", answer: "On hand" },
    ],
    docFlags: [],
    history: [
      { label: "Submitted for review", when: "Oct 13", by: "Applicant" },
      { label: "Submitted to county", when: "Oct 14", by: "Navigator R. Okafor" },
    ],
  },
  // ── Enrolled ───────────────────────────────────────────────────────────────
  {
    id: "demo-pkt-001-maria", caseId: "CF-2026-0179", name: "Maria G.", county: "Alameda",
    phase: "enrolled", stage: "Approved", risk: "Low risk", updated: "6d ago", completedSteps: 8,
    engineInputs: { household_size: "3", monthly_income: "2840", monthly_rent: "1850", monthly_utilities: "210", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "3 people" },
      { section: "Your household", question: "Children under 14?", answer: "Yes (ages 6, 9)" },
      { section: "Income", question: "Gross monthly income", answer: "$2,840" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,850" },
      { section: "Documents", question: "Proof of income", answer: "On hand" },
    ],
    docFlags: [],
    history: [
      { label: "Submitted to county", when: "Sep 28", by: "Navigator R. Okafor" },
      { label: "Interview completed", when: "Oct 4", by: "County" },
      { label: "Approved — enrolled", when: "Oct 8", by: "County" },
    ],
  },
  {
    id: "demo-pkt-theresa", caseId: "CF-2026-0162", name: "Theresa B.", county: "San Jose",
    phase: "enrolled", stage: "Approved", risk: "Low risk", updated: "2w ago", completedSteps: 8,
    engineInputs: { household_size: "2", monthly_income: "1500", monthly_rent: "1600", monthly_utilities: "180", employment_status: "employed", has_disability: "true" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "2 people" },
      { section: "Your household", question: "Anyone 60+ or disabled?", answer: "Yes" },
      { section: "Income", question: "Gross monthly income", answer: "$1,500" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,600" },
    ],
    docFlags: [],
    history: [
      { label: "Submitted to county", when: "Sep 15", by: "Navigator L. Park" },
      { label: "Approved — enrolled", when: "Sep 26", by: "County" },
    ],
  },
  // ── Recertification ──────────────────────────────────────────────────────
  {
    id: "demo-pkt-patricia", caseId: "CF-2026-0098", name: "Patricia W.", county: "Los Angeles",
    phase: "recert", stage: "Recert overdue · 3 days", risk: "High risk", updated: "today", completedSteps: 8,
    engineInputs: { household_size: "4", monthly_income: "3200", monthly_rent: "1950", monthly_utilities: "220", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "4 people" },
      { section: "Income", question: "Gross monthly income", answer: "$3,200" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,950" },
      { section: "Recertification", question: "Cert end date", answer: "Oct 10 — overdue", flagged: true },
    ],
    docFlags: ["Recertification overdue — file before benefits lapse"],
    history: [
      { label: "Enrolled", when: "Apr 2026", by: "County" },
      { label: "Recert notice sent", when: "Sep 20", by: "Civica engine" },
      { label: "Recert overdue", when: "Oct 10", by: "Civica engine" },
    ],
  },
  {
    id: "demo-pkt-mei", caseId: "CF-2026-0104", name: "Mei L.", county: "San Jose",
    phase: "recert", stage: "Recert due · 8 days", risk: "Medium risk", updated: "2d ago", completedSteps: 8,
    engineInputs: { household_size: "3", monthly_income: "2600", monthly_rent: "1700", monthly_utilities: "190", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "3 people" },
      { section: "Income", question: "Gross monthly income", answer: "$2,600" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,700" },
      { section: "Recertification", question: "Cert end date", answer: "Oct 22" },
    ],
    docFlags: [],
    history: [
      { label: "Enrolled", when: "Apr 2026", by: "County" },
      { label: "Recert notice sent", when: "Oct 8", by: "Civica engine" },
    ],
  },
];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Run each synthetic applicant through the REAL engine, grouped by lifecycle
 * phase. When `synthetic` is false, every phase is empty (no fabricated records
 * surfaced) — the trigger for a clean real-data state.
 */
export function buildPipeline(state: "CA" | "MA" = "CA", asOf: Date, synthetic = true): PhaseGroup[] {
  if (!synthetic) return PHASES.map((p) => ({ ...p, cases: [] }));
  const enriched: QueueApplication[] = APPLICANTS.map((a) => {
    let estimatedBenefitUsd: number | null = null;
    let verificationNeeds: string[] = [];
    let assumptions: string[] = [];
    try {
      const est = estimatePacketBenefit(a.engineInputs, state, asOf);
      estimatedBenefitUsd = est.estimatedMonthlyBenefitUsd;
      verificationNeeds = est.confirmForVerdict;
      assumptions = est.assumptions;
    } catch {
      estimatedBenefitUsd = null;
    }
    return {
      id: a.id, caseId: a.caseId, name: a.name, county: a.county, phase: a.phase, stage: a.stage,
      risk: a.risk, updated: a.updated, completedSteps: a.completedSteps,
      answers: a.answers, docFlags: a.docFlags, history: a.history,
      estimatedBenefitUsd, verificationNeeds, assumptions,
    };
  });
  return PHASES.map((p) => ({ ...p, cases: enriched.filter((c) => c.phase === p.key) }));
}

export { usd as formatUsd, TOTAL_STEPS };
