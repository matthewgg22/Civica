import { describe, it, expect } from "vitest";
import { emptyDraft } from "../draft";
import { draftToAnswerTuples } from "../draft-to-answers";

describe("draftToAnswerTuples", () => {
  it("skips empty fields", () => {
    const tuples = draftToAnswerTuples(emptyDraft());
    expect(tuples.length).toBe(0);
  });

  it("emits answer_source-ready tuples for CA basic draft", () => {
    const d = emptyDraft();
    d.whereApplying.state = "CA";
    d.whereApplying.housingStatus = "stable_home";
    d.household.householdSize = 2;
    d.income.employmentStatus = "employed_part_time";
    d.income.monthlyIncomeEstimate = "1500";
    d.expenses.rentOrHousingCost = "1000";

    const tuples = draftToAnswerTuples(d);
    const keys = tuples.map((t) => t.question_key);
    expect(keys).toContain("state_code");
    expect(keys).toContain("housing_status");
    expect(keys).toContain("household_size");
    expect(keys).toContain("employment_status");
    expect(keys).toContain("monthly_income");
    expect(keys).toContain("monthly_rent");

    const incomeRow = tuples.find((t) => t.question_key === "monthly_income");
    expect(incomeRow?.applicant_answer).toBe("1500");
  });

  it("maps booleans to yes/no strings", () => {
    const d = emptyDraft();
    d.studentStatus.isCurrentlyEnrolledInHigherEducation = true;
    d.studentStatus.isEnrolledAtLeastHalfTime = false;

    const tuples = draftToAnswerTuples(d);
    const enrolled = tuples.find((t) => t.question_key === "student_enrolled_higher_ed");
    const halfTime = tuples.find((t) => t.question_key === "student_enrolled_half_time");
    expect(enrolled?.applicant_answer).toBe("yes");
    expect(halfTime?.applicant_answer).toBe("no");
  });
});
