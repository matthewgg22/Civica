import { describe, it, expect } from "vitest";
import {
  buildCohortReadout,
  interviewCompletionRate,
  attributionSplit,
  onboardingDepthScore,
  cohortSkew,
  LA_MISSED_INTERVIEW_BASELINE,
  type MissAttribution,
} from "../../src/scoring/cohort-readout";

// The load-bearing property of this module is that it REFUSES to let a caller
// claim a lift the sample size cannot support. These tests pin that behaviour
// (docs/plans/supervised-test-kpi-spec.md §0).

describe("cohort readout — the n=30 honesty guard", () => {
  it("derives the LA baseline at ~11%", () => {
    expect(LA_MISSED_INTERVIEW_BASELINE).toBeCloseTo(0.1096, 4);
  });

  it("REFUSES to claim a lift even at a perfect 30/30 — the CI still overlaps baseline", () => {
    const r = interviewCompletionRate(30, 30);
    expect(r.interval.rate).toBe(1);
    expect(r.missInterval.rate).toBe(0);
    // Wilson upper bound on 0/30 is ~11.4%, which does NOT clear the ~11.0%
    // baseline. This is the single most important assertion in the file.
    expect(r.missInterval.upper).toBeGreaterThan(LA_MISSED_INTERVIEW_BASELINE);
    expect(r.canClaimLift).toBe(false);
  });

  it("still refuses at 29/30 and 28/30", () => {
    expect(interviewCompletionRate(29, 30).canClaimLift).toBe(false);
    expect(interviewCompletionRate(28, 30).canClaimLift).toBe(false);
  });

  it("DOES allow the claim once n is powered (0 misses at n=100 clears the baseline)", () => {
    const r = interviewCompletionRate(100, 100);
    expect(r.missInterval.upper).toBeLessThan(LA_MISSED_INTERVIEW_BASELINE);
    expect(r.canClaimLift).toBe(true);
  });

  it("treats an empty study as unclaimable rather than perfect", () => {
    const r = interviewCompletionRate(0, 0);
    expect(r.canClaimLift).toBe(false);
    expect(r.missInterval.upper).toBe(1); // maximal uncertainty, not 0
  });

  it("counts a completed reschedule as a success (the recovery loop must not be hidden)", () => {
    // 20 first-attempt + 5 recovered = 25 of 30. The caller sums both event
    // types into `completed`; this pins the arithmetic contract.
    const r = interviewCompletionRate(25, 30);
    expect(r.interval.rate).toBeCloseTo(25 / 30, 6);
  });
});

describe("attribution split — the primary analytic output", () => {
  it("separates agency-side from applicant-side and reports the agency share", () => {
    const a: MissAttribution[] = [
      "agency_never_called",
      "agency_no_notice",
      "agency_wrong_number",
      "applicant_no_answer",
      "unknown",
    ];
    const s = attributionSplit(a);
    expect(s.agencySide).toBe(3);
    expect(s.applicantSide).toBe(1);
    expect(s.unknown).toBe(1);
    expect(s.total).toBe(5);
    // unknown is excluded from the denominator — 3 of 4 attributed
    expect(s.agencyShare).toBeCloseTo(0.75, 6);
  });

  it("returns a null share (not 0) when nothing is attributed", () => {
    const s = attributionSplit(["unknown", "unknown"]);
    expect(s.agencyShare).toBeNull();
  });

  it("handles an empty set", () => {
    expect(attributionSplit([]).total).toBe(0);
    expect(attributionSplit([]).agencyShare).toBeNull();
  });
});

describe("onboarding depth + skew", () => {
  it("scores depth additively", () => {
    expect(
      onboardingDepthScore({ sessions: 2, sectionsCompleted: 6, maeQuestions: 3, docsUploaded: 4 }),
    ).toBe(15);
  });

  it("quantifies selection skew against the LA caseload", () => {
    // A cohort that is all young English speakers — the expected skew shape.
    const s = cohortSkew([
      { ageBand: "25-39", primaryLanguage: "en" },
      { ageBand: "40-59", primaryLanguage: "en" },
      { ageBand: "25-39", primaryLanguage: "en" },
      { ageBand: "18-24", primaryLanguage: "en" },
    ]);
    expect(s.share60plus).toBe(0);
    expect(s.shareNonEnglish).toBe(0);
    // LA is 25.1% 60+ and 29.5% non-English, so both deltas are strongly negative.
    expect(s.delta60plusPp).toBeCloseTo(-25.1, 1);
    expect(s.deltaNonEnglishPp).toBeCloseTo(-29.5, 1);
  });

  it("returns nulls for an empty roster rather than dividing by zero", () => {
    const s = cohortSkew([]);
    expect(s.share60plus).toBeNull();
    expect(s.delta60plusPp).toBeNull();
  });
});

describe("buildCohortReadout", () => {
  const participants = Array.from({ length: 30 }, () => ({
    ageBand: "25-39",
    primaryLanguage: "en",
  }));

  it("labels a strong n=30 result DIRECTIONAL ONLY", () => {
    const r = buildCohortReadout({
      studyName: "supervised-cohort-1",
      counts: {
        reachedInterviewStage: 30,
        completedInterview: 29,
        missedInterview: 1,
        hadHumanIntervention: 4,
        withdrew: 0,
      },
      missAttributions: ["agency_never_called"],
      participants,
    });
    expect(r.icr.canClaimLift).toBe(false);
    expect(r.interpretation).toContain("DIRECTIONAL ONLY");
    expect(r.interpretation).toContain("attribution split");
    expect(r.n).toBe(30);
  });

  it("reports the unaided cut separately when supplied", () => {
    const r = buildCohortReadout({
      studyName: "supervised-cohort-1",
      counts: {
        reachedInterviewStage: 30,
        completedInterview: 28,
        missedInterview: 2,
        hadHumanIntervention: 6,
        withdrew: 1,
        // Excluding the 6 the operator unblocked: 22 of 24 completed.
        completedInterviewUnaided: 22,
        reachedInterviewStageUnaided: 24,
      },
      missAttributions: ["agency_no_notice", "applicant_no_answer"],
      participants,
    });
    expect(r.icrUnaided).not.toBeNull();
    expect(r.icrUnaided?.interval.rate).toBeCloseTo(22 / 24, 6);
    // The headline rate is higher than the unaided rate — exactly why they must
    // be reported separately (an operator rescue is not the product working).
    expect(r.icr.interval.rate).toBeGreaterThan(r.icrUnaided!.interval.rate);
  });

  it("omits the unaided cut when the counts are absent", () => {
    const r = buildCohortReadout({
      studyName: "s",
      counts: {
        reachedInterviewStage: 10,
        completedInterview: 9,
        missedInterview: 1,
        hadHumanIntervention: 0,
        withdrew: 0,
      },
      missAttributions: ["unknown"],
      participants: [],
    });
    expect(r.icrUnaided).toBeNull();
  });
});
