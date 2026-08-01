// Interview preparation — timeline, readiness, and document staging (#587).
//
// The applicant-side half of the interview wedge. Its companion is the
// notice-validity checker (#586), which handles the agency-side failures this
// cannot prevent.
//
// Grounded in the CDSS Management Evaluation corpus (38 county reports,
// FFY2024-25) and LA County's denial data. Two findings shape the design:
//
//  1. The interview is usually an INBOUND call the household must be ready to
//     answer — often from an unknown or blocked number, and for expedited-service
//     households frequently a same-day cold call with only ~2 attempts. Counties
//     were repeatedly cited for calling a number not in the file (San Joaquin
//     D#1) or mailing the appointment letter the same day as the appointment
//     (Sacramento D#3/A#29). So readiness is mostly about the phone, not nerves.
//
//  2. Over-staging documents is its own harm. The #1 documented county error is
//     over-verification — demanding proof that is not required and not
//     questionable (37 of 38 reports). A prep tool that tells the household to
//     bring everything just moves that burden onto them. So the checklist
//     separates REQUIRED from CONDITIONAL from DO-NOT-VOLUNTEER, and says which
//     items a county may not demand.

export type MilestoneStatus = "done" | "today" | "upcoming" | "overdue" | "unknown";

export interface TimelineMilestone {
  key:
    | "application_filed"
    | "expedited_deadline"
    | "interview_scheduled"
    | "verification_due"
    | "decision_deadline";
  label: string;
  /** ISO date, when it can be computed. */
  date?: string;
  status: MilestoneStatus;
  /** Why this date exists, in plain language. */
  note: string;
  /** The rule that sets it. */
  authority?: string;
}

export interface InterviewFacts {
  /** ISO date the application was filed. */
  applicationDate: string;
  /** Today, injected so the function stays pure and testable. */
  today: string;
  /** ISO date/time of the scheduled interview, if known. */
  interviewDate?: string;
  /** ISO date verifications are due, if a CW 2200 was issued. */
  verificationDueDate?: string;
  /** TRUE when the household screens as expedited-service eligible. */
  expeditedEntitled?: boolean;
  /** TRUE once the interview has been completed. */
  interviewCompleted?: boolean;
}

const DAY_MS = 86_400_000;
const addDays = (iso: string, n: number): string =>
  new Date(Date.parse(iso) + n * DAY_MS).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string): number =>
  Math.floor((Date.parse(b) - Date.parse(a)) / DAY_MS);

function statusFor(date: string, today: string, done: boolean): MilestoneStatus {
  if (done) return "done";
  const d = dayDiff(today, date);
  if (d === 0) return "today";
  return d > 0 ? "upcoming" : "overdue";
}

/**
 * The household's personal legal timeline.
 *
 * Every date here is derived from the application date, so the household can
 * see the county's own deadlines rather than guessing. The decision deadline is
 * the load-bearing one: a denial for a missed interview may not issue before
 * day 30, and counties have been documented denying earlier (Butte D#3,
 * Humboldt D#2, Santa Barbara D#2/D#8).
 */
export function buildInterviewTimeline(facts: InterviewFacts): TimelineMilestone[] {
  const { applicationDate: app, today } = facts;
  const milestones: TimelineMilestone[] = [];

  milestones.push({
    key: "application_filed",
    label: "Application filed",
    date: app,
    status: "done",
    note: "Your benefits, if approved, are counted from this date — not from the day the county decides.",
    authority: "7 CFR 273.10(a)",
  });

  if (facts.expeditedEntitled) {
    const due = addDays(app, 3);
    milestones.push({
      key: "expedited_deadline",
      label: "Expedited service deadline (3 days)",
      date: due,
      status: statusFor(due, today, Boolean(facts.interviewCompleted)),
      note: "You screened as eligible for expedited service, so the county must interview you and issue benefits within 3 calendar days. Expect a call quickly — possibly the same day.",
      authority: "7 CFR 273.2(i); ACL 16-14",
    });
  }

  if (facts.interviewDate) {
    milestones.push({
      key: "interview_scheduled",
      label: "Interview",
      date: facts.interviewDate.slice(0, 10),
      status: statusFor(
        facts.interviewDate.slice(0, 10),
        today,
        Boolean(facts.interviewCompleted),
      ),
      note: "The county usually CALLS YOU at the scheduled time. The number may show as unknown or blocked — answer it.",
      authority: "7 CFR 273.2(e)",
    });
  }

  if (facts.verificationDueDate) {
    milestones.push({
      key: "verification_due",
      label: "Documents due",
      date: facts.verificationDueDate,
      status: statusFor(facts.verificationDueDate, today, false),
      note: "You must be given at least 10 days to provide anything the county requests.",
      authority: "7 CFR 273.2(f)(5)",
    });
  }

  const decisionDue = addDays(app, 30);
  milestones.push({
    key: "decision_deadline",
    label: "County decision deadline (day 30)",
    date: decisionDue,
    status: statusFor(decisionDue, today, false),
    note: "The county must decide within 30 days. It also may NOT deny you for a missed interview before this day — until then you can still reschedule.",
    authority: "7 CFR 273.2(g); MPP 63-301.32",
  });

  return milestones;
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export interface ReadinessItem {
  key: string;
  title: string;
  detail: string;
  /** TRUE when the household still needs to act on this. */
  outstanding: boolean;
  /** Rule the household can cite if the county gets it wrong. */
  authority?: string;
}

export interface ReadinessInput {
  /** Has the phone number on file been confirmed as current? */
  phoneConfirmed?: boolean;
  /** Can the phone receive voicemail (not full, set up)? */
  voicemailReady?: boolean;
  /** Interview method the household wants. */
  methodRequested?: "phone" | "in_person";
  /** Method the county scheduled, once known. */
  methodScheduled?: "phone" | "in_person";
  /** Has the household viewed the mock interview? */
  prepViewed?: boolean;
  expeditedEntitled?: boolean;
}

/**
 * The prep actions that actually move interview completion.
 *
 * Ordered by what the ME corpus says causes misses: a wrong or unreachable
 * phone number is the single most preventable applicant-side failure, because
 * the county calls the number in the file and documents the attempt as made.
 */
export function readinessChecklist(input: ReadinessInput): ReadinessItem[] {
  const items: ReadinessItem[] = [];

  items.push({
    key: "confirm_phone",
    title: "Confirm the phone number the county has for you",
    detail:
      "The county calls the number in your file and records the attempt as made. If it is wrong or out of date, the interview counts as missed even though you never got the call.",
    outstanding: input.phoneConfirmed !== true,
    authority: "ACL 14-20",
  });

  items.push({
    key: "voicemail_ready",
    title: "Make sure your voicemail works and is not full",
    detail:
      "Counties may leave the appointment details or a callback number by voicemail. A full mailbox loses it.",
    outstanding: input.voicemailReady !== true,
  });

  items.push({
    key: "expect_inbound_call",
    title: "Expect an incoming call — possibly from an unknown or blocked number",
    detail: input.expeditedEntitled
      ? "Because you qualify for expedited service, the call may come the SAME DAY you apply, and the county may only try about twice. Keep your phone with you."
      : "The interview is usually the county calling you at the scheduled time. Answer unknown numbers that day.",
    outstanding: true,
  });

  if (input.methodRequested) {
    const mismatch =
      input.methodScheduled != null && input.methodScheduled !== input.methodRequested;
    items.push({
      key: "assert_method",
      title: mismatch
        ? "The county scheduled a different interview type than you asked for"
        : `You asked for a ${input.methodRequested.replace("_", "-")} interview`,
      detail: mismatch
        ? "Your stated preference must be provided, or the file must document why it could not be. Ask the county to reschedule in the format you requested."
        : "If the county schedules a different format, you can ask them to change it — your preference must be honored or documented.",
      outstanding: mismatch,
      authority: "7 CFR 273.2(e); MPP 63-300.42–.44; ACL 17-80",
    });
  }

  items.push({
    key: "review_questions",
    title: "Review what the interview covers",
    detail:
      "The worker will confirm your identity, then go through income, who lives and eats with you, rent and utilities, and any child care or medical costs.",
    outstanding: input.prepViewed !== true,
  });

  return items;
}

// ---------------------------------------------------------------------------
// What the interview actually covers
// ---------------------------------------------------------------------------

export interface ProbeDomain {
  key: string;
  label: string;
  /** What the worker is trying to establish. */
  purpose: string;
  /** A question the household should be ready for, in the worker's framing. */
  sampleQuestion: string;
}

/**
 * The domains counties are cited for FAILING to explore — i.e. the ones that
 * decide the outcome. The shelter probe is verbatim-shaped from the ME reports,
 * which repeatedly fault workers for not asking how a household meets expenses
 * that exceed its income (SF D#6, Sierra R#13/R#14, Stanislaus A#26).
 */
export const INTERVIEW_PROBE_DOMAINS: ProbeDomain[] = [
  {
    key: "identity",
    label: "Identity check",
    purpose: "Confirm who they are speaking to before discussing the case.",
    sampleQuestion: "Can you confirm two pieces of identifying information for me?",
  },
  {
    key: "income",
    label: "Income in the last 30 days",
    purpose: "Establish countable income from the 30 days before you applied.",
    sampleQuestion: "What did you earn in the 30 days before you applied, and do you expect that to continue?",
  },
  {
    key: "household",
    label: "Who lives and eats with you",
    purpose: "Determine household composition — who buys and prepares food together.",
    sampleQuestion: "Who lives with you, and do you buy and prepare food together?",
  },
  {
    key: "shelter",
    label: "Rent and utilities",
    purpose: "Capture the shelter deduction, the single largest source of payment error.",
    sampleQuestion:
      "How do you meet your rent and utilities with the income you reported?",
  },
  {
    key: "dependent_care",
    label: "Child or dependent care costs",
    purpose: "Capture the dependent-care deduction.",
    sampleQuestion: "Do you pay anyone to care for a child or dependent so you can work or attend school?",
  },
  {
    key: "medical",
    label: "Medical costs (60+ or disabled)",
    purpose: "Capture the medical deduction, which is frequently missed.",
    sampleQuestion: "Does anyone 60 or older, or with a disability, have out-of-pocket medical costs?",
  },
  {
    key: "student",
    label: "Student status and exemptions",
    purpose:
      "Students are often wrongly denied — the worker must explore every exemption, not just enrollment.",
    sampleQuestion: "Is anyone enrolled in college at least half-time, and are they working or in a work-study?",
  },
  {
    key: "expedited",
    label: "Expedited screening",
    purpose: "Determine whether benefits are owed within 3 days.",
    sampleQuestion: "How much money do you have available right now, and what is your rent?",
  },
];

// ---------------------------------------------------------------------------
// Document staging
// ---------------------------------------------------------------------------

export type DocRequirement =
  /** The county may require this; have it ready. */
  | "required"
  /** Only needed if the household's situation includes it. */
  | "conditional"
  /** The county generally may NOT demand this. Do not volunteer it. */
  | "not_required";

export interface StagedDocument {
  key: string;
  label: string;
  requirement: DocRequirement;
  reason: string;
  /** Present on `not_required` items — the rule that says they can't demand it. */
  pushback?: string;
}

export interface HouseholdProfile {
  hasEarnedIncome?: boolean;
  isSelfEmployed?: boolean;
  paysRent?: boolean;
  paysUtilities?: boolean;
  hasDependentCare?: boolean;
  hasElderlyOrDisabled?: boolean;
  hasStudent?: boolean;
  isNonCitizen?: boolean;
}

/**
 * Document checklist keyed to the household's actual situation.
 *
 * Deliberately includes `not_required` entries. The most common documented
 * county error is demanding proof that is not required and not questionable —
 * immunization records, marriage certificates, vehicle registration, bank
 * statements for a categorically-eligible household (Santa Barbara A#23/A#29,
 * Yolo D#3/R#15, Glenn R#11, Yuba A#20). Telling the household which requests
 * they can push back on is the applicant-side complement to Mae's
 * anti-over-verification guardrail — and prevents this tool from simply moving
 * the over-verification burden onto the applicant.
 */
export function buildDocumentChecklist(profile: HouseholdProfile): StagedDocument[] {
  const docs: StagedDocument[] = [
    {
      key: "identity",
      label: "Photo ID for the person applying",
      requirement: "required",
      reason: "Identity must be verified for the applicant.",
    },
  ];

  if (profile.hasEarnedIncome) {
    docs.push({
      key: "pay_stubs",
      label: "Pay stubs from the last 30 days",
      requirement: "required",
      reason:
        "Income is a mandatory verification — but only the 30 days before you applied, not months of history.",
    });
  }
  if (profile.isSelfEmployed) {
    docs.push({
      key: "self_employment",
      label: "Record of self-employment income and expenses",
      requirement: "required",
      reason: "Business income must be verified; a written record you keep yourself can be acceptable.",
    });
  }
  if (profile.paysRent) {
    docs.push({
      key: "rent",
      label: "Proof of rent or mortgage",
      requirement: "conditional",
      reason:
        "Needed to claim the shelter deduction, which usually increases your benefit. Only required if questionable.",
    });
  }
  if (profile.paysUtilities) {
    docs.push({
      key: "utilities",
      label: "A utility bill",
      requirement: "conditional",
      reason: "Supports the utility allowance. Often a standard allowance applies without a bill.",
    });
  }
  if (profile.hasDependentCare) {
    docs.push({
      key: "dependent_care",
      label: "Proof of child or dependent care costs",
      requirement: "conditional",
      reason: "Supports the dependent-care deduction, which increases your benefit.",
    });
  }
  if (profile.hasElderlyOrDisabled) {
    docs.push({
      key: "medical",
      label: "Medical expense receipts",
      requirement: "conditional",
      reason:
        "Only for households with someone 60+ or disabled. Worth providing — it can raise your benefit.",
    });
  }
  if (profile.hasStudent) {
    docs.push({
      key: "student_exemption",
      label: "Proof of work hours, work-study, or another student exemption",
      requirement: "conditional",
      reason:
        "Students are frequently denied without their exemption being explored. Bring what shows you qualify.",
    });
  }
  if (profile.isNonCitizen) {
    docs.push({
      key: "immigration_status",
      label: "Immigration document for anyone applying for benefits",
      requirement: "conditional",
      reason:
        "Only needed for household members who are applying. Members who are not applying do not have to provide status.",
    });
  }

  // The push-back list. These recur across the ME corpus as items counties
  // demanded and should not have.
  docs.push(
    {
      key: "immunization",
      label: "Immunization records",
      requirement: "not_required",
      reason: "Not a CalFresh requirement.",
      pushback: "Immunization records are not required for CalFresh (MPP 63-300; ACIN I-45-11).",
    },
    {
      key: "marriage_certificate",
      label: "Marriage certificate",
      requirement: "not_required",
      reason: "Not a CalFresh requirement.",
      pushback: "Marital status does not require documentary proof for CalFresh (MPP 63-300).",
    },
    {
      key: "vehicle_registration",
      label: "Vehicle registration",
      requirement: "not_required",
      reason: "Vehicles are generally excluded in California.",
      pushback: "California excludes vehicles from the resource test (ACIN I-45-11).",
    },
    {
      key: "bank_statements",
      label: "Bank statements",
      requirement: "not_required",
      reason:
        "Most California households are categorically eligible, which removes the resource test.",
      pushback:
        "Bank balances are not required for a categorically eligible household (ACL 20-48; ACIN I-45-11).",
    },
  );

  return docs;
}

/** Convenience: only what the household should actually gather. */
export function documentsToGather(profile: HouseholdProfile): StagedDocument[] {
  return buildDocumentChecklist(profile).filter((d) => d.requirement !== "not_required");
}

/** Convenience: what the county may not demand, for push-back. */
export function documentsNotRequired(profile: HouseholdProfile): StagedDocument[] {
  return buildDocumentChecklist(profile).filter((d) => d.requirement === "not_required");
}
