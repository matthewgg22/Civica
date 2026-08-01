import { describe, it, expect } from "vitest";
import {
  buildInterviewTimeline,
  readinessChecklist,
  buildDocumentChecklist,
  documentsToGather,
  documentsNotRequired,
  INTERVIEW_PROBE_DOMAINS,
} from "../../src/interview/interview-prep";

const keyOf = <T extends { key: string }>(xs: T[]) => xs.map((x) => x.key);

describe("interview timeline", () => {
  it("always ends at the day-30 decision deadline", () => {
    const t = buildInterviewTimeline({ applicationDate: "2024-07-01", today: "2024-07-10" });
    const decision = t.find((m) => m.key === "decision_deadline");
    expect(decision?.date).toBe("2024-07-31");
    expect(decision?.status).toBe("upcoming");
    // The load-bearing message: they cannot be denied for a missed interview
    // before this day (Butte D#3 — county told an in-window household to reapply).
    expect(decision?.note).toMatch(/may NOT deny you for a missed interview before this day/i);
  });

  it("adds the 3-day expedited deadline only for expedited households", () => {
    const withEs = buildInterviewTimeline({
      applicationDate: "2024-07-01",
      today: "2024-07-02",
      expeditedEntitled: true,
    });
    expect(keyOf(withEs)).toContain("expedited_deadline");
    expect(withEs.find((m) => m.key === "expedited_deadline")?.date).toBe("2024-07-04");

    const withoutEs = buildInterviewTimeline({
      applicationDate: "2024-07-01",
      today: "2024-07-02",
    });
    expect(keyOf(withoutEs)).not.toContain("expedited_deadline");
  });

  it("marks a passed deadline overdue and today's as today", () => {
    const t = buildInterviewTimeline({
      applicationDate: "2024-07-01",
      today: "2024-07-31",
      expeditedEntitled: true,
    });
    expect(t.find((m) => m.key === "expedited_deadline")?.status).toBe("overdue");
    expect(t.find((m) => m.key === "decision_deadline")?.status).toBe("today");
  });

  it("marks the expedited deadline done once the interview is complete", () => {
    const t = buildInterviewTimeline({
      applicationDate: "2024-07-01",
      today: "2024-07-20",
      expeditedEntitled: true,
      interviewCompleted: true,
    });
    expect(t.find((m) => m.key === "expedited_deadline")?.status).toBe("done");
  });

  it("warns that the interview is an inbound call from a possibly unknown number", () => {
    const t = buildInterviewTimeline({
      applicationDate: "2024-07-01",
      today: "2024-07-05",
      interviewDate: "2024-07-09T10:00:00Z",
    });
    const iv = t.find((m) => m.key === "interview_scheduled");
    expect(iv?.date).toBe("2024-07-09");
    expect(iv?.note).toMatch(/unknown or blocked/i);
  });

  it("includes the 10-day verification floor when documents are due", () => {
    const t = buildInterviewTimeline({
      applicationDate: "2024-07-01",
      today: "2024-07-05",
      verificationDueDate: "2024-07-15",
    });
    const v = t.find((m) => m.key === "verification_due");
    expect(v?.note).toMatch(/at least 10 days/i);
    expect(v?.authority).toContain("273.2(f)(5)");
  });
});

describe("readiness checklist", () => {
  it("puts phone confirmation first and marks it outstanding when unconfirmed", () => {
    const r = readinessChecklist({});
    expect(r[0].key).toBe("confirm_phone");
    expect(r[0].outstanding).toBe(true);
    // San Joaquin D#1: the county called a number not in the file and recorded
    // the attempt as made.
    expect(r[0].detail).toMatch(/records the attempt as made/i);
  });

  it("clears phone and voicemail once confirmed", () => {
    const r = readinessChecklist({ phoneConfirmed: true, voicemailReady: true });
    expect(r.find((i) => i.key === "confirm_phone")?.outstanding).toBe(false);
    expect(r.find((i) => i.key === "voicemail_ready")?.outstanding).toBe(false);
  });

  it("warns expedited households about a same-day cold call", () => {
    const r = readinessChecklist({ expeditedEntitled: true });
    expect(r.find((i) => i.key === "expect_inbound_call")?.detail).toMatch(/SAME DAY/);
  });

  it("flags a method mismatch as outstanding with the rule to cite", () => {
    // San Bernardino: four of eight sampled denials carried this defect.
    const r = readinessChecklist({
      methodRequested: "in_person",
      methodScheduled: "phone",
    });
    const m = r.find((i) => i.key === "assert_method");
    expect(m?.outstanding).toBe(true);
    expect(m?.title).toMatch(/different interview type/i);
    expect(m?.authority).toContain("ACL 17-80");
  });

  it("does not flag a matching method", () => {
    const r = readinessChecklist({ methodRequested: "phone", methodScheduled: "phone" });
    expect(r.find((i) => i.key === "assert_method")?.outstanding).toBe(false);
  });
});

describe("probe domains", () => {
  it("covers the domains counties are cited for not exploring", () => {
    const keys = INTERVIEW_PROBE_DOMAINS.map((d) => d.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "income",
        "household",
        "shelter",
        "student",
        "medical",
        "expedited",
      ]),
    );
  });

  it("frames the shelter probe the way workers actually ask it", () => {
    // The ME corpus repeatedly faults workers for not asking how a household
    // meets expenses exceeding its income (SF D#6, Sierra R#13/R#14).
    const shelter = INTERVIEW_PROBE_DOMAINS.find((d) => d.key === "shelter");
    expect(shelter?.sampleQuestion).toMatch(/how do you meet your rent/i);
  });
});

describe("document staging", () => {
  const earner = { hasEarnedIncome: true, paysRent: true };

  it("requires only the 30-day income window, not months of history", () => {
    const docs = buildDocumentChecklist(earner);
    const stubs = docs.find((d) => d.key === "pay_stubs");
    expect(stubs?.requirement).toBe("required");
    expect(stubs?.reason).toMatch(/not months of history/i);
  });

  it("treats rent as conditional — it helps the household, it is not a gate", () => {
    expect(buildDocumentChecklist(earner).find((d) => d.key === "rent")?.requirement).toBe(
      "conditional",
    );
  });

  it("omits items that do not apply to the household", () => {
    const keys = keyOf(buildDocumentChecklist({ hasEarnedIncome: true }));
    expect(keys).not.toContain("dependent_care");
    expect(keys).not.toContain("medical");
    expect(keys).not.toContain("student_exemption");
  });

  it("ALWAYS lists what the county may not demand, with push-back language", () => {
    // Santa Barbara A#23/A#29, Yolo D#3/R#15: counties demanded immunization
    // records, marriage certificates, vehicle registration, bank statements.
    const not = documentsNotRequired(earner);
    expect(keyOf(not)).toEqual(
      expect.arrayContaining([
        "immunization",
        "marriage_certificate",
        "vehicle_registration",
        "bank_statements",
      ]),
    );
    for (const d of not) {
      expect(d.pushback, `${d.key} must carry push-back language`).toBeTruthy();
    }
  });

  it("does not tell the household to gather the not-required items", () => {
    // The whole point: prep must not move the over-verification burden onto
    // the applicant.
    const gather = keyOf(documentsToGather(earner));
    expect(gather).not.toContain("immunization");
    expect(gather).not.toContain("bank_statements");
    expect(gather).toContain("pay_stubs");
  });

  it("scopes immigration documents to members who are applying", () => {
    const d = buildDocumentChecklist({ isNonCitizen: true }).find(
      (x) => x.key === "immigration_status",
    );
    expect(d?.reason).toMatch(/not applying do not have to provide status/i);
  });

  it("always includes identity even for an otherwise empty profile", () => {
    expect(keyOf(documentsToGather({}))).toEqual(["identity"]);
  });
});
