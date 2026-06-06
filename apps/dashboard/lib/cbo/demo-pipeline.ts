// Demo navigator pipeline for /cbo-preview, de-faked (#real-engine).
//
// The applicant ANSWERS are synthetic (public page, no PII), but they are the
// real engine INPUT keys, and the determination + verification checklist are
// computed live by @civica/snap-rules via the same facts-adapter a real packet
// uses. So: synthetic input, REAL engine output. The workflow position
// (pipeline step, status, history) is a navigator-workflow overlay, not engine
// output, and is labeled as such.

import { estimatePacketBenefit, type PacketAnswers } from "../engines/facts-adapter";

// The navigator workflow stages (NOT engine gates — this is the CBO's process).
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

export type Risk = "Low risk" | "Medium risk" | "High risk";

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

// One synthetic applicant. `engineInputs` are the flat packet_answers keys the
// real adapter consumes; `answers` is the human-readable survey view.
interface DemoApplicant {
  id: string;
  caseId: string;
  name: string;
  county: string;
  status: string;
  risk: Risk;
  updated: string;
  bucketKey: string;
  completedSteps: number;
  engineInputs: PacketAnswers;
  answers: SurveyAnswer[];
  /** Workflow / document flags (navigator process, not engine output). */
  docFlags: string[];
  history: TimelineEvent[];
}

// What the queue renders per application — display + REAL engine output.
export interface QueueApplication {
  id: string;
  caseId: string;
  name: string;
  county: string;
  status: string;
  risk: Risk;
  updated: string;
  completedSteps: number;
  answers: SurveyAnswer[];
  docFlags: string[];
  history: TimelineEvent[];
  /** REAL: estimated monthly benefit from computeBenefit (null if engine threw). */
  estimatedBenefitUsd: number | null;
  /** REAL: fields the engine needs a navigator to confirm before the verdict is final. */
  verificationNeeds: string[];
  /** REAL: assumptions the engine baked in to run the math. */
  assumptions: string[];
}

export interface QueueBucket {
  key: string;
  label: string;
  accent: string;
  applications: QueueApplication[];
  completedCount?: number;
}

const BUCKETS: { key: string; label: string; accent: string }[] = [
  { key: "needs-attention", label: "Needs Attention", accent: "bg-warning" },
  { key: "in-progress", label: "In Progress", accent: "bg-indigo" },
  { key: "ready", label: "Ready for Handoff", accent: "bg-teal" },
];

const APPLICANTS: DemoApplicant[] = [
  {
    id: "demo-pkt-003-jasmine", caseId: "CF-2026-0188", name: "Jasmine T.", county: "Los Angeles",
    status: "Needs Documents", risk: "Medium risk", updated: "1d ago", bucketKey: "needs-attention", completedSteps: 4,
    engineInputs: { household_size: "4", monthly_income: "3100", monthly_rent: "2050", monthly_utilities: "240", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Where you're applying", question: "Housing situation", answer: "Stable home" },
      { section: "Your household", question: "Household size", answer: "4 people" },
      { section: "Your household", question: "Anyone 18 or under?", answer: "Yes" },
      { section: "Your household", question: "Children under 14?", answer: "Yes" },
      { section: "Your household", question: "Anyone 60+ or disabled?", answer: "No" },
      { section: "Income", question: "Anyone earning income?", answer: "Yes" },
      { section: "Income", question: "Gross monthly income", answer: "$3,100" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$2,050" },
      { section: "Monthly expenses", question: "Utilities paid separately", answer: "Heat, Electricity, Phone" },
      { section: "Monthly expenses", question: "Monthly utilities", answer: "$240" },
      { section: "Monthly expenses", question: "Monthly childcare", answer: "$620" },
      { section: "Documents", question: "Photo ID", answer: "On hand" },
      { section: "Documents", question: "Proof of income", answer: "Not provided", flagged: true },
    ],
    docFlags: ["Income verification documents missing", "Most recent pay stub is older than 30 days"],
    history: [
      { label: "Application started", when: "Oct 8", by: "Applicant" },
      { label: "Submitted for review", when: "Oct 11", by: "Applicant" },
      { label: "Picked up for review", when: "Oct 12", by: "Navigator J. Ruiz" },
      { label: "Documents requested", when: "Oct 13", by: "Navigator J. Ruiz" },
    ],
  },
  {
    id: "demo-pkt-elena", caseId: "CF-2026-0184", name: "Elena V.", county: "San Francisco",
    status: "Needs Applicant Clarification", risk: "High risk", updated: "2d ago", bucketKey: "needs-attention", completedSteps: 2,
    engineInputs: { household_size: "1", monthly_income: "1640", monthly_rent: "2400", monthly_utilities: "0", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Where you're applying", question: "Housing situation", answer: "Stable home" },
      { section: "Your household", question: "Household size", answer: "1 person" },
      { section: "Your household", question: "Anyone 60+ or disabled?", answer: "No" },
      { section: "Your household", question: "Has a Social Security Number?", answer: "Yes — does not match SSA records", flagged: true },
      { section: "Income", question: "Anyone earning income?", answer: "Yes" },
      { section: "Income", question: "Gross monthly income", answer: "$1,640" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$2,400 — exceeds area norm", flagged: true },
    ],
    docFlags: ["SSN does not match SSA records", "Reported rent exceeds area norm — verify shelter cost"],
    history: [
      { label: "Application started", when: "Oct 9", by: "Applicant" },
      { label: "Submitted for review", when: "Oct 12", by: "Applicant" },
      { label: "Clarification requested", when: "Oct 13", by: "Navigator A. Cole" },
    ],
  },
  {
    id: "demo-pkt-002-carlos", caseId: "CF-2026-0203", name: "Carlos R.", county: "Fresno",
    status: "In Navigator Review", risk: "Medium risk", updated: "5h ago", bucketKey: "in-progress", completedSteps: 6,
    engineInputs: { household_size: "2", monthly_income: "1980", monthly_rent: "1320", monthly_utilities: "160", employment_status: "self_employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Where you're applying", question: "Housing situation", answer: "Stable home" },
      { section: "Your household", question: "Household size", answer: "2 people" },
      { section: "Your household", question: "Anyone 60+ or disabled?", answer: "No" },
      { section: "Income", question: "Anyone earning income?", answer: "Yes" },
      { section: "Income", question: "Income type", answer: "Self-employment", flagged: true },
      { section: "Income", question: "Gross monthly income", answer: "$1,980" },
      { section: "Income", question: "Income varies month to month?", answer: "Yes" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,320" },
      { section: "Monthly expenses", question: "Utilities paid separately", answer: "Heat, Electricity" },
      { section: "Monthly expenses", question: "Monthly utilities", answer: "$160" },
      { section: "Documents", question: "Photo ID", answer: "On hand" },
      { section: "Documents", question: "Self-employment ledger", answer: "On hand" },
    ],
    docFlags: ["Self-employment income — manual review recommended"],
    history: [
      { label: "Application started", when: "Oct 11", by: "Applicant" },
      { label: "Submitted for review", when: "Oct 12", by: "Applicant" },
      { label: "Picked up for review", when: "Oct 13", by: "Navigator M. Diaz" },
    ],
  },
  {
    id: "demo-pkt-sofia", caseId: "CF-2026-0201", name: "Sofia M.", county: "Sacramento",
    status: "Submitted for Review", risk: "Low risk", updated: "1d ago", bucketKey: "in-progress", completedSteps: 7,
    engineInputs: { household_size: "2", monthly_income: "1980", monthly_rent: "1320", monthly_utilities: "150", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Where you're applying", question: "Housing situation", answer: "Stable home" },
      { section: "Your household", question: "Household size", answer: "2 people" },
      { section: "Your household", question: "Anyone 60+ or disabled?", answer: "No" },
      { section: "Income", question: "Anyone earning income?", answer: "Yes" },
      { section: "Income", question: "Gross monthly income", answer: "$1,980" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,320" },
      { section: "Monthly expenses", question: "Utilities paid separately", answer: "Heat, Electricity" },
      { section: "Documents", question: "Photo ID", answer: "On hand" },
      { section: "Documents", question: "Proof of income", answer: "On hand" },
      { section: "Documents", question: "Lease", answer: "On hand" },
    ],
    docFlags: [],
    history: [
      { label: "Application started", when: "Oct 12", by: "Applicant" },
      { label: "Submitted for review", when: "Oct 13", by: "Applicant" },
    ],
  },
  {
    id: "demo-pkt-marcus", caseId: "CF-2026-0195", name: "Marcus W.", county: "Oakland",
    status: "In Navigator Review", risk: "Medium risk", updated: "3d ago", bucketKey: "in-progress", completedSteps: 6,
    engineInputs: { household_size: "1", monthly_income: "1200", monthly_rent: "1100", monthly_utilities: "0", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Where you're applying", question: "Housing situation", answer: "Stable home" },
      { section: "Your household", question: "Household size", answer: "1 person" },
      { section: "Your household", question: "Anyone 60+ or disabled?", answer: "No" },
      { section: "Income", question: "Anyone earning income?", answer: "Yes (part-time)" },
      { section: "Income", question: "Gross monthly income", answer: "$1,200" },
      { section: "Student status", question: "Enrolled in higher education?", answer: "Yes" },
      { section: "Student status", question: "Enrolled at least half-time?", answer: "Yes" },
      { section: "Student status", question: "Works 20+ hours/week?", answer: "No" },
      { section: "Student status", question: "In federal/state work-study?", answer: "Yes — verify enrollment", flagged: true },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,100" },
      { section: "Monthly expenses", question: "Utilities paid separately", answer: "Electricity" },
      { section: "Documents", question: "Photo ID", answer: "On hand" },
      { section: "Documents", question: "Student enrollment letter", answer: "Requested" },
    ],
    docFlags: ["Student exemption applied — verify school enrollment"],
    history: [
      { label: "Application started", when: "Oct 9", by: "Applicant" },
      { label: "Submitted for review", when: "Oct 10", by: "Applicant" },
      { label: "Picked up for review", when: "Oct 10", by: "Navigator L. Park" },
      { label: "Student exemption flagged", when: "Oct 11", by: "Navigator L. Park" },
    ],
  },
  {
    id: "demo-pkt-001-maria", caseId: "CF-2026-0179", name: "Maria G.", county: "Alameda",
    status: "Ready for Handoff", risk: "Low risk", updated: "1d ago", bucketKey: "ready", completedSteps: 8,
    engineInputs: { household_size: "3", monthly_income: "2840", monthly_rent: "1850", monthly_utilities: "210", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Where you're applying", question: "Housing situation", answer: "Stable home" },
      { section: "Your household", question: "Household size", answer: "3 people" },
      { section: "Your household", question: "Anyone 18 or under?", answer: "Yes" },
      { section: "Your household", question: "Children under 14?", answer: "Yes (ages 6, 9)" },
      { section: "Your household", question: "Anyone 60+ or disabled?", answer: "No" },
      { section: "Income", question: "Anyone earning income?", answer: "Yes" },
      { section: "Income", question: "Gross monthly income", answer: "$2,840" },
      { section: "Monthly expenses", question: "Monthly rent", answer: "$1,850" },
      { section: "Monthly expenses", question: "Utilities paid separately", answer: "Heat, Electricity, Phone" },
      { section: "Monthly expenses", question: "Monthly utilities", answer: "$210" },
      { section: "Monthly expenses", question: "Monthly childcare", answer: "$480" },
      { section: "Documents", question: "Photo ID", answer: "On hand" },
      { section: "Documents", question: "Proof of income", answer: "On hand" },
      { section: "Documents", question: "Lease", answer: "On hand" },
      { section: "Documents", question: "Utility bill", answer: "On hand" },
    ],
    docFlags: [],
    history: [
      { label: "Application started", when: "Oct 7", by: "Applicant" },
      { label: "Submitted for review", when: "Oct 10", by: "Applicant" },
      { label: "Picked up for review", when: "Oct 11", by: "Navigator R. Okafor" },
      { label: "Income verified (Argyle)", when: "Oct 13", by: "Civica engine" },
      { label: "Ready for county handoff", when: "Oct 13", by: "Navigator R. Okafor" },
    ],
  },
];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Build the queue buckets, running each synthetic applicant's answers through
 * the REAL engine (estimatePacketBenefit → computeBenefit + confirmForVerdict).
 * Guarded per applicant so one bad estimate can't sink the public page.
 */
export function buildQueueBuckets(state: "CA" | "MA" = "CA", asOf: Date): QueueBucket[] {
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
      id: a.id, caseId: a.caseId, name: a.name, county: a.county, status: a.status,
      risk: a.risk, updated: a.updated, completedSteps: a.completedSteps,
      answers: a.answers, docFlags: a.docFlags, history: a.history,
      estimatedBenefitUsd, verificationNeeds, assumptions,
    };
  });

  const buckets: QueueBucket[] = BUCKETS.map((b) => ({
    ...b,
    applications: enriched.filter((a) => APPLICANTS.find((x) => x.id === a.id)?.bucketKey === b.key),
  }));
  buckets.push({ key: "complete", label: "Complete", accent: "bg-pine", applications: [], completedCount: 36 });
  return buckets;
}

export { usd as formatUsd };
