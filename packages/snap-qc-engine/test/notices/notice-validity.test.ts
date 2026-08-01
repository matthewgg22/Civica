import { describe, it, expect } from "vitest";
import {
  reviewNotice,
  recoveryWindow,
  type CaseFacts,
  type NoticeFacts,
  type DefectCode,
} from "../../src/notices/notice-validity";

// Every scenario below is a REAL case from the CDSS Management Evaluation
// reports (FOIA production R012681, FFY2024-25, 38 county reports). Using the
// government's own documented failures as fixtures means the checker is tested
// against what actually happens, not what we imagined might.

const codes = (r: ReturnType<typeof reviewNotice>): DefectCode[] =>
  r.defects.map((d) => d.code);

describe("NOMI defects", () => {
  it("Fresno FFY2025 Denial #2 — NOMI sent after the household completed its interview", () => {
    // "This case was in error because the Notice of Missed Interview (NOMI) was
    // sent to the household after they completed their scheduled interview."
    const notice: NoticeFacts = { kind: "nomi", sentDate: "2024-06-14" };
    const facts: CaseFacts = {
      applicationDate: "2024-06-01",
      interviewCompletedDate: "2024-06-12",
    };
    const r = reviewNotice(notice, facts);
    expect(codes(r)).toContain("nomi_after_completed_interview");
    expect(r.likelyInvalid).toBe(true);
    expect(r.defects[0].authority).toContain("FNS Handbook 310 §1320");
  });

  it("San Benito FFY2025 Denial #1 — NOMI sent when no contact was ever attempted", () => {
    // "contact was not attempted with the household for the scheduled interview,
    // which resulted in the NOMI inappropriately sent."
    const r = reviewNotice(
      { kind: "nomi", sentDate: "2024-05-20" },
      { applicationDate: "2024-05-05", contactAttemptDocumented: false },
    );
    expect(codes(r)).toContain("no_documented_contact_attempt");
    expect(r.likelyInvalid).toBe(true);
  });

  it("Sacramento FFY2024 Denial #2 — NOMI and denial issued the same day", () => {
    // "the NOMI was not sent ... and the denial NOA was incorrectly sent on the
    // same day."
    const r = reviewNotice(
      {
        kind: "denial_noa",
        sentDate: "2024-03-31",
        statedReasons: ["Failed to complete the application process"],
      },
      {
        applicationDate: "2024-03-01",
        nomiSentDate: "2024-03-31",
      },
    );
    expect(codes(r)).toContain("nomi_and_denial_same_day");
    expect(r.likelyInvalid).toBe(true);
  });

  it("San Francisco FFY2024 Denial #7 — negative action with no NOMI at all", () => {
    // "the NOMI was not sent and the determination was made without an interview."
    const r = reviewNotice(
      {
        kind: "denial_noa",
        sentDate: "2024-04-05",
        statedReasons: ["Missed interview"],
      },
      { applicationDate: "2024-03-01", nomiSent: false },
    );
    expect(codes(r)).toContain("nomi_missing_before_negative_action");
  });

  it("Ventura FFY2024 Denial #7 — compliance date printed past day 30", () => {
    // "the NOMI was sent 30 days from the date of application when the interview
    // was missed 3 days from the date of application."
    const r = reviewNotice(
      { kind: "nomi", sentDate: "2024-02-01", complianceDate: "2024-03-15" },
      { applicationDate: "2024-02-01" },
    );
    expect(codes(r)).toContain("compliance_date_after_day_30");
  });
});

describe("the day-30 floor", () => {
  it("Butte FFY2025 Denial #3 — denied before day 30", () => {
    // "the application was denied prior to the 30th day."
    const r = reviewNotice(
      {
        kind: "denial_noa",
        sentDate: "2024-07-18",
        statedReasons: ["Failed to complete the application process"],
      },
      { applicationDate: "2024-07-01" },
    );
    expect(codes(r)).toContain("denial_before_day_30");
    expect(r.likelyInvalid).toBe(true);
    // The remedy must steer AWAY from reapplying — counties have been documented
    // telling in-window households to reapply, which resets the benefit date.
    const d = r.defects.find((x) => x.code === "denial_before_day_30");
    expect(d?.remedy).toMatch(/do NOT file a new application/i);
  });

  it("Santa Barbara FFY2025 Approval #25 — 124 days to decide", () => {
    // "the application was approved 124 days from the date of application."
    const r = reviewNotice(
      { kind: "denial_noa", sentDate: "2024-05-04", statedReasons: ["Over income"] },
      { applicationDate: "2024-01-01", recordReason: "Over income" },
    );
    const late = r.defects.find((d) => d.code === "processing_exceeded_30_days");
    expect(late).toBeDefined();
    expect(late?.title).toContain("124 days");
    // Late processing alone is procedural, not invalidating.
    expect(late?.severity).toBe("procedural");
  });

  it("does not flag a denial issued exactly on day 30", () => {
    const r = reviewNotice(
      { kind: "denial_noa", sentDate: "2024-01-31", statedReasons: ["Missed interview"] },
      { applicationDate: "2024-01-01" },
    );
    expect(codes(r)).not.toContain("denial_before_day_30");
    expect(codes(r)).not.toContain("processing_exceeded_30_days");
  });
});

describe("reason accuracy", () => {
  it("Tuolumne FFY2024 Denial #1 — notice reason contradicts the record", () => {
    // "the denial NOA incorrectly informed the household they were denied for
    // residing in an institution when it should have been for missed interview."
    const r = reviewNotice(
      {
        kind: "denial_noa",
        sentDate: "2024-02-15",
        statedReasons: ["Residing in an institution"],
      },
      { applicationDate: "2024-01-20", recordReason: "Missed interview" },
    );
    expect(codes(r)).toContain("reason_does_not_match_record");
    expect(r.likelyInvalid).toBe(true);
  });

  it("Sierra FFY2025 Denial #1 — two notices, two different reasons", () => {
    // "the two denial Notices of Action sent to the household listed two
    // different denial reasons, one of which did not match the case documentation."
    const r = reviewNotice(
      {
        kind: "denial_noa",
        sentDate: "2024-03-20",
        statedReasons: ["Income not provided"],
      },
      {
        applicationDate: "2024-02-19",
        recordReason: "Income not provided",
        otherNoticeReasons: ["Missed interview"],
      },
    );
    expect(codes(r)).toContain("conflicting_reasons_across_notices");
  });

  it("accepts a reason that matches the record loosely (case/punctuation)", () => {
    const r = reviewNotice(
      {
        kind: "denial_noa",
        sentDate: "2024-02-01",
        statedReasons: ["Failed to provide verification"],
      },
      { applicationDate: "2024-01-05", recordReason: "failed to provide verification." },
    );
    expect(codes(r)).not.toContain("reason_does_not_match_record");
  });

  it("Fresno FFY2025 Denial #7 — action taken but no notice ever sent", () => {
    // "the application was denied but the denial Notice of Action (NOA) was not
    // sent to the household."
    const r = reviewNotice(
      { kind: "denial_noa", sentDate: "2024-06-30", statedReasons: ["Failure to provide"] },
      { applicationDate: "2024-06-01", noticeReceived: false, recordReason: "Failure to provide" },
    );
    expect(codes(r)).toContain("notice_never_sent");
    const d = r.defects.find((x) => x.code === "notice_never_sent");
    expect(d?.remedy).toMatch(/appeal period has not begun/i);
  });
});

describe("access defects", () => {
  it("Alameda FFY2025 Denial #2 — notice in English, preference Spanish", () => {
    const r = reviewNotice(
      { kind: "denial_noa", sentDate: "2024-04-10", statedReasons: ["Missed interview"], language: "en" },
      { applicationDate: "2024-03-15", preferredLanguage: "es", recordReason: "Missed interview" },
    );
    expect(codes(r)).toContain("language_mismatch");
  });

  it("Alameda FFY2025 Denial #1 — the mirror case, Spanish notice for an English preference", () => {
    const r = reviewNotice(
      { kind: "denial_noa", sentDate: "2024-04-10", statedReasons: ["Missed interview"], language: "es" },
      { applicationDate: "2024-03-15", preferredLanguage: "en", recordReason: "Missed interview" },
    );
    expect(codes(r)).toContain("language_mismatch");
  });

  it("San Bernardino FFY2025 Denial #2 — in-person requested, phone scheduled", () => {
    // Four of eight sampled denials in this county carried this defect.
    const r = reviewNotice(
      { kind: "denial_noa", sentDate: "2024-05-01", statedReasons: ["Missed interview"] },
      {
        applicationDate: "2024-04-05",
        recordReason: "Missed interview",
        interviewMethodRequested: "in_person",
        interviewMethodScheduled: "phone",
      },
    );
    expect(codes(r)).toContain("interview_method_not_honored");
  });

  it("Marin FFY2025 Denial #2 — expedited household interviewed late", () => {
    const r = reviewNotice(
      { kind: "denial_noa", sentDate: "2024-06-10", statedReasons: ["Out of county residency"] },
      {
        applicationDate: "2024-05-01",
        recordReason: "Out of county residency",
        expeditedEntitled: true,
        interviewScheduledDate: "2024-05-14",
      },
    );
    expect(codes(r)).toContain("expedited_interview_late");
  });
});

describe("clean notices and summary behaviour", () => {
  it("returns no defects for a well-handled denial", () => {
    const r = reviewNotice(
      {
        kind: "denial_noa",
        sentDate: "2024-01-31",
        statedReasons: ["Exceeded gross income limits"],
        language: "en",
      },
      {
        applicationDate: "2024-01-01",
        recordReason: "Exceeded gross income limits",
        preferredLanguage: "en",
        noticeReceived: true,
        contactAttemptDocumented: true,
      },
    );
    expect(r.defects).toEqual([]);
    expect(r.likelyInvalid).toBe(false);
    expect(r.summary).toMatch(/No defects detected/i);
  });

  it("distinguishes invalidating from procedural-only in the summary", () => {
    const proceduralOnly = reviewNotice(
      { kind: "denial_noa", sentDate: "2024-01-31", statedReasons: ["Over income"], language: "en" },
      { applicationDate: "2024-01-01", recordReason: "Over income", preferredLanguage: "es" },
    );
    expect(proceduralOnly.likelyInvalid).toBe(false);
    expect(proceduralOnly.summary).toMatch(/may not by themselves void/i);
  });

  it("stacks multiple defects — Sierra #1 had seven failures on one case", () => {
    const r = reviewNotice(
      {
        kind: "denial_noa",
        sentDate: "2024-02-25",
        statedReasons: ["Income not provided"],
        language: "en",
      },
      {
        applicationDate: "2024-02-19",
        recordReason: "Missed interview",
        otherNoticeReasons: ["Failed to complete"],
        preferredLanguage: "es",
        contactAttemptDocumented: false,
        interviewMethodRequested: "in_person",
        interviewMethodScheduled: "phone",
      },
    );
    expect(r.defects.length).toBeGreaterThanOrEqual(4);
    expect(r.likelyInvalid).toBe(true);
  });
});

describe("recovery window", () => {
  it("Butte FFY2025 Denial #3 — household called inside the window and was told to reapply", () => {
    // "the household was informed to reapply when they called to complete the
    // application process within 30 days from the date of application."
    const w = recoveryWindow("2024-07-01", "2024-07-18");
    expect(w.stillOpen).toBe(true);
    expect(w.dayOfApplication).toBe(17);
    expect(w.daysRemaining).toBe(13);
    expect(w.reapplyWarning).toBe(true);
    expect(w.guidance).toMatch(/Do NOT file a new application/i);
  });

  it("closes on day 30 and points to the fair-hearing path", () => {
    const w = recoveryWindow("2024-07-01", "2024-07-31");
    expect(w.stillOpen).toBe(false);
    expect(w.daysRemaining).toBe(0);
    expect(w.guidance).toMatch(/fair hearing/i);
    expect(w.guidance).toMatch(/appeal clock may not have started/i);
  });

  it("is open on day 0", () => {
    const w = recoveryWindow("2024-07-01", "2024-07-01");
    expect(w.stillOpen).toBe(true);
    expect(w.daysRemaining).toBe(30);
  });
});
