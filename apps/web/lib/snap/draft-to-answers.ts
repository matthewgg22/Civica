// Flattens the structured SNAPApplicationDraft into the (question_key,
// question_label, applicant_answer) tuples that the gateway's
// PUT /packets/:id/answers/:key endpoint accepts. Mirrors the canonical
// vocabulary in apps/enrollment-api/src/lib/questions.ts.
//
// Keys are intentionally a SUBSET — the ones the engine reads today plus
// the ones that materially help a navigator review the packet. Per
// docs/plans/intake-collection-gap.md, the load-bearing CA/MA fields are
// household_size + per-member age + per-member citizenship; per-member
// fields are deferred to v1.1.

import type { SNAPApplicationDraft } from "./draft";

export type AnswerTuple = {
  question_key: string;
  question_label: string;
  applicant_answer: string;
};

function ynun(b: boolean | null): string | null {
  if (b === null) return null;
  return b ? "yes" : "no";
}

export function draftToAnswerTuples(d: SNAPApplicationDraft): AnswerTuple[] {
  const out: AnswerTuple[] = [];
  const push = (key: string, label: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    out.push({ question_key: key, question_label: label, applicant_answer: value });
  };

  // Where applying
  push("state_code", "State", d.whereApplying.state);
  push("housing_status", "Housing status", d.whereApplying.housingStatus);
  push("residential_street", "Street address", d.whereApplying.residentialStreetAddress);
  push("residential_city", "City", d.whereApplying.residentialCity);
  push("residential_zip", "ZIP code", d.whereApplying.residentialZIP);

  // Applicant age
  push("applicant_date_of_birth", "Date of birth", d.applicantAge.applicantDateOfBirth);
  push(
    "applicant_age",
    "Applicant age",
    d.applicantAge.applicantAge === null ? null : String(d.applicantAge.applicantAge),
  );

  // Household
  push(
    "household_size",
    "How many people live in your household?",
    d.household.householdSize === null ? null : String(d.household.householdSize),
  );
  push("household_buys_prepares_food_together", "Buys and prepares food together",
    d.household.buysAndPreparesFoodWithOthers);
  push("household_spouse_present", "Spouse present", d.household.spouseLivesWithUser);
  push("household_child_under_22_with_parent", "Child under 22 with parent",
    d.household.childUnder22LivesWithParentInHome);
  push("household_has_children", "Children in household", d.household.childrenInHousehold);
  push("household_has_elderly", "Anyone 60+", d.household.anyoneAge60OrOlder);
  push("household_has_disabled", "Anyone with disability", d.household.anyoneWithDisability);
  push("household_pregnant", "Anyone pregnant", d.household.anyonePregnant);
  push("household_anyone_unhoused", "Anyone unhoused",
    d.household.anyoneUnhousedOrNoFixedMailingAddress);
  push("household_safe_mailing_option", "Safe mailing option",
    d.household.preferredSafeMailingContactOption);

  // Contact
  push("preferred_contact_method", "Preferred contact method",
    d.contact.preferredContactMethod);
  push("contact_email", "Email", d.contact.contactEmail);
  push("contact_phone", "Phone", d.contact.contactPhone);

  // Income
  push("employment_status", "Employment status", d.income.employmentStatus);
  push("monthly_income", "Monthly income estimate", d.income.monthlyIncomeEstimate);
  push("income_changes_month_to_month", "Income changes month to month",
    d.income.incomeChangesMonthToMonth);

  // Student status
  push("student_enrolled_higher_ed", "Enrolled in higher education",
    ynun(d.studentStatus.isCurrentlyEnrolledInHigherEducation));
  push("student_enrolled_half_time", "Half-time enrollment",
    ynun(d.studentStatus.isEnrolledAtLeastHalfTime));
  push("student_works_20_hours", "Works 20+ hours/week",
    ynun(d.studentStatus.worksAtLeastTwentyHoursPerWeek));
  push("student_work_study", "Work-study", ynun(d.studentStatus.participatesInWorkStudy));
  push("student_dependent_child", "Responsible for dependent child",
    ynun(d.studentStatus.isResponsibleForDependentChild));

  // Expenses
  push("monthly_rent", "Monthly rent or housing cost", d.expenses.rentOrHousingCost);
  push("monthly_utilities", "Monthly utilities", d.expenses.utilitiesCost);
  push("monthly_childcare", "Monthly childcare estimate", d.expenses.childcareCostEstimate);
  push("monthly_medical", "Monthly medical estimate", d.expenses.medicalExpensesEstimate);

  // Documents available checklist
  if (d.documentsChecklist.documentsAvailable.length > 0) {
    push(
      "documents_available",
      "Documents available",
      d.documentsChecklist.documentsAvailable.join(","),
    );
  }

  return out;
}
