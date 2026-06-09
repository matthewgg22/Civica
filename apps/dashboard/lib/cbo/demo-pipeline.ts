// Lifecycle pipeline for /cbo-preview, de-faked (#real-engine).
//
// Households move through four phases:
//   Requesting assistance → Live application → Enrolled → Recertification
// The applicant ANSWERS are synthetic (public page, no PII), but the benefit
// estimate + verification checklist are computed live by @civica/snap-rules via
// the same facts-adapter a real packet uses. Synthetic input, REAL engine
// output. The phase + stage + history are the navigator-workflow overlay.

import { assessPacket, type PacketAnswers } from "../engines/facts-adapter";
import { computeBenefit, type BenefitCalcDetail } from "@civica/snap-rules";
import type { EngineRecommendation } from "./engine-view";

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
  { key: "live", label: "Live application", blurb: "In review with the state agency", accent: "bg-warning" },
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
  navigator: string;
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
  navigator: string;
  answers: SurveyAnswer[];
  docFlags: string[];
  history: TimelineEvent[];
  estimatedBenefitUsd: number | null;
  verificationNeeds: string[];
  assumptions: string[];
  /** Benefit math detail for the "show the math" trace (null if not computable). */
  deduction: BenefitCalcDetail | null;
  /** Component R ranked "good next" actions. */
  recommendations: EngineRecommendation[];
  /** Expedited-service screen per 7 CFR 273.2(i) — provisional (resources not
   *  yet verified). reason is "" when not flagged. */
  expedited: boolean;
  expeditedReason: string;
  /** Regulatory timeliness clocks (7 CFR 273.2). */
  interview: { status: InterviewStatus; date: string | null };
  /** Day in the application processing clock; limit 30 (or 7 if expedited),
   *  §273.2. null when not yet submitted or already decided. */
  processingDay: number | null;
  processingLimit: number;
  /** Days left for the client to cure a verification pend, §273.2(h) (~10 days).
   *  null when nothing is pending. */
  cureDaysLeft: number | null;
  /** CBO caseworker who owns the case (navigator/assignment surface). */
  assignment: CaseAssignment;
  /** The applicant's personal helper (buddy system). */
  buddy: BuddyLink;
  /** Approved-answers → BenefitsCal autofill state (extension bridge). */
  portal: PortalAutofill;
}

export type InterviewStatus = "none" | "scheduled" | "missed" | "completed";

// ── Phase-1 demo view-models (synthetic). The Phase-2 real adapter will populate
// these SAME shapes from the enrollment-api + Supabase. See
// docs/plans/cbo-buddy-portal-integration.md.

/** CBO caseworker assignment — "who at the CBO owns this case." */
export interface CaseAssignment {
  caseworker: string;
  status: "unassigned" | "assigned" | "reviewing" | "approved";
  assignedAt: string | null;
}

/** The applicant's personal helper (buddy system) — distinct from the caseworker. */
export interface BuddyLink {
  helperName: string;
  relationship: "family" | "friend" | "navigator";
  status: "active" | "pending" | "completed" | "none";
  lastActive: string;
}

/** One approved answer mapped to the BenefitsCal field it autofills. */
export interface PortalFieldMapRow {
  answer: string; // human label, e.g. "Household size"
  value: string; // the approved value, e.g. "3 people"
  benefitsCalField: string; // portal field it fills, e.g. "Number in home"
}

/**
 * Approved-answers → BenefitsCal autofill. The CBO officer (already logged into
 * BenefitsCal) clicks Next/Accept; the extension bridge fills the highlighted
 * fields. Gated on applicantApproved && cboApproved && consent.
 */
export interface PortalAutofill {
  applicantApproved: boolean;
  cboApproved: boolean;
  consent: "in_person" | "telephonic" | "async_portal" | null;
  fieldMap: PortalFieldMapRow[];
  docCount: number;
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
    phase: "requesting", stage: "Screener complete", risk: "Low risk", updated: "3h ago", completedSteps: 2, navigator: "Unassigned",
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
    phase: "requesting", stage: "Application drafted", risk: "Medium risk", updated: "1d ago", completedSteps: 3, navigator: "J. Ruiz",
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
    phase: "live", stage: "Documents requested", risk: "Medium risk", updated: "1d ago", completedSteps: 4, navigator: "J. Ruiz",
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
    phase: "live", stage: "Needs clarification", risk: "High risk", updated: "2d ago", completedSteps: 2, navigator: "A. Cole",
    engineInputs: { household_size: "1", monthly_income: "1640", monthly_rent: "2400", monthly_utilities: "0", employment_status: "employed", has_disability: "false" },
    answers: [
      { section: "Where you're applying", question: "State", answer: "California" },
      { section: "Your household", question: "Household size", answer: "1 person" },
      { section: "Documents", question: "Social Security Number", answer: "Provided — does not match SSA records", flagged: true },
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
    phase: "live", stage: "Interview scheduled", risk: "Medium risk", updated: "5h ago", completedSteps: 6, navigator: "M. Diaz",
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
    phase: "live", stage: "Submitted to county", risk: "Low risk", updated: "1d ago", completedSteps: 8, navigator: "R. Okafor",
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
    phase: "enrolled", stage: "Approved", risk: "Low risk", updated: "6d ago", completedSteps: 8, navigator: "R. Okafor",
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
    phase: "enrolled", stage: "Approved", risk: "Low risk", updated: "2w ago", completedSteps: 8, navigator: "L. Park",
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
    phase: "recert", stage: "Recert overdue · 3 days", risk: "High risk", updated: "today", completedSteps: 8, navigator: "R. Okafor",
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
    phase: "recert", stage: "Recert due · 8 days", risk: "Medium risk", updated: "2d ago", completedSteps: 8, navigator: "L. Park",
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

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Per-case regulatory clocks (demo). interview status, day in the §273.2
// processing clock (null = not submitted / decided), and §273.2(h) cure days
// left on a verification pend. Elena is expedited → her 7-day clock is overdue
// (day 9); Sofia is near the 30-day wire (day 28); two interviews are MISSED.
const TIMELINE: Record<
  string,
  { interview: InterviewStatus; interviewDate: string | null; processingDay: number | null; cureDaysLeft: number | null }
> = {
  "demo-pkt-aisha": { interview: "none", interviewDate: null, processingDay: null, cureDaysLeft: null },
  "demo-pkt-daniel": { interview: "none", interviewDate: null, processingDay: null, cureDaysLeft: null },
  "demo-pkt-003-jasmine": { interview: "scheduled", interviewDate: "Oct 16", processingDay: 18, cureDaysLeft: 4 },
  "demo-pkt-elena": { interview: "missed", interviewDate: "Oct 14", processingDay: 9, cureDaysLeft: 1 },
  "demo-pkt-002-carlos": { interview: "scheduled", interviewDate: "Oct 14", processingDay: 12, cureDaysLeft: 6 },
  "demo-pkt-sofia": { interview: "scheduled", interviewDate: "Oct 18", processingDay: 28, cureDaysLeft: null },
  "demo-pkt-001-maria": { interview: "completed", interviewDate: "Oct 4", processingDay: null, cureDaysLeft: null },
  "demo-pkt-theresa": { interview: "completed", interviewDate: "Sep 22", processingDay: null, cureDaysLeft: null },
  "demo-pkt-patricia": { interview: "missed", interviewDate: "Oct 9", processingDay: null, cureDaysLeft: null },
  "demo-pkt-mei": { interview: "scheduled", interviewDate: "Oct 20", processingDay: null, cureDaysLeft: null },
};

// Expedited-service screen, 7 CFR 273.2(i)(1). Provisional: liquid resources
// aren't precisely captured, so we screen on the income-vs-shelter criterion
// (and the <$150 gross floor). A "true" here means "screen for expedited", not a
// final determination.
function expeditedScreen(e: PacketAnswers): { expedited: boolean; reason: string } {
  const income = Number(e.monthly_income ?? 0);
  const shelter = Number(e.monthly_rent ?? 0) + Number(e.monthly_utilities ?? 0);
  if (income < 150) return { expedited: true, reason: "Gross monthly income under $150" };
  if (shelter > income) return { expedited: true, reason: "Shelter cost exceeds income + liquid resources" };
  return { expedited: false, reason: "" };
}

// Fixed section order so the full application reads top-to-bottom like the real
// intake wizard, regardless of the order answers were authored/merged in.
const SECTION_ORDER = [
  "Where you're applying",
  "About you",
  "Your household",
  "Residence",
  "Income & employment",
  "Student & work requirements",
  "Expenses & deductions",
  "Resources",
  "Special situations",
  "Documents",
  "Certification",
  "Recertification",
] as const;

const moneyOrNone = (v?: string | null) =>
  v && v !== "0"
    ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "Not reported";

// Normalize any "$1,234" lacking cents → "$1,234.00" (leaves values that already
// carry decimals, and any non-$ text, untouched). Applied to every rendered
// answer so hand-authored + derived dollar figures read consistently with cents.
const normalizeMoney = (s: string) =>
  // Lookahead rejects a following digit, dot, OR comma so we only append cents
  // to a COMPLETE figure — without it, "$2,750.00" matched just "$2" and became
  // "$2.00,750.00".
  s.replace(/\$(\d{1,3}(?:,\d{3})*|\d+)(?![\d.,])/g, (_m, num) => `$${num}.00`);

// Synthetic street address for the demo. These applicants are fabricated (no real
// PII), so the address is generated — deterministically per case id, so it's
// stable across reloads — and placed in a plausible city/ZIP for the case county.
const COUNTY_CITY: Record<string, { city: string; zip: string }> = {
  "San Francisco": { city: "San Francisco", zip: "94110" },
  "Los Angeles": { city: "Los Angeles", zip: "90011" },
  "San Diego": { city: "San Diego", zip: "92101" },
  Fresno: { city: "Fresno", zip: "93706" },
  Sacramento: { city: "Sacramento", zip: "95814" },
  Alameda: { city: "Oakland", zip: "94601" },
  "San Jose": { city: "San Jose", zip: "95112" },
};
const STREETS = [
  "Mission St", "Market St", "Cesar Chavez Ave", "Foothill Blvd", "Olive St",
  "Maple Ave", "Bryant St", "Capp St", "E 14th St", "Florence Ave", "Alum Rock Ave", "Geary Blvd",
];
function synthAddress(id: string, county: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const num = 100 + (h % 4800);
  const street = STREETS[h % STREETS.length];
  const apt = h % 3 === 0 ? `, Apt ${1 + (h % 24)}` : "";
  const loc = COUNTY_CITY[county] ?? { city: county, zip: "" };
  return `${num} ${street}${apt}, ${loc.city}, CA ${loc.zip}`.trim();
}

/**
 * Expand a case's sparse hand-authored `answers` into a COMPLETE CalFresh
 * application (the eight intake sections), derived from the same `engineInputs`
 * the rules engine consumes — so the displayed application stays consistent with
 * the benefit math. Hand-authored answers override the derived base by question
 * (preserving navigator flags + case-specific copy); any extra hand-authored
 * questions are folded into their section. Result is sorted by SECTION_ORDER.
 */
function expandAnswers(a: DemoApplicant): SurveyAnswer[] {
  const e = a.engineInputs;
  const size = Number(e.household_size ?? "1");
  const selfEmployed = e.employment_status === "self_employed";
  const employment = selfEmployed
    ? "Self-employed"
    : e.employment_status === "employed"
      ? "Employed"
      : "Not employed";
  const elderlyOrDisabled = e.has_disability === "true";
  const hasChildren = size >= 3; // mirrors the "Children under 14?" heuristic below
  const receivesSsi = e.receives_ssi === "true";

  // Work / ABAWD derivation (7 CFR 273.7 / CA §63-24). A dependent in the home or
  // a 60+/disabled member exempts; an employed adult with hours meets the rule;
  // an unemployed able-bodied adult without dependents is on the time-limit clock.
  const weeklyHours = selfEmployed
    ? "Varies (self-employed)"
    : employment === "Employed"
      ? "~30 hrs/week"
      : "0 — not currently working";
  const abawdStatus =
    elderlyOrDisabled || hasChildren
      ? "Exempt — dependent in home or 60+/disabled member"
      : employment === "Not employed"
        ? "Subject to ABAWD time limit · 7 CFR 273.24"
        : "Meets work requirement (≥20 hrs/week)";
  const unearned = receivesSsi ? "SSI" : "None reported";
  // Whether the household reports a utility cost — drives the SUA-tier detail
  // questions (heating/cooling, electric/gas) below.
  const paysUtilities = e.monthly_utilities != null && e.monthly_utilities !== "" && e.monthly_utilities !== "0";

  const base: SurveyAnswer[] = [
    { section: "Where you're applying", question: "State", answer: "California" },
    { section: "Where you're applying", question: "County", answer: `${a.county} County` },
    { section: "Where you're applying", question: "Programs applying for", answer: "CalFresh (SNAP)" },
    { section: "Where you're applying", question: "Received CalFresh before?", answer: "No" },
    { section: "About you", question: "Applicant", answer: a.name },
    { section: "About you", question: "Date of birth", answer: "On file" },
    { section: "About you", question: "Preferred language", answer: "English" },
    { section: "About you", question: "Contact phone on file", answer: "Yes" },
    { section: "About you", question: "Citizenship / immigration status", answer: "U.S. citizen" },
    { section: "About you", question: "Authorized representative", answer: "VoteNow Advocacy Foundation — CBO of record" },
    { section: "Your household", question: "Household size", answer: `${size} ${size === 1 ? "person" : "people"}` },
    { section: "Your household", question: "Children under 14?", answer: hasChildren ? "Yes" : "No" },
    { section: "Your household", question: "Anyone 60+ or disabled?", answer: elderlyOrDisabled ? "Yes" : "No" },
    { section: "Your household", question: "Anyone pregnant?", answer: "No" },
    { section: "Your household", question: "Everyone applying is a citizen or eligible noncitizen?", answer: "Yes" },
    { section: "Residence", question: "Home address", answer: synthAddress(a.id, a.county) },
    { section: "Residence", question: "Housing situation", answer: "Renting" },
    { section: "Income & employment", question: "Employment status", answer: employment },
    { section: "Income & employment", question: "Income type", answer: selfEmployed ? "Self-employment" : "Wages / salary" },
    { section: "Income & employment", question: "Gross monthly income", answer: moneyOrNone(e.monthly_income) },
    { section: "Income & employment", question: "Pay frequency", answer: "Twice monthly" },
    { section: "Income & employment", question: "Other income (SSI, unemployment, child support received)", answer: unearned },
    { section: "Student & work requirements", question: "Enrolled in higher education (half-time or more)?", answer: "No" },
    { section: "Student & work requirements", question: "Weekly work hours", answer: weeklyHours },
    { section: "Student & work requirements", question: "Work registration / ABAWD", answer: abawdStatus },
    { section: "Expenses & deductions", question: "Monthly rent", answer: moneyOrNone(e.monthly_rent) },
    { section: "Expenses & deductions", question: "Monthly utilities", answer: moneyOrNone(e.monthly_utilities) },
    { section: "Expenses & deductions", question: "Pays heating / cooling costs?", answer: paysUtilities ? "Yes" : "No" },
    { section: "Expenses & deductions", question: "Pays electricity or gas (separate from heating)?", answer: paysUtilities ? "Yes" : "No" },
    { section: "Expenses & deductions", question: "Pays for phone or internet?", answer: "Yes" },
    { section: "Expenses & deductions", question: "Receives HEAP energy assistance?", answer: "No" },
    { section: "Expenses & deductions", question: "Dependent-care costs", answer: "$0.00" },
    { section: "Expenses & deductions", question: "Out-of-pocket medical (60+/disabled)", answer: elderlyOrDisabled ? "$0.00" : "Not applicable" },
    { section: "Expenses & deductions", question: "Child support paid", answer: "$0.00" },
    { section: "Resources", question: "Countable assets (cash + bank)", answer: "Under $2,750.00" },
    { section: "Special situations", question: "Reduced hours or quit a job in the last 60 days?", answer: "No" },
    { section: "Special situations", question: "Fleeing felon or probation / parole violation?", answer: "No" },
    { section: "Special situations", question: "Drug-felony conviction?", answer: "No" },
    { section: "Documents", question: "Photo ID", answer: "On hand" },
    { section: "Documents", question: "Proof of income", answer: "On hand" },
    { section: "Documents", question: "Proof of residence", answer: "On hand" },
    { section: "Documents", question: "Social Security Number", answer: "Provided" },
    { section: "Certification", question: "Expedited-service screen", answer: "Completed" },
    { section: "Certification", question: "Signed under penalty of perjury", answer: "Yes" },
  ];

  // Overlay hand-authored answers by question (keep base section + question,
  // take the authored answer + flag). Track which questions were consumed.
  const authored = new Map(a.answers.map((x) => [x.question, x]));
  const merged: SurveyAnswer[] = base.map((b) => {
    const o = authored.get(b.question);
    if (!o) return b;
    authored.delete(b.question);
    return { section: b.section, question: b.question, answer: o.answer, flagged: o.flagged };
  });
  // Any remaining authored answers are case-specific extras (e.g. recert dates,
  // self-employment ledger) — append; the sort below files them in section.
  for (const o of authored.values()) merged.push(o);

  const rank = (s: string) => {
    const i = SECTION_ORDER.indexOf(s as (typeof SECTION_ORDER)[number]);
    return i === -1 ? SECTION_ORDER.length : i;
  };
  return merged
    .map((x, i) => [x, i] as const)
    .sort(([x, i], [y, j]) => rank(x.section) - rank(y.section) || i - j)
    .map(([x]) => ({ ...x, answer: normalizeMoney(x.answer) }));
}

// ── Phase-1 demo derivations ──────────────────────────────────────────────
// Derived from phase/navigator/answers so the three new cards stay consistent
// with the rest of the synthetic case without hand-editing every fixture.

function deriveAssignment(a: DemoApplicant): CaseAssignment {
  if (a.navigator === "Unassigned") {
    return { caseworker: "Unassigned", status: "unassigned", assignedAt: null };
  }
  const status: CaseAssignment["status"] =
    a.phase === "requesting" ? "assigned" : a.phase === "live" ? "reviewing" : "approved";
  return { caseworker: a.navigator, status, assignedAt: a.history[0]?.when ?? null };
}

const BUDDY_ROSTER: { helperName: string; relationship: BuddyLink["relationship"] }[] = [
  { helperName: "Rosa", relationship: "family" },
  { helperName: "James", relationship: "friend" },
  { helperName: "Lupe", relationship: "family" },
  { helperName: "Marcus", relationship: "friend" },
];

function deriveBuddy(a: DemoApplicant, idx: number): BuddyLink {
  const status: BuddyLink["status"] =
    a.phase === "requesting"
      ? a.navigator === "Unassigned"
        ? "none"
        : "pending"
      : a.phase === "enrolled"
        ? "completed"
        : "active"; // live, recert
  if (status === "none") {
    return { helperName: "", relationship: "family", status: "none", lastActive: "" };
  }
  const pick = BUDDY_ROSTER[idx % BUDDY_ROSTER.length];
  return { ...pick, status, lastActive: a.updated };
}

// Approved Civica answer → the BenefitsCal questionnaire field it autofills.
const PORTAL_FIELD_MAP: { key: keyof PacketAnswers; answer: string; field: string }[] = [
  { key: "household_size", answer: "Household size", field: "Number in home" },
  { key: "monthly_income", answer: "Gross monthly income", field: "Earned income (monthly)" },
  { key: "monthly_rent", answer: "Monthly rent", field: "Shelter cost" },
  { key: "monthly_utilities", answer: "Monthly utilities", field: "Utility cost" },
];

function derivePortal(a: DemoApplicant, answers: SurveyAnswer[]): PortalAutofill {
  const e = a.engineInputs;
  const size = Number(e.household_size ?? "1");
  const rows: PortalFieldMapRow[] = [
    { answer: "County", value: `${a.county} County`, benefitsCalField: "County" },
  ];
  for (const m of PORTAL_FIELD_MAP) {
    const raw = e[m.key];
    if (raw == null || raw === "" || (m.key === "monthly_utilities" && raw === "0")) continue;
    const value =
      m.key === "household_size"
        ? `${size} ${size === 1 ? "person" : "people"}`
        : `$${Number(raw).toLocaleString("en-US")}/mo`;
    rows.push({ answer: m.answer, value, benefitsCalField: m.field });
  }
  const docCount = answers.filter(
    (x) => x.section === "Documents" && /on hand|provided/i.test(x.answer),
  ).length;
  // Approval ramps with the lifecycle: requesting = nothing approved yet (locked);
  // live = applicant approved, CBO still reviewing (partial); enrolled/recert =
  // both approved + consent recorded → the hero "autofilled" state.
  const applicantApproved = a.phase !== "requesting";
  const cboApproved = a.phase === "enrolled" || a.phase === "recert";
  const consent: PortalAutofill["consent"] = cboApproved ? "telephonic" : null;
  return { applicantApproved, cboApproved, consent, fieldMap: rows, docCount };
}

/**
 * Run each synthetic applicant through the REAL engine, grouped by lifecycle
 * phase. When `synthetic` is false, every phase is empty (no fabricated records
 * surfaced) — the trigger for a clean real-data state.
 */
export function buildPipeline(state: "CA" | "MA" = "CA", asOf: Date, synthetic = true): PhaseGroup[] {
  if (!synthetic) return PHASES.map((p) => ({ ...p, cases: [] }));
  const enriched: QueueApplication[] = APPLICANTS.map((a, idx) => {
    const answers = expandAnswers(a);
    let estimatedBenefitUsd: number | null = null;
    let verificationNeeds: string[] = [];
    let assumptions: string[] = [];
    let deduction: BenefitCalcDetail | null = null;
    let recommendations: EngineRecommendation[] = [];
    try {
      // assessPacket = the benefit estimate + Component R recommendations from
      // the same mapped Facts. computeBenefit gives the deduction trace.
      const assessed = assessPacket(a.engineInputs, state, asOf);
      estimatedBenefitUsd = assessed.estimatedMonthlyBenefitUsd;
      verificationNeeds = assessed.confirmForVerdict;
      assumptions = assessed.assumptions;
      recommendations = assessed.recommendations.map((r) => ({
        rank: r.rank,
        action: r.action,
        deltaUsd: r.delta_monthly_usd,
        citation: r.citable_to?.[0] ?? null,
      }));
      deduction = computeBenefit(assessed.facts, state, asOf);
    } catch {
      estimatedBenefitUsd = null;
    }
    return {
      id: a.id, caseId: a.caseId, name: a.name, county: a.county, phase: a.phase, stage: a.stage,
      risk: a.risk, updated: a.updated, completedSteps: a.completedSteps, navigator: a.navigator,
      answers, docFlags: a.docFlags, history: a.history,
      assignment: deriveAssignment(a), buddy: deriveBuddy(a, idx), portal: derivePortal(a, answers),
      estimatedBenefitUsd, verificationNeeds, assumptions, deduction, recommendations,
      ...(() => {
        const x = expeditedScreen(a.engineInputs);
        const t = TIMELINE[a.id] ?? { interview: "none" as InterviewStatus, interviewDate: null, processingDay: null, cureDaysLeft: null };
        return {
          expedited: x.expedited,
          expeditedReason: x.reason,
          interview: { status: t.interview, date: t.interviewDate },
          processingDay: t.processingDay,
          processingLimit: x.expedited ? 7 : 30,
          cureDaysLeft: t.cureDaysLeft,
        };
      })(),
    };
  });
  return PHASES.map((p) => ({ ...p, cases: enriched.filter((c) => c.phase === p.key) }));
}

export { usd as formatUsd, TOTAL_STEPS };
