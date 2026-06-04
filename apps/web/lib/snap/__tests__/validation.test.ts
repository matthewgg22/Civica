// Mirrors a chunk of iOS SNAPApplicationViewModel unit tests. If web and
// iOS diverge on "can continue" or "section complete", a packet the web
// considers ready could fail the iOS gate or vice versa.

import { describe, it, expect } from "vitest";
import { emptyDraft } from "../draft";
import { canContinue, sectionCompletion, requiredSectionsComplete } from "../validation";

describe("validation — where-applying", () => {
  it("starts not_started", () => {
    expect(sectionCompletion("where-applying", emptyDraft())).toBe("not_started");
  });

  it("needs state + housing status", () => {
    const d = emptyDraft();
    d.whereApplying.state = "CA";
    expect(canContinue("where-applying", d)).toBe(false);
  });

  it("unhoused doesn't require address", () => {
    const d = emptyDraft();
    d.whereApplying.state = "CA";
    d.whereApplying.housingStatus = "unhoused";
    expect(canContinue("where-applying", d)).toBe(true);
    expect(sectionCompletion("where-applying", d)).toBe("complete");
  });

  it("housed requires city + ZIP", () => {
    const d = emptyDraft();
    d.whereApplying.state = "CA";
    d.whereApplying.housingStatus = "stable_home";
    expect(canContinue("where-applying", d)).toBe(false);
    d.whereApplying.residentialCity = "Oakland";
    d.whereApplying.residentialZIP = "94612";
    expect(canContinue("where-applying", d)).toBe(true);
    expect(sectionCompletion("where-applying", d)).toBe("complete");
  });
});

describe("validation — income", () => {
  it("requires all three income fields", () => {
    const d = emptyDraft();
    expect(canContinue("income", d)).toBe(false);
    d.income.employmentStatus = "employed_part_time";
    d.income.monthlyIncomeEstimate = "1200";
    expect(canContinue("income", d)).toBe(false); // still missing change answer
    d.income.incomeChangesMonthToMonth = "yes";
    expect(canContinue("income", d)).toBe(true);
  });
});

describe("validation — student-status", () => {
  it("not-enrolled is complete with just one answer", () => {
    const d = emptyDraft();
    d.studentStatus.isCurrentlyEnrolledInHigherEducation = false;
    expect(sectionCompletion("student-status", d)).toBe("complete");
  });

  it("enrolled requires four follow-up answers", () => {
    const d = emptyDraft();
    d.studentStatus.isCurrentlyEnrolledInHigherEducation = true;
    expect(canContinue("student-status", d)).toBe(false);
    d.studentStatus.isEnrolledAtLeastHalfTime = true;
    d.studentStatus.worksAtLeastTwentyHoursPerWeek = true;
    d.studentStatus.participatesInWorkStudy = false;
    d.studentStatus.isResponsibleForDependentChild = false;
    expect(canContinue("student-status", d)).toBe(true);
  });
});

describe("validation — requiredSectionsComplete", () => {
  it("rejects empty draft", () => {
    expect(requiredSectionsComplete(emptyDraft())).toBe(false);
  });

  it("accepts a minimally-complete CA draft", () => {
    const d = emptyDraft();
    // where-applying
    d.whereApplying.state = "CA";
    d.whereApplying.housingStatus = "stable_home";
    d.whereApplying.residentialCity = "Oakland";
    d.whereApplying.residentialZIP = "94612";
    // applicant-age
    d.applicantAge.applicantAge = 27;
    // household
    d.household.householdSize = 1;
    // income
    d.income.employmentStatus = "employed_part_time";
    d.income.monthlyIncomeEstimate = "1200";
    d.income.incomeChangesMonthToMonth = "no";
    // student-status
    d.studentStatus.isCurrentlyEnrolledInHigherEducation = false;
    // expenses
    d.expenses.rentOrHousingCost = "900";
    d.expenses.utilitiesCost = "80";

    expect(requiredSectionsComplete(d)).toBe(true);
  });
});
