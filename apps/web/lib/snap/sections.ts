// Mirror of SNAPApplicationSection (SNAPReviewDraftFlow.swift). The 8-section
// canonical order drives the wizard step routing AND the review-page card
// order. Sections marked required must complete before submit; optional
// ones (contact, documentsChecklist) are skippable.

export const SECTION_IDS = [
  "where-applying",
  "applicant-age",
  "household",
  "contact",
  "income",
  "student-status",
  "expenses",
  "documents-checklist",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export const REQUIRED_SECTIONS: Set<SectionId> = new Set([
  "where-applying",
  "applicant-age",
  "household",
  "income",
  "student-status",
  "expenses",
]);

export function sectionIndex(id: SectionId): number {
  return SECTION_IDS.indexOf(id);
}

export function nextSection(id: SectionId): SectionId | null {
  const i = sectionIndex(id);
  return i < SECTION_IDS.length - 1 ? SECTION_IDS[i + 1] : null;
}

export function previousSection(id: SectionId): SectionId | null {
  const i = sectionIndex(id);
  return i > 0 ? SECTION_IDS[i - 1] : null;
}
