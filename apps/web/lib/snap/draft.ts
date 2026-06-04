// Mirror of SNAPApplicationDraft (modern) from Civica/Features/SNAP/Application/
// SNAPReviewDraftFlow.swift. Eight per-section answer blocks; every field
// defaults to an empty value so partial drafts render without crashing.
//
// Wire format: serialized as JSON to the gateway under `packet_answers` rows
// via a flat (packet_id, question_key) → value map. The flat shape is
// documented in docs/plans/intake-collection-gap.md; we expose the structured
// view here and translate at the submit boundary.

import { z } from "zod";

// Enums — wire values must match iOS SNAPModels.swift.

export const HOUSING_STATUS = ["stable_home", "temporary_housing", "staying_with_others", "unhoused"] as const;
export type HousingStatus = (typeof HOUSING_STATUS)[number];

export const STUDENT_STATUS = ["currently_student", "not_student", "recently_left_school", "unsure"] as const;
export type StudentStatus = (typeof STUDENT_STATUS)[number];

export const EMPLOYMENT_STATUS = [
  "employed_full_time",
  "employed_part_time",
  "self_employed",
  "unemployed",
  "unable_to_work",
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUS)[number];

export const TERNARY = ["yes", "no", "not_sure"] as const;
export type Ternary = (typeof TERNARY)[number];

export const PREFERRED_CONTACT = ["phone", "text", "email", "mail"] as const;
export type PreferredContactMethod = (typeof PREFERRED_CONTACT)[number];

export const SAFE_MAILING_CONTACT = [
  "shelter",
  "friend_or_relative",
  "authorized_helper",
  "email_or_portal",
  "phone",
  "not_sure",
] as const;
export type SafeMailingContactOption = (typeof SAFE_MAILING_CONTACT)[number];

export const DOCUMENT_TYPE = [
  "photo_id",
  "proof_of_address",
  "proof_of_income",
  "rent_or_housing_cost_proof",
  "utility_bill",
  "student_status_documents",
  "work_status_or_exemptions",
  "childcare_cost_proof",
  "immigration_documents_if_relevant",
] as const;
export type SNAPDocumentType = (typeof DOCUMENT_TYPE)[number];

// MARK: - Per-section answer types

export type WhereApplyingAnswers = {
  state: string;
  housingStatus: HousingStatus | null;
  residentialStreetAddress: string;
  residentialCity: string;
  residentialZIP: string;
};

export type ApplicantAgeAnswers = {
  applicantDateOfBirth: string | null; // ISO date (YYYY-MM-DD)
  applicantAge: number | null; // when DOB isn't provided
};

export type HouseholdAnswers = {
  householdSize: number | null;
  buysAndPreparesFoodWithOthers: Ternary | null;
  spouseLivesWithUser: Ternary | null;
  childUnder22LivesWithParentInHome: Ternary | null;
  childrenInHousehold: Ternary | null;
  anyoneAge60OrOlder: Ternary | null;
  anyoneWithDisability: Ternary | null;
  anyonePregnant: Ternary | null;
  anyoneUnhousedOrNoFixedMailingAddress: Ternary | null;
  preferredSafeMailingContactOption: SafeMailingContactOption | null;
};

export type ContactAnswers = {
  preferredContactMethod: PreferredContactMethod | null;
  contactEmail: string;
  contactPhone: string;
};

export type IncomeAnswers = {
  employmentStatus: EmploymentStatus | null;
  monthlyIncomeEstimate: string;
  incomeChangesMonthToMonth: Ternary | null;
};

export type StudentStatusAnswers = {
  isCurrentlyEnrolledInHigherEducation: boolean | null;
  isEnrolledAtLeastHalfTime: boolean | null;
  worksAtLeastTwentyHoursPerWeek: boolean | null;
  participatesInWorkStudy: boolean | null;
  isResponsibleForDependentChild: boolean | null;
};

export type ExpensesAnswers = {
  rentOrHousingCost: string;
  utilitiesCost: string;
  childcareCostEstimate: string;
  medicalExpensesEstimate: string;
};

export type DocumentsChecklistAnswers = {
  documentsAvailable: SNAPDocumentType[];
};

export type SNAPApplicationDraft = {
  whereApplying: WhereApplyingAnswers;
  applicantAge: ApplicantAgeAnswers;
  household: HouseholdAnswers;
  contact: ContactAnswers;
  income: IncomeAnswers;
  studentStatus: StudentStatusAnswers;
  expenses: ExpensesAnswers;
  documentsChecklist: DocumentsChecklistAnswers;
};

// Empty draft used when a user starts a fresh application or when
// hydrating SSR before the cookie-stored draft loads.
export function emptyDraft(): SNAPApplicationDraft {
  return {
    whereApplying: {
      state: "",
      housingStatus: null,
      residentialStreetAddress: "",
      residentialCity: "",
      residentialZIP: "",
    },
    applicantAge: { applicantDateOfBirth: null, applicantAge: null },
    household: {
      householdSize: null,
      buysAndPreparesFoodWithOthers: null,
      spouseLivesWithUser: null,
      childUnder22LivesWithParentInHome: null,
      childrenInHousehold: null,
      anyoneAge60OrOlder: null,
      anyoneWithDisability: null,
      anyonePregnant: null,
      anyoneUnhousedOrNoFixedMailingAddress: null,
      preferredSafeMailingContactOption: null,
    },
    contact: { preferredContactMethod: null, contactEmail: "", contactPhone: "" },
    income: { employmentStatus: null, monthlyIncomeEstimate: "", incomeChangesMonthToMonth: null },
    studentStatus: {
      isCurrentlyEnrolledInHigherEducation: null,
      isEnrolledAtLeastHalfTime: null,
      worksAtLeastTwentyHoursPerWeek: null,
      participatesInWorkStudy: null,
      isResponsibleForDependentChild: null,
    },
    expenses: {
      rentOrHousingCost: "",
      utilitiesCost: "",
      childcareCostEstimate: "",
      medicalExpensesEstimate: "",
    },
    documentsChecklist: { documentsAvailable: [] },
  };
}

// Zod schema for the cookie-persisted draft. Used by route handlers when
// hydrating server-side. Permissive on undefineds so an older draft missing
// a field still parses.
export const draftSchema = z.object({
  whereApplying: z.object({
    state: z.string().default(""),
    housingStatus: z.enum(HOUSING_STATUS).nullable().default(null),
    residentialStreetAddress: z.string().default(""),
    residentialCity: z.string().default(""),
    residentialZIP: z.string().default(""),
  }).default(() => emptyDraft().whereApplying),
  applicantAge: z.object({
    applicantDateOfBirth: z.string().nullable().default(null),
    applicantAge: z.number().int().nullable().default(null),
  }).default(() => emptyDraft().applicantAge),
  household: z.object({
    householdSize: z.number().int().nullable().default(null),
    buysAndPreparesFoodWithOthers: z.enum(TERNARY).nullable().default(null),
    spouseLivesWithUser: z.enum(TERNARY).nullable().default(null),
    childUnder22LivesWithParentInHome: z.enum(TERNARY).nullable().default(null),
    childrenInHousehold: z.enum(TERNARY).nullable().default(null),
    anyoneAge60OrOlder: z.enum(TERNARY).nullable().default(null),
    anyoneWithDisability: z.enum(TERNARY).nullable().default(null),
    anyonePregnant: z.enum(TERNARY).nullable().default(null),
    anyoneUnhousedOrNoFixedMailingAddress: z.enum(TERNARY).nullable().default(null),
    preferredSafeMailingContactOption: z.enum(SAFE_MAILING_CONTACT).nullable().default(null),
  }).default(() => emptyDraft().household),
  contact: z.object({
    preferredContactMethod: z.enum(PREFERRED_CONTACT).nullable().default(null),
    contactEmail: z.string().default(""),
    contactPhone: z.string().default(""),
  }).default(() => emptyDraft().contact),
  income: z.object({
    employmentStatus: z.enum(EMPLOYMENT_STATUS).nullable().default(null),
    monthlyIncomeEstimate: z.string().default(""),
    incomeChangesMonthToMonth: z.enum(TERNARY).nullable().default(null),
  }).default(() => emptyDraft().income),
  studentStatus: z.object({
    isCurrentlyEnrolledInHigherEducation: z.boolean().nullable().default(null),
    isEnrolledAtLeastHalfTime: z.boolean().nullable().default(null),
    worksAtLeastTwentyHoursPerWeek: z.boolean().nullable().default(null),
    participatesInWorkStudy: z.boolean().nullable().default(null),
    isResponsibleForDependentChild: z.boolean().nullable().default(null),
  }).default(() => emptyDraft().studentStatus),
  expenses: z.object({
    rentOrHousingCost: z.string().default(""),
    utilitiesCost: z.string().default(""),
    childcareCostEstimate: z.string().default(""),
    medicalExpensesEstimate: z.string().default(""),
  }).default(() => emptyDraft().expenses),
  documentsChecklist: z.object({
    documentsAvailable: z.array(z.enum(DOCUMENT_TYPE)).default([]),
  }).default(() => emptyDraft().documentsChecklist),
});
