// Per-section "can continue" + missing-field hints mirroring SNAPApplicationViewModel.swift.
// Keep the logic line-for-line equivalent so the web wizard gates the same
// way the iOS wizard does — divergence here would mean a packet that the web
// considers complete but iOS would have flagged (or vice versa).

import type { SNAPApplicationDraft } from "./draft";
import type { SectionId } from "./sections";

export type SectionCompletion = "complete" | "missing_required" | "missing_optional" | "not_started";

const isBlank = (s: string) => s.trim().length === 0;

function shouldCollectResidentialAddress(d: SNAPApplicationDraft): boolean {
  const status = d.whereApplying.housingStatus;
  if (!status) return false;
  return status !== "unhoused";
}

function hasRequiredResidentialAddress(d: SNAPApplicationDraft): boolean {
  return !isBlank(d.whereApplying.residentialCity) && !isBlank(d.whereApplying.residentialZIP);
}

export function sectionCompletion(section: SectionId, d: SNAPApplicationDraft): SectionCompletion {
  switch (section) {
    case "where-applying": {
      const hasState = !isBlank(d.whereApplying.state);
      const hasHousing = d.whereApplying.housingStatus !== null;
      const hasAddress = hasRequiredResidentialAddress(d);
      if (!hasState && !hasHousing && !hasAddress) return "not_started";
      if (!hasState) return "missing_required";
      if (!hasHousing) return "missing_required";
      if (shouldCollectResidentialAddress(d) && !hasAddress) return "missing_required";
      return "complete";
    }
    case "applicant-age": {
      const has = d.applicantAge.applicantDateOfBirth !== null || d.applicantAge.applicantAge !== null;
      return has ? "complete" : "missing_required";
    }
    case "household": {
      const h = d.household;
      const required = h.householdSize !== null;
      const multi = (h.householdSize ?? 0) > 1;
      const anyOptional =
        (multi && (
          h.buysAndPreparesFoodWithOthers !== null ||
          h.spouseLivesWithUser !== null ||
          h.childUnder22LivesWithParentInHome !== null ||
          h.childrenInHousehold !== null
        )) ||
        h.anyoneAge60OrOlder !== null ||
        h.anyoneWithDisability !== null ||
        h.anyonePregnant !== null ||
        h.anyoneUnhousedOrNoFixedMailingAddress !== null ||
        h.preferredSafeMailingContactOption !== null;
      if (!required && !anyOptional) return "not_started";
      if (!required) return "missing_required";
      const hasMissingOptional =
        (multi && (
          h.buysAndPreparesFoodWithOthers === null ||
          h.spouseLivesWithUser === null ||
          h.childUnder22LivesWithParentInHome === null ||
          h.childrenInHousehold === null
        )) ||
        h.anyoneAge60OrOlder === null ||
        h.anyoneWithDisability === null ||
        h.anyonePregnant === null ||
        h.anyoneUnhousedOrNoFixedMailingAddress === null ||
        (h.anyoneUnhousedOrNoFixedMailingAddress === "yes" && h.preferredSafeMailingContactOption === null);
      return hasMissingOptional ? "missing_optional" : "complete";
    }
    case "contact": {
      const c = d.contact;
      const any = c.preferredContactMethod !== null || !isBlank(c.contactEmail) || !isBlank(c.contactPhone);
      if (!any) return "missing_optional";
      return "complete";
    }
    case "income": {
      const i = d.income;
      const hasEmp = i.employmentStatus !== null;
      const hasMonthly = !isBlank(i.monthlyIncomeEstimate);
      const hasChange = i.incomeChangesMonthToMonth !== null;
      if (!hasEmp && !hasMonthly && !hasChange) return "not_started";
      return hasEmp && hasMonthly && hasChange ? "complete" : "missing_required";
    }
    case "student-status": {
      const s = d.studentStatus;
      if (s.isCurrentlyEnrolledInHigherEducation === null) return "not_started";
      if (s.isCurrentlyEnrolledInHigherEducation === false) return "complete";
      const has = s.isEnrolledAtLeastHalfTime !== null
        && s.worksAtLeastTwentyHoursPerWeek !== null
        && s.participatesInWorkStudy !== null
        && s.isResponsibleForDependentChild !== null;
      return has ? "complete" : "missing_required";
    }
    case "expenses": {
      const e = d.expenses;
      const hasRent = !isBlank(e.rentOrHousingCost);
      const hasUtil = !isBlank(e.utilitiesCost);
      const hasMed = !isBlank(e.medicalExpensesEstimate);
      const hasCare = !isBlank(e.childcareCostEstimate);
      if (!hasRent && !hasUtil && !hasMed && !hasCare) return "not_started";
      if (!hasRent || !hasUtil) return "missing_required";
      if (d.studentStatus.isResponsibleForDependentChild === true && !hasCare) return "missing_optional";
      return hasMed ? "complete" : "missing_optional";
    }
    case "documents-checklist": {
      return d.documentsChecklist.documentsAvailable.length === 0 ? "missing_optional" : "complete";
    }
  }
}

// Disable continue button if the current section's required answers aren't
// present. Mirrors SNAPApplicationViewModel.canContinueDraftStep.
export function canContinue(section: SectionId, d: SNAPApplicationDraft): boolean {
  switch (section) {
    case "where-applying": {
      const w = d.whereApplying;
      if (isBlank(w.state)) return false;
      if (w.housingStatus === null) return false;
      if (w.housingStatus === "unhoused") return true;
      return hasRequiredResidentialAddress(d);
    }
    case "applicant-age":
      return d.applicantAge.applicantDateOfBirth !== null || d.applicantAge.applicantAge !== null;
    case "household":
      return d.household.householdSize !== null;
    case "contact":
      return true; // optional
    case "income":
      return !isBlank(d.income.monthlyIncomeEstimate)
        && d.income.employmentStatus !== null
        && d.income.incomeChangesMonthToMonth !== null;
    case "student-status": {
      const s = d.studentStatus;
      if (s.isCurrentlyEnrolledInHigherEducation === null) return false;
      if (s.isCurrentlyEnrolledInHigherEducation === false) return true;
      return s.isEnrolledAtLeastHalfTime !== null
        && s.worksAtLeastTwentyHoursPerWeek !== null
        && s.participatesInWorkStudy !== null
        && s.isResponsibleForDependentChild !== null;
    }
    case "expenses":
      return !isBlank(d.expenses.rentOrHousingCost) && !isBlank(d.expenses.utilitiesCost);
    case "documents-checklist":
      return true; // optional
  }
}

// Sections required for submit. Mirrors requiredSectionsAllComplete.
// A required section is submit-ready when canContinue is true — i.e. the
// user has answered enough that the wizard would have let them move on.
// "missing_optional" is acceptable here (it's optional, by definition);
// the iOS Review screen uses the same semantic.
export function requiredSectionsComplete(d: SNAPApplicationDraft): boolean {
  const required: SectionId[] = ["where-applying", "applicant-age", "household", "income", "student-status", "expenses"];
  return required.every((s) => canContinue(s, d));
}

// Overall progress (0..1) across the 8 sections — drives the wizard
// progress bar. Counts complete + missing_optional as "covered".
export function overallProgress(d: SNAPApplicationDraft): number {
  const sections: SectionId[] = [
    "where-applying", "applicant-age", "household", "contact",
    "income", "student-status", "expenses", "documents-checklist",
  ];
  const covered = sections.filter((s) => {
    const c = sectionCompletion(s, d);
    return c === "complete" || c === "missing_optional";
  }).length;
  return covered / sections.length;
}
