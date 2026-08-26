"use client";

// Review screen — aggregates every section, badges completion, and lets
// the user jump back into any section. Mirrors SNAPReviewDraftFlowView.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDraft, clearDraftStorage } from "../../../lib/snap/draft-store";
import {
  SECTION_IDS,
  REQUIRED_SECTIONS,
  type SectionId,
} from "../../../lib/snap/sections";
import {
  sectionCompletion,
  requiredSectionsComplete,
} from "../../../lib/snap/validation";
import type { SNAPApplicationDraft } from "../../../lib/snap/draft";
import { STORAGE_KEY, type Locale } from "../../i18n";
import { snapT, type SnapStringKey } from "../../../lib/i18n/snap-copy";

export default function ReviewPage() {
  const router = useRouter();
  const [draft] = useDraft();
  const [locale, setLocale] = useState<Locale>("en");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") setLocale(saved);
    } catch { /* ignore */ }
  }, []);

  const t = (k: SnapStringKey) => snapT(locale, k);
  const allRequiredDone = requiredSectionsComplete(draft);

  async function onGenerate() {
    if (!allRequiredDone) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/enrollment/submit-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, stateCode: draft.whereApplying.state }),
      });
      if (!res.ok) {
        // Not signed in / gateway not live: the application is complete but
        // can't be sent yet. Route to a clear next step (sign in to send),
        // not a dead error. Keep the draft so nothing is lost.
        router.replace("/apply/next-steps?ready=1");
        return;
      }
      const body = (await res.json()) as { packetId: string };
      clearDraftStorage();
      router.replace(`/apply/next-steps?packet=${encodeURIComponent(body.packetId)}`);
    } catch {
      router.replace("/apply/next-steps?ready=1");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="review">
      <header className="review__header">
        <h1 className="review__title">{t("header_review")}</h1>
        <p className="review__helper">{t("helper_review")}</p>
      </header>

      <div className="review__sections">
        {SECTION_IDS.map((s) => (
          <ReviewSection
            key={s}
            section={s}
            draft={draft}
            t={t}
            onEdit={() => router.push(`/apply/${s}`)}
          />
        ))}
      </div>

      {!allRequiredDone && (
        <p className="review__hint" role="alert">{t("wizard_must_complete")}</p>
      )}
      {submitError && (
        <p className="review__hint" role="alert">{submitError}</p>
      )}

      <footer className="review__footer">
        <button
          type="button"
          className="wizard__continue"
          onClick={onGenerate}
          disabled={submitting || !allRequiredDone}
        >
          {submitting ? "…" : t("wizard_generate_cta")}
        </button>
      </footer>
    </div>
  );
}

function ReviewSection({
  section, draft, t, onEdit,
}: {
  section: SectionId;
  draft: SNAPApplicationDraft;
  t: (k: SnapStringKey) => string;
  onEdit: () => void;
}) {
  const completion = sectionCompletion(section, draft);
  const title = t(`section_${section.replace(/-/g, "_")}` as SnapStringKey);
  const summary = summarize(section, draft, t);

  return (
    <div className={`review__card review__card--${completion}`}>
      <div className="review__card-head">
        <h2 className="review__card-title">{title}</h2>
        <span className="review__card-badge" data-status={completion}>
          {completion === "complete" ? t("status_complete")
            : completion === "missing_required" ? t("status_missing_required")
            : completion === "missing_optional" ? t("status_missing_optional")
            : t("status_not_started")}
        </span>
        <button type="button" className="review__card-edit" onClick={onEdit}>
          {t("common_edit")}
        </button>
        {REQUIRED_SECTIONS.has(section) && (
          <span className="review__card-required" aria-hidden>*</span>
        )}
      </div>
      {summary.length > 0 ? (
        <dl className="review__card-body">
          {summary.map((row, idx) => (
            <div key={idx} className="review__card-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="review__card-empty">, </p>
      )}
    </div>
  );
}

function summarize(
  section: SectionId,
  d: SNAPApplicationDraft,
  t: (k: SnapStringKey) => string,
): { label: string; value: string }[] {
  const np = () => t("common_not_provided");
  const ynun = (b: boolean | null) =>
    b === null ? np() : b ? t("common_yes") : t("common_no");
  const ternary = (v: string | null) =>
    v === null ? np()
    : v === "yes" ? t("common_yes")
    : v === "no" ? t("common_no")
    : t("common_not_sure");

  switch (section) {
    case "where-applying":
      return [
        { label: t("field_state"), value: d.whereApplying.state || np() },
        { label: t("field_housing_status"), value: d.whereApplying.housingStatus ?? np() },
        { label: t("field_residential_city"), value: d.whereApplying.residentialCity || np() },
        { label: t("field_residential_zip"), value: d.whereApplying.residentialZIP || np() },
      ];
    case "applicant-age":
      return [
        { label: t("field_date_of_birth"), value: d.applicantAge.applicantDateOfBirth || np() },
        { label: t("field_age"), value: d.applicantAge.applicantAge?.toString() ?? np() },
      ];
    case "household":
      return [
        { label: t("field_household_size"), value: d.household.householdSize?.toString() ?? np() },
        { label: t("field_anyone_60_plus"), value: ternary(d.household.anyoneAge60OrOlder) },
        { label: t("field_anyone_disability"), value: ternary(d.household.anyoneWithDisability) },
        { label: t("field_anyone_pregnant"), value: ternary(d.household.anyonePregnant) },
      ];
    case "contact":
      return [
        { label: t("field_preferred_contact"), value: d.contact.preferredContactMethod ?? np() },
        { label: t("field_email"), value: d.contact.contactEmail || np() },
        { label: t("field_phone"), value: d.contact.contactPhone || np() },
      ];
    case "income":
      return [
        { label: t("field_employment_status"), value: d.income.employmentStatus ?? np() },
        { label: t("field_monthly_income"), value: d.income.monthlyIncomeEstimate || np() },
        { label: t("field_income_changes"), value: ternary(d.income.incomeChangesMonthToMonth) },
      ];
    case "student-status":
      return [
        { label: t("field_enrolled_higher_ed"), value: ynun(d.studentStatus.isCurrentlyEnrolledInHigherEducation) },
        { label: t("field_enrolled_half_time"), value: ynun(d.studentStatus.isEnrolledAtLeastHalfTime) },
        { label: t("field_works_20_hours"), value: ynun(d.studentStatus.worksAtLeastTwentyHoursPerWeek) },
        { label: t("field_work_study"), value: ynun(d.studentStatus.participatesInWorkStudy) },
      ];
    case "expenses":
      return [
        { label: t("field_rent"), value: d.expenses.rentOrHousingCost || np() },
        { label: t("field_utilities"), value: d.expenses.utilitiesCost || np() },
        { label: t("field_childcare"), value: d.expenses.childcareCostEstimate || np() },
        { label: t("field_medical"), value: d.expenses.medicalExpensesEstimate || np() },
      ];
    case "documents-checklist": {
      const docs = d.documentsChecklist.documentsAvailable;
      return docs.length === 0
        ? [{ label: ", ", value: ", " }]
        : docs.map((doc) => ({ label: doc, value: "✓" }));
    }
  }
}
