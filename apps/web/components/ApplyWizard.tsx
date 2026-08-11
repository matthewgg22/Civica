"use client";

// Multi-section SNAP application wizard. One client component owns the
// draft state machine; the per-section content is inline (one render
// function per section). Mirrors the iOS SNAPApplicationViewModel +
// SNAPDraftStep pattern from Civica/Features/SNAP/SNAPApplicationViewModel.swift.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDraft } from "../lib/snap/draft-store";
import type { Locale } from "../app/i18n";
import { snapT, type SnapStringKey } from "../lib/i18n/snap-copy";
import {
  SECTION_IDS,
  sectionIndex,
  nextSection,
  previousSection,
  type SectionId,
} from "../lib/snap/sections";
import {
  canContinue,
  sectionCompletion,
  overallProgress,
} from "../lib/snap/validation";
import {
  HOUSING_STATUS,
  EMPLOYMENT_STATUS,
  TERNARY,
  PREFERRED_CONTACT,
  SAFE_MAILING_CONTACT,
  DOCUMENT_TYPE,
  type SNAPApplicationDraft,
  type HousingStatus,
  type EmploymentStatus,
  type Ternary,
  type PreferredContactMethod,
  type SafeMailingContactOption,
  type SNAPDocumentType,
} from "../lib/snap/draft";

type Props = {
  section: SectionId;
  locale: Locale;
};

export function ApplyWizard({ section, locale }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useDraft();
  const [showRequiredHint, setShowRequiredHint] = useState(false);

  // When the section changes, reset the required-hint suppression.
  useEffect(() => { setShowRequiredHint(false); }, [section]);

  const t = (k: SnapStringKey) => snapT(locale, k);

  const stepIndex = sectionIndex(section);
  const totalSteps = SECTION_IDS.length;
  const completion = sectionCompletion(section, draft);
  const canMoveForward = canContinue(section, draft);
  const progress = overallProgress(draft);

  const onContinue = () => {
    if (!canMoveForward) {
      setShowRequiredHint(true);
      return;
    }
    const next = nextSection(section);
    if (next) router.push(`/apply/${next}`);
    else router.push("/apply/review");
  };

  const onBack = () => {
    const prev = previousSection(section);
    // First section: exit to the home instead of looping through /apply
    // (which would redirect right back to the first incomplete section).
    if (prev) router.push(`/apply/${prev}`);
    else router.push("/welcome");
  };

  return (
    <div className="wizard">
      <header className="wizard__header">
        <div className="wizard__step-meta">
          {t("wizard_step_of").replace("{current}", String(stepIndex + 1)).replace("{total}", String(totalSteps))} · {t(`section_${sectionToKey(section)}` as SnapStringKey)}
        </div>
        <div className="wizard__progress" aria-hidden>
          <div
            className="wizard__progress-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <h1 className="wizard__title">{t(`header_${sectionToKey(section)}` as SnapStringKey)}</h1>
        <p className="wizard__helper">{t(`helper_${sectionToKey(section)}` as SnapStringKey)}</p>
      </header>

      <main className="wizard__body">
        {section === "where-applying" && (
          <WhereApplyingFields draft={draft} setDraft={setDraft} t={t} />
        )}
        {section === "applicant-age" && (
          <ApplicantAgeFields draft={draft} setDraft={setDraft} t={t} />
        )}
        {section === "household" && (
          <HouseholdFields draft={draft} setDraft={setDraft} t={t} />
        )}
        {section === "contact" && (
          <ContactFields draft={draft} setDraft={setDraft} t={t} />
        )}
        {section === "income" && (
          <IncomeFields draft={draft} setDraft={setDraft} t={t} />
        )}
        {section === "student-status" && (
          <StudentStatusFields draft={draft} setDraft={setDraft} t={t} />
        )}
        {section === "expenses" && (
          <ExpensesFields draft={draft} setDraft={setDraft} t={t} />
        )}
        {section === "documents-checklist" && (
          <DocumentsChecklistFields draft={draft} setDraft={setDraft} t={t} />
        )}
      </main>

      {showRequiredHint && !canMoveForward && (
        <p className="wizard__hint" role="alert">
          {t("hint_add_prefix")} {missingFieldsHint(section, draft, t)}
        </p>
      )}

      <footer className="wizard__footer">
        <button type="button" className="wizard__back" onClick={onBack}>
          ← {t("common_back")}
        </button>
        <div className="wizard__completion-pill" data-status={completion}>
          {completionLabel(completion, t)}
        </div>
        <button
          type="button"
          className="wizard__continue"
          onClick={onContinue}
          aria-disabled={!canMoveForward}
        >
          {t("common_continue")} →
        </button>
      </footer>
    </div>
  );
}

// MARK: - Section-to-i18n-key helper

function sectionToKey(s: SectionId): string {
  return s.replace(/-/g, "_");
}

function completionLabel(c: ReturnType<typeof sectionCompletion>, t: (k: SnapStringKey) => string): string {
  switch (c) {
    case "complete": return t("status_complete");
    case "missing_required": return t("status_missing_required");
    case "missing_optional": return t("status_missing_optional");
    case "not_started": return t("status_not_started");
  }
}

function missingFieldsHint(
  section: SectionId,
  d: SNAPApplicationDraft,
  t: (k: SnapStringKey) => string,
): string {
  const list: string[] = [];
  switch (section) {
    case "where-applying":
      if (!d.whereApplying.state.trim()) list.push(t("hint_state"));
      if (d.whereApplying.housingStatus === null) list.push(t("hint_housing_status"));
      if (d.whereApplying.housingStatus !== "unhoused") {
        if (!d.whereApplying.residentialCity.trim()) list.push(t("hint_city"));
        if (!d.whereApplying.residentialZIP.trim()) list.push(t("hint_zip"));
      }
      break;
    case "applicant-age":
      list.push(t("hint_applicant_age"));
      break;
    case "income":
      if (d.income.employmentStatus === null) list.push(t("hint_employment_status"));
      if (!d.income.monthlyIncomeEstimate.trim()) list.push(t("hint_monthly_income"));
      if (d.income.incomeChangesMonthToMonth === null) list.push(t("hint_income_change"));
      break;
    case "student-status":
      if (d.studentStatus.isEnrolledAtLeastHalfTime === null) list.push(t("hint_half_time"));
      if (d.studentStatus.worksAtLeastTwentyHoursPerWeek === null) list.push(t("hint_works_20"));
      if (d.studentStatus.participatesInWorkStudy === null) list.push(t("hint_work_study"));
      if (d.studentStatus.isResponsibleForDependentChild === null) list.push(t("hint_dependent_child"));
      break;
    case "expenses":
      if (!d.expenses.rentOrHousingCost.trim()) list.push(t("hint_rent"));
      if (!d.expenses.utilitiesCost.trim()) list.push(t("hint_utilities"));
      break;
    default:
      break;
  }
  return list.join(", ") + ".";
}

// MARK: - Per-section field components

type SectionProps = {
  draft: SNAPApplicationDraft;
  setDraft: (next: SNAPApplicationDraft) => void;
  t: (k: SnapStringKey) => string;
};

function WhereApplyingFields({ draft, setDraft, t }: SectionProps) {
  const w = draft.whereApplying;
  const update = (patch: Partial<typeof w>) =>
    setDraft({ ...draft, whereApplying: { ...w, ...patch } });

  const showAddress = w.housingStatus !== null && w.housingStatus !== "unhoused";

  return (
    <div className="fields">
      <Field label={t("field_state")}>
        <input
          className="field__input"
          maxLength={2}
          autoCapitalize="characters"
          placeholder={t("field_state_placeholder")}
          value={w.state}
          onChange={(e) => update({ state: e.target.value.toUpperCase().slice(0, 2) })}
        />
      </Field>

      <RadioGroup
        label={t("field_housing_status")}
        value={w.housingStatus}
        options={HOUSING_STATUS.map((v) => ({
          value: v,
          label: t(`housing_${
            v === "stable_home" ? "stable_home"
            : v === "temporary_housing" ? "temporary"
            : v === "staying_with_others" ? "with_others"
            : "unhoused"
          }` as SnapStringKey),
        }))}
        onChange={(v) => update({ housingStatus: v as HousingStatus })}
      />

      {showAddress && (
        <>
          <Field label={t("field_residential_street")}>
            <input
              className="field__input"
              value={w.residentialStreetAddress}
              onChange={(e) => update({ residentialStreetAddress: e.target.value })}
              autoComplete="street-address"
            />
          </Field>
          <Field label={t("field_residential_city")}>
            <input
              className="field__input"
              value={w.residentialCity}
              onChange={(e) => update({ residentialCity: e.target.value })}
              autoComplete="address-level2"
            />
          </Field>
          <Field label={t("field_residential_zip")}>
            <input
              className="field__input"
              inputMode="numeric"
              maxLength={5}
              value={w.residentialZIP}
              onChange={(e) =>
                update({ residentialZIP: e.target.value.replace(/\D/g, "").slice(0, 5) })
              }
              autoComplete="postal-code"
            />
          </Field>
        </>
      )}
    </div>
  );
}

function ApplicantAgeFields({ draft, setDraft, t }: SectionProps) {
  const a = draft.applicantAge;
  const update = (patch: Partial<typeof a>) =>
    setDraft({ ...draft, applicantAge: { ...a, ...patch } });
  return (
    <div className="fields">
      <Field label={t("field_date_of_birth")}>
        <input
          type="date"
          className="field__input"
          value={a.applicantDateOfBirth ?? ""}
          onChange={(e) =>
            update({ applicantDateOfBirth: e.target.value || null })
          }
          autoComplete="bday"
        />
      </Field>
      <Field label={t("field_age")} helper={t("field_age_helper")}>
        <input
          className="field__input"
          inputMode="numeric"
          value={a.applicantAge === null ? "" : String(a.applicantAge)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            update({ applicantAge: digits ? Math.min(120, Number(digits)) : null });
          }}
        />
      </Field>
    </div>
  );
}

function HouseholdFields({ draft, setDraft, t }: SectionProps) {
  const h = draft.household;
  const update = (patch: Partial<typeof h>) =>
    setDraft({ ...draft, household: { ...h, ...patch } });
  const multi = (h.householdSize ?? 0) > 1;
  return (
    <div className="fields">
      <Field label={t("field_household_size")}>
        <input
          className="field__input"
          inputMode="numeric"
          value={h.householdSize === null ? "" : String(h.householdSize)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            update({ householdSize: digits ? Math.min(30, Number(digits)) : null });
          }}
        />
      </Field>

      {multi && (
        <>
          <TernaryField label={t("field_buys_prepares_food")}
            value={h.buysAndPreparesFoodWithOthers}
            onChange={(v) => update({ buysAndPreparesFoodWithOthers: v })} t={t} />
          <TernaryField label={t("field_spouse_lives")}
            value={h.spouseLivesWithUser}
            onChange={(v) => update({ spouseLivesWithUser: v })} t={t} />
          <TernaryField label={t("field_child_under_22")}
            value={h.childUnder22LivesWithParentInHome}
            onChange={(v) => update({ childUnder22LivesWithParentInHome: v })} t={t} />
          <TernaryField label={t("field_children_in_household")}
            value={h.childrenInHousehold}
            onChange={(v) => update({ childrenInHousehold: v })} t={t} />
        </>
      )}

      <TernaryField label={t("field_anyone_60_plus")}
        value={h.anyoneAge60OrOlder}
        onChange={(v) => update({ anyoneAge60OrOlder: v })} t={t} />
      <TernaryField label={t("field_anyone_disability")}
        value={h.anyoneWithDisability}
        onChange={(v) => update({ anyoneWithDisability: v })} t={t} />
      <TernaryField label={t("field_anyone_pregnant")}
        value={h.anyonePregnant}
        onChange={(v) => update({ anyonePregnant: v })} t={t} />
      <TernaryField label={t("field_migrant_farmworker")}
        value={h.isMigrantOrSeasonalFarmworker}
        onChange={(v) => update({ isMigrantOrSeasonalFarmworker: v })} t={t} />
      <TernaryField label={t("field_anyone_unhoused")}
        value={h.anyoneUnhousedOrNoFixedMailingAddress}
        onChange={(v) => update({ anyoneUnhousedOrNoFixedMailingAddress: v })} t={t} />

      {h.anyoneUnhousedOrNoFixedMailingAddress === "yes" && (
        <RadioGroup
          label={t("field_safe_mailing")}
          value={h.preferredSafeMailingContactOption}
          options={SAFE_MAILING_CONTACT.map((v) => ({
            value: v,
            label: t(
              v === "shelter" ? "safe_mailing_shelter"
              : v === "friend_or_relative" ? "safe_mailing_friend"
              : v === "authorized_helper" ? "safe_mailing_helper"
              : v === "email_or_portal" ? "safe_mailing_portal"
              : v === "phone" ? "safe_mailing_phone"
              : "safe_mailing_not_sure"
            ),
          }))}
          onChange={(v) =>
            update({ preferredSafeMailingContactOption: v as SafeMailingContactOption })
          }
        />
      )}
    </div>
  );
}

function ContactFields({ draft, setDraft, t }: SectionProps) {
  const c = draft.contact;
  const update = (patch: Partial<typeof c>) =>
    setDraft({ ...draft, contact: { ...c, ...patch } });
  return (
    <div className="fields">
      <RadioGroup
        label={t("field_preferred_contact")}
        value={c.preferredContactMethod}
        options={PREFERRED_CONTACT.map((v) => ({
          value: v,
          label: t(`contact_method_${v}` as SnapStringKey),
        }))}
        onChange={(v) => update({ preferredContactMethod: v as PreferredContactMethod })}
      />
      <Field label={t("field_email")}>
        <input
          type="email"
          className="field__input"
          value={c.contactEmail}
          autoComplete="email"
          onChange={(e) => update({ contactEmail: e.target.value })}
        />
      </Field>
      <Field label={t("field_phone")}>
        <input
          type="tel"
          className="field__input"
          value={c.contactPhone}
          autoComplete="tel"
          onChange={(e) => update({ contactPhone: e.target.value })}
        />
      </Field>
    </div>
  );
}

function IncomeFields({ draft, setDraft, t }: SectionProps) {
  const i = draft.income;
  const update = (patch: Partial<typeof i>) =>
    setDraft({ ...draft, income: { ...i, ...patch } });
  return (
    <div className="fields">
      <RadioGroup
        label={t("field_employment_status")}
        value={i.employmentStatus}
        options={EMPLOYMENT_STATUS.map((v) => ({
          value: v,
          label: t(
            v === "employed_full_time" ? "employment_full_time"
            : v === "employed_part_time" ? "employment_part_time"
            : v === "self_employed" ? "employment_self"
            : v === "unemployed" ? "employment_unemployed"
            : "employment_unable"
          ),
        }))}
        onChange={(v) => update({ employmentStatus: v as EmploymentStatus })}
      />
      <Field label={t("field_monthly_income")}>
        <input
          className="field__input"
          inputMode="decimal"
          value={i.monthlyIncomeEstimate}
          onChange={(e) => update({ monthlyIncomeEstimate: e.target.value })}
        />
      </Field>
      <TernaryField label={t("field_income_changes")}
        value={i.incomeChangesMonthToMonth}
        onChange={(v) => update({ incomeChangesMonthToMonth: v })} t={t} />
    </div>
  );
}

function StudentStatusFields({ draft, setDraft, t }: SectionProps) {
  const s = draft.studentStatus;
  const update = (patch: Partial<typeof s>) =>
    setDraft({ ...draft, studentStatus: { ...s, ...patch } });
  return (
    <div className="fields">
      <BoolField label={t("field_enrolled_higher_ed")}
        value={s.isCurrentlyEnrolledInHigherEducation}
        onChange={(v) => update({ isCurrentlyEnrolledInHigherEducation: v })} t={t} />
      {s.isCurrentlyEnrolledInHigherEducation === true && (
        <>
          <BoolField label={t("field_enrolled_half_time")}
            value={s.isEnrolledAtLeastHalfTime}
            onChange={(v) => update({ isEnrolledAtLeastHalfTime: v })} t={t} />
          <BoolField label={t("field_works_20_hours")}
            value={s.worksAtLeastTwentyHoursPerWeek}
            onChange={(v) => update({ worksAtLeastTwentyHoursPerWeek: v })} t={t} />
          <BoolField label={t("field_work_study")}
            value={s.participatesInWorkStudy}
            onChange={(v) => update({ participatesInWorkStudy: v })} t={t} />
          <BoolField label={t("field_dependent_child")}
            value={s.isResponsibleForDependentChild}
            onChange={(v) => update({ isResponsibleForDependentChild: v })} t={t} />
        </>
      )}
    </div>
  );
}

function ExpensesFields({ draft, setDraft, t }: SectionProps) {
  const e = draft.expenses;
  const update = (patch: Partial<typeof e>) =>
    setDraft({ ...draft, expenses: { ...e, ...patch } });
  return (
    <div className="fields">
      <Field label={t("field_rent")}>
        <input className="field__input" inputMode="decimal" value={e.rentOrHousingCost}
          onChange={(ev) => update({ rentOrHousingCost: ev.target.value })} />
      </Field>
      <Field label={t("field_utilities")}>
        <input className="field__input" inputMode="decimal" value={e.utilitiesCost}
          onChange={(ev) => update({ utilitiesCost: ev.target.value })} />
      </Field>
      <Field label={t("field_childcare")}>
        <input className="field__input" inputMode="decimal" value={e.childcareCostEstimate}
          onChange={(ev) => update({ childcareCostEstimate: ev.target.value })} />
      </Field>
      <Field label={t("field_medical")}>
        <input className="field__input" inputMode="decimal" value={e.medicalExpensesEstimate}
          onChange={(ev) => update({ medicalExpensesEstimate: ev.target.value })} />
      </Field>
    </div>
  );
}

function DocumentsChecklistFields({ draft, setDraft, t }: SectionProps) {
  const d = draft.documentsChecklist;
  const toggle = (id: SNAPDocumentType) => {
    const has = d.documentsAvailable.includes(id);
    const next = has
      ? d.documentsAvailable.filter((v) => v !== id)
      : [...d.documentsAvailable, id];
    setDraft({ ...draft, documentsChecklist: { documentsAvailable: next } });
  };

  // Mirrors SNAPDocumentType.relevant — show items based on draft answers
  // so the checklist isn't cluttered with irrelevant docs.
  const showStudent = draft.studentStatus.isCurrentlyEnrolledInHigherEducation === true;
  const showWork =
    draft.income.employmentStatus !== null
    && draft.income.employmentStatus !== "unemployed";
  const showChildcare = draft.studentStatus.isResponsibleForDependentChild === true
    || draft.household.childrenInHousehold === "yes";

  const visible: SNAPDocumentType[] = DOCUMENT_TYPE.filter((doc) => {
    if (doc === "student_status_documents") return showStudent;
    if (doc === "work_status_or_exemptions") return showWork;
    if (doc === "childcare_cost_proof") return showChildcare;
    if (doc === "immigration_documents_if_relevant") return false; // optional, hidden from default checklist
    return true;
  });

  return (
    <div className="fields">
      {visible.map((id) => {
        const checked = d.documentsAvailable.includes(id);
        return (
          <label key={id} className={`doc-checkbox ${checked ? "doc-checkbox--checked" : ""}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(id)}
            />
            <div>
              <div className="doc-checkbox__label">{t(`doc_${docKeyFor(id)}` as SnapStringKey)}</div>
              <div className="doc-checkbox__detail">{t(`doc_${docKeyFor(id)}_detail` as SnapStringKey)}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

function docKeyFor(id: SNAPDocumentType): string {
  switch (id) {
    case "photo_id": return "photo_id";
    case "proof_of_address": return "proof_address";
    case "proof_of_income": return "proof_income";
    case "rent_or_housing_cost_proof": return "rent_proof";
    case "utility_bill": return "utility_bill";
    case "student_status_documents": return "student_status";
    case "work_status_or_exemptions": return "work_status";
    case "childcare_cost_proof": return "childcare_proof";
    case "immigration_documents_if_relevant": return "immigration";
  }
}

// MARK: - Field primitives

function Field({
  label, helper, children,
}: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {helper && <span className="field__helper">{helper}</span>}
    </label>
  );
}

function RadioGroup<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T | null;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="radio-group">
      <legend className="field__label">{label}</legend>
      <div className="radio-group__options">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`radio-chip ${value === opt.value ? "radio-chip--selected" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function TernaryField({
  label, value, onChange, t,
}: {
  label: string;
  value: Ternary | null;
  onChange: (v: Ternary) => void;
  t: (k: SnapStringKey) => string;
}) {
  return (
    <RadioGroup
      label={label}
      value={value}
      options={TERNARY.map((v) => ({
        value: v,
        label: t(v === "yes" ? "common_yes" : v === "no" ? "common_no" : "common_not_sure"),
      }))}
      onChange={(v) => onChange(v as Ternary)}
    />
  );
}

function BoolField({
  label, value, onChange, t,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  t: (k: SnapStringKey) => string;
}) {
  return (
    <RadioGroup<"yes" | "no">
      label={label}
      value={value === null ? null : value ? "yes" : "no"}
      options={[
        { value: "yes", label: t("common_yes") },
        { value: "no", label: t("common_no") },
      ]}
      onChange={(v) => onChange(v === "yes")}
    />
  );
}
