// Supervised-cohort readout (#588).
//
// Turns the raw counts in snap_enrollment.v_cohort_interview_counts (plus the
// event stream) into the study readout defined by
// docs/plans/supervised-test-kpi-spec.md.
//
// THE CENTRAL CONSTRAINT, ENCODED HERE ON PURPOSE:
// at n≈30 this study cannot prove an interview-completion lift. Against LA
// County's ~11% missed-interview baseline, even 0 misses out of 30 gives a
// Wilson 95% CI of [0%, 11.4%] — which still overlaps the baseline. A powered
// test needs n≈135–320 (two-arm) or n≈68 one-sample for a large effect.
//
// So `canClaimLift` is computed, not asserted by the caller: it is true ONLY
// when the Wilson upper bound falls strictly below the baseline. Every consumer
// (dashboard, deck, application answer) should branch on it rather than
// eyeballing the point estimate. Reporting a bare rate from n≈30 is the exact
// failure mode this project already retired once ("60% less").
//
// The view supplies counts; the formula lives here — same split as
// v_qc_error_rate_by_slice / wilsonInterval.

import { wilsonInterval, type WilsonInterval } from "./wilson";

/**
 * Documented event vocabulary. The DB column is deliberately open (new kinds
 * must not need a migration), so this is the contract, not a constraint.
 */
export const COHORT_EVENT_TYPES = [
  // Onboarding / engagement — the independent variable
  "session_start",
  "session_end",
  "section_completed",
  "mae_question_asked",
  "mae_answer_rated",
  "doc_uploaded",
  "error_flag_raised",
  "application_submitted",
  // Interview lifecycle — the dependent variable
  "interview_scheduled",
  "interview_prep_viewed",
  "phone_verified",
  "interview_attempted",
  "interview_completed",
  "interview_missed",
  "nomi_received",
  "recovery_initiated",
  "interview_completed_after_reschedule",
  // Disposition
  "decision_received",
] as const;
export type CohortEventType = (typeof COHORT_EVENT_TYPES)[number];

/** Agency-vs-applicant attribution for a missed interview. */
export const MISS_ATTRIBUTIONS = [
  "applicant_no_answer",
  "applicant_unaware",
  "applicant_unavailable",
  "agency_never_called",
  "agency_wrong_number",
  "agency_no_notice",
  "agency_method_refused",
  "agency_language",
  "unknown",
] as const;
export type MissAttribution = (typeof MISS_ATTRIBUTIONS)[number];

const isAgencySide = (a: MissAttribution): boolean => a.startsWith("agency_");
const isApplicantSide = (a: MissAttribution): boolean => a.startsWith("applicant_");

/**
 * LA County reference rate for missed-interview denials: 7,235 denials per month
 * against 66,031 applications received (DPSS CPRA production, 2026-07-30;
 * CY2023–Aug 2024 denial-reason tables + At-A-Glance).
 *
 * CAVEAT — this is NOT a matched control and must never be presented as one:
 *   (a) its numerator counts missed-interview denials for NEW APPLICATIONS AND
 *       RECERTIFICATIONS combined ("CF Missed Interview (New Application/
 *       Recertification)"), while our denominator is applicants reaching an
 *       interview;
 *   (b) its denominator is applications RECEIVED, not applications that reached
 *       the interview stage — some are denied on other grounds first.
 * Treat it as an order-of-magnitude reference for the honest-baseline test only.
 */
export const LA_MISSED_INTERVIEW_BASELINE = 7235 / 66031; // ≈ 0.1096

/** LA caseload composition, for disclosing cohort selection skew (spec §5.1). */
export const LA_CASELOAD_REFERENCE = {
  share60plus: 0.251,
  shareNonEnglish: 0.295,
  shareSpanish: 0.197,
} as const;

export interface CohortCounts {
  reachedInterviewStage: number;
  completedInterview: number;
  missedInterview: number;
  hadHumanIntervention: number;
  withdrew: number;
  /** Completions among participants who never needed an operator to unblock them. */
  completedInterviewUnaided?: number;
  /** Denominator for the unaided cut. */
  reachedInterviewStageUnaided?: number;
}

export interface InterviewCompletionRate {
  /** Wilson interval on the completion proportion. */
  interval: WilsonInterval;
  /**
   * TRUE only when the missed-interview upper bound is strictly below the
   * baseline — i.e. the data actually excludes the reference rate. At n≈30 this
   * is expected to be FALSE even for a perfect result; that is the honest
   * answer, not a bug.
   */
  canClaimLift: boolean;
  /** The reference rate compared against, echoed so a report can cite it. */
  baselineMissRate: number;
  /** Wilson interval on the MISS proportion (the side compared to baseline). */
  missInterval: WilsonInterval;
}

/**
 * Interview Completion Rate with its interval.
 *
 * Denominator is participants who REACHED the interview stage (not everyone who
 * applied) — applications denied on other grounds never had an interview to
 * miss. A reschedule that completes counts as a SUCCESS: recovering a missed
 * interview inside the cure window is the product working, and counting only
 * first-attempt completion would hide exactly the effect we are testing.
 */
export function interviewCompletionRate(
  completed: number,
  reachedStage: number,
  baselineMissRate: number = LA_MISSED_INTERVIEW_BASELINE,
  z = 1.96,
): InterviewCompletionRate {
  const interval = wilsonInterval(completed, reachedStage, z);
  const missed = reachedStage - completed;
  const missInterval = wilsonInterval(missed, reachedStage, z);
  return {
    interval,
    missInterval,
    baselineMissRate,
    // Strict: the whole interval must clear the baseline. n=0 yields [0,1] and
    // correctly fails this test.
    canClaimLift: reachedStage > 0 && missInterval.upper < baselineMissRate,
  };
}

export interface AttributionSplit {
  agencySide: number;
  applicantSide: number;
  unknown: number;
  total: number;
  /** Share of ATTRIBUTED misses that were agency-caused; null when none attributed. */
  agencyShare: number | null;
}

/**
 * Split missed interviews into agency- vs applicant-caused.
 *
 * This is the study's primary analytic output. The CDSS Management Evaluation
 * corpus (38 county reports) says agency-side dominates — county never called,
 * NOMI after a completed interview, no NOMI at all, denial before day 30. If
 * that reproduces here, prep alone is insufficient and the advocacy/recovery
 * loop is the core product.
 */
export function attributionSplit(attributions: MissAttribution[]): AttributionSplit {
  let agencySide = 0;
  let applicantSide = 0;
  let unknown = 0;
  for (const a of attributions) {
    if (isAgencySide(a)) agencySide += 1;
    else if (isApplicantSide(a)) applicantSide += 1;
    else unknown += 1;
  }
  const attributed = agencySide + applicantSide;
  return {
    agencySide,
    applicantSide,
    unknown,
    total: attributions.length,
    agencyShare: attributed > 0 ? agencySide / attributed : null,
  };
}

export interface OnboardingDepth {
  participantRef: string;
  sessions: number;
  sectionsCompleted: number;
  maeQuestions: number;
  docsUploaded: number;
  /** Composite depth score — the predictor in the mechanism correlation. */
  score: number;
  completedInterview: boolean;
}

/**
 * Composite onboarding-depth score.
 *
 * Deliberately a simple additive index, not a fitted model: at n≈30 any weights
 * we learned would be overfit. It exists to rank participants for the
 * depth→completion correlation (spec §1), which is the one inferential claim
 * this sample size can directionally support.
 */
export function onboardingDepthScore(input: {
  sessions: number;
  sectionsCompleted: number;
  maeQuestions: number;
  docsUploaded: number;
}): number {
  return (
    input.sessions + input.sectionsCompleted + input.maeQuestions + input.docsUploaded
  );
}

export interface CohortSkew {
  share60plus: number | null;
  shareNonEnglish: number | null;
  /** Difference vs the LA caseload, in percentage points. Positive = over-represented. */
  delta60plusPp: number | null;
  deltaNonEnglishPp: number | null;
}

/**
 * Selection-skew disclosure. Participants are people the founder knows — more
 * motivated, likelier higher-literacy, socially accountable to the researcher.
 * Results WILL overstate. This does not correct for that (n is far too small);
 * it quantifies it so every report can disclose it (spec §5.1).
 */
export function cohortSkew(participants: {
  ageBand?: string | null;
  primaryLanguage?: string | null;
}[]): CohortSkew {
  const n = participants.length;
  if (n === 0) {
    return { share60plus: null, shareNonEnglish: null, delta60plusPp: null, deltaNonEnglishPp: null };
  }
  const n60 = participants.filter((p) => p.ageBand === "60-64" || p.ageBand === "65plus").length;
  const nNonEng = participants.filter(
    (p) => p.primaryLanguage != null && p.primaryLanguage !== "en",
  ).length;
  const share60plus = n60 / n;
  const shareNonEnglish = nNonEng / n;
  return {
    share60plus,
    shareNonEnglish,
    delta60plusPp: (share60plus - LA_CASELOAD_REFERENCE.share60plus) * 100,
    deltaNonEnglishPp: (shareNonEnglish - LA_CASELOAD_REFERENCE.shareNonEnglish) * 100,
  };
}

export interface CohortReadout {
  studyName: string;
  n: number;
  counts: CohortCounts;
  /** Headline rate, all participants. */
  icr: InterviewCompletionRate;
  /** Same, excluding anyone an operator unblocked. Null when not supplied. */
  icrUnaided: InterviewCompletionRate | null;
  attribution: AttributionSplit;
  skew: CohortSkew;
  /**
   * Human-readable guard rail. Always populated; a report SHOULD print this
   * next to any rate so the sample-size limit travels with the number.
   */
  interpretation: string;
}

export function buildCohortReadout(input: {
  studyName: string;
  counts: CohortCounts;
  missAttributions: MissAttribution[];
  participants: { ageBand?: string | null; primaryLanguage?: string | null }[];
  baselineMissRate?: number;
}): CohortReadout {
  const baseline = input.baselineMissRate ?? LA_MISSED_INTERVIEW_BASELINE;
  const icr = interviewCompletionRate(
    input.counts.completedInterview,
    input.counts.reachedInterviewStage,
    baseline,
  );

  const hasUnaided =
    input.counts.completedInterviewUnaided != null &&
    input.counts.reachedInterviewStageUnaided != null;
  const icrUnaided = hasUnaided
    ? interviewCompletionRate(
        input.counts.completedInterviewUnaided as number,
        input.counts.reachedInterviewStageUnaided as number,
        baseline,
      )
    : null;

  const attribution = attributionSplit(input.missAttributions);

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const interpretation = icr.canClaimLift
    ? `Missed-interview rate ${pct(icr.missInterval.rate)} (95% CI ${pct(icr.missInterval.lower)}–${pct(icr.missInterval.upper)}) excludes the ~${pct(baseline)} reference. Note the reference is NOT a matched control.`
    : `DIRECTIONAL ONLY — n=${input.counts.reachedInterviewStage} cannot exclude the ~${pct(baseline)} reference rate (missed-interview 95% CI ${pct(icr.missInterval.lower)}–${pct(icr.missInterval.upper)}). Report the mechanism and the attribution split, not a lift.`;

  return {
    studyName: input.studyName,
    n: input.participants.length,
    counts: input.counts,
    icr,
    icrUnaided,
    attribution,
    skew: cohortSkew(input.participants),
    interpretation,
  };
}
