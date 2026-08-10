"use client";

// The public chat's right rail: your own estimate, building as you talk.
//
// Sibling to ScreeningWorksheet, NOT a rename of it. Same underlying data
// (snap-rules' computeBenefit output via ScreeningClassification) and the same
// shared row order and outcome copy from lib/screening-worksheet-shape, so the
// two views cannot drift on the numbers. Everything that made the other one a
// CASEWORKER artifact is deliberately absent here (user decision 2026-08-09,
// "richer but B2C-framed only"):
//
//   no case reference · no organization · no "Prepared by" · no policy-set
//   line · no PDF export · no guest counter · no sign-in paywall
//
// What replaces them is second person. "Your income", not "gross monthly
// income for the household". The person reading this is the household.
//
// Nothing here is persisted — the facts live in the chat component's state and
// die with the tab. The empty state says so, because a panel that displays
// someone's income should tell them where it goes.

import type { ScreeningClassification } from "@civica/demeter-engine";
import {
  OUTCOME_COPY,
  CALC_ROWS,
  money,
  type BenefitCalcDetail,
} from "../lib/screening-worksheet-shape";

// Second-person relabelling of the shared row order. Keyed off CALC_ROWS so a
// row added upstream still appears here (falling back to its caseworker
// label) rather than silently vanishing from the applicant's view.
const APPLICANT_LABELS: Partial<Record<keyof BenefitCalcDetail, string>> = {
  gross_monthly_income: "Your monthly income, before deductions",
  earned_income_deduction: "Deduction for money from a job, 20%",
  standard_deduction: "Standard deduction",
  dependent_care_deduction: "Childcare or dependent care",
  medical_deduction: "Medical costs over $35",
  child_support_deduction: "Child support you pay",
  excess_shelter_deduction: "Rent and utilities above half your income",
  net_monthly_income: "Income counted after deductions",
  max_allotment_for_household_size: "Most a household your size can get",
};

export interface DemeterWorksheetCopy {
  title: string;
  subtitle: string;
  result: string;
  estimate: string;
  calc: string;
  stillNeeded: string;
  empty: string;
  privacy: string;
  disclaimer: string;
  pickState: string;
  pickStateCta: string;
}

export function DemeterWorksheet({
  classification,
  stateSelected,
  copy,
  onPickState,
}: {
  classification: ScreeningClassification | null;
  stateSelected: boolean;
  copy: DemeterWorksheetCopy;
  /** Opens the state picker. Without a state there is no benefit calculation
   *  at all — snap-rules is state-keyed — so this panel telling someone to go
   *  find a control elsewhere on the page was the difference between a working
   *  estimate and a dead rail for anyone who never touched the picker. */
  onPickState?: () => void;
}) {
  const outcome = classification?.outcome;
  const outcomeCopy = outcome ? OUTCOME_COPY[outcome] : undefined;
  const calc = classification?.verdict?.trace?.benefit_calc as BenefitCalcDetail | undefined;
  // Only rows the calculation actually produced — an empty worksheet should
  // not print eight $0 lines at someone.
  const rows = calc ? CALC_ROWS.filter(([k]) => calc[k] !== undefined) : [];

  return (
    <aside className="dmw" aria-label={copy.title}>
      <div className="dmw__head">
        <span className="dmw__eyebrow">{copy.title}</span>
        <span className="dmw__sub">{copy.subtitle}</span>
      </div>

      {!stateSelected ? (
        // snap-rules is state-keyed: there is no honest federal-floor benefit
        // number, so we ask rather than show an estimate we can't stand behind.
        // The ask is a BUTTON — see onPickState.
        <div className="dmw__pick">
          <p className="dmw__empty">{copy.pickState}</p>
          {onPickState && (
            <button type="button" className="dmw__pickbtn" onClick={onPickState}>
              {copy.pickStateCta}
            </button>
          )}
        </div>
      ) : !classification ? (
        <p className="dmw__empty">{copy.empty}</p>
      ) : null}

      {outcomeCopy && (
        <section className={`dmw__result dmw__result--${outcomeCopy.tone}`}>
          <p className="dmw__result-label">{copy.result}</p>
          <p className="dmw__result-value">{outcomeCopy.label}</p>
          <p className="dmw__result-summary">{classification!.summary}</p>
          {calc && classification!.outcome !== "not_enough_information" && (
            <p className="dmw__result-benefit">
              {copy.estimate} <strong>{money(calc.monthly_benefit)}</strong>
            </p>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section className="dmw__calc">
          <p className="dmw__section-title">{copy.calc}</p>
          <dl className="dmw__calc-list">
            {rows.map(([key, label]) => (
              <div className="dmw__calc-row" key={key}>
                <dt>{APPLICANT_LABELS[key] ?? label}</dt>
                <dd>{money(calc![key])}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {classification && classification.completeness.stillNeeded.length > 0 && (
        <section className="dmw__needed">
          <p className="dmw__section-title">
            {copy.stillNeeded}
            <span className="dmw__needed-count">
              {classification.completeness.stillNeeded.length}
            </span>
          </p>
          <ul>
            {classification.completeness.stillNeeded.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="dmw__privacy">{copy.privacy}</p>
      <p className="dmw__disclaimer">{copy.disclaimer}</p>
    </aside>
  );
}
