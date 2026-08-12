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
// The facts on this panel live in the chat component's state and die with the
// tab, and the privacy line says so — a panel that displays someone's income
// should tell them where it goes.
//
// What it must NOT say is that nothing is kept anywhere (#703). Every public
// answer writes the question and the full answer to `mae_query_log` via
// publicAuditSink; that is deliberate and it is what the accuracy work runs on.
// This line read "Nothing here is saved" from before that sink was wired, which
// made it a retention claim that understated retention — the wrong direction on
// a benefits service, to people already nervous about being on the record.
//
// It also has to survive the person pressing Save, hence the two variants: the
// "close the tab and it is gone" half stops being true the moment there is a
// row, and a sidebar contradicting the ✓ Saved badge a few inches away teaches
// people not to believe either one.

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
  /** Shown while this conversation has no saved row. */
  privacy: string;
  /** Shown once it does. Same retention sentence, different first half. */
  privacySaved: string;
  disclaimer: string;
  pickState: string;
  pickStateCta: string;
  modeLabel: string;
  modeAsk: string;
  modeEstimate: string;
  modeAskNote: string;
  switchedToAsk: string;
}

/** What this panel is for right now.
 *
 *  "ask" is the DEFAULT, and that is the point of the switch. This rail used to
 *  read household facts out of the conversation — who lives with you, what you
 *  earn, what you pay in rent — from the moment you picked a state, whether or
 *  not you had asked for an estimate. That is a reasonable thing to OFFER and
 *  an unreasonable thing to do quietly to someone who came to find out how the
 *  system works before telling it anything about themselves.
 *
 *  It also stops a paid extraction call per turn for everyone who never wanted
 *  the estimate. */
export type WorksheetMode = "ask" | "estimate";

export function DemeterWorksheet({
  classification,
  stateSelected,
  saved,
  copy,
  onPickState,
  mode,
  onModeChange,
}: {
  classification: ScreeningClassification | null;
  stateSelected: boolean;
  /** Whether this conversation has a saved row. Only decides which privacy
   *  sentence is true; the panel holds no saved state of its own. */
  saved?: boolean;
  copy: DemeterWorksheetCopy;
  /** Opens the state picker. Without a state there is no benefit calculation
   *  at all — snap-rules is state-keyed — so this panel telling someone to go
   *  find a control elsewhere on the page was the difference between a working
   *  estimate and a dead rail for anyone who never touched the picker. */
  onPickState?: () => void;
  mode: WorksheetMode;
  onModeChange: (m: WorksheetMode) => void;
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
        {/* "Builds as you talk" is a claim about what is happening, and in ask
            mode nothing is. Same defect as the old retention line: a standing
            sentence that the state below it contradicts. */}
        {mode === "estimate" && <span className="dmw__sub">{copy.subtitle}</span>}
      </div>

      {/* A radiogroup, not two toggle buttons: it is one exclusive choice, and
          a screen reader should hear "2 of 2" rather than two unrelated
          pressed/unpressed states. */}
      <div className="dmw__mode" role="radiogroup" aria-label={copy.modeLabel}>
        {(
          [
            ["ask", copy.modeAsk],
            ["estimate", copy.modeEstimate],
          ] as Array<[WorksheetMode, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            className="dmw__modeopt"
            data-on={mode === value ? "true" : undefined}
            onClick={() => onModeChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "ask" ? (
        // Nothing below this point applies: there is no estimate because none
        // was asked for. Say that plainly rather than showing an empty panel
        // that looks like it is waiting for something.
        <p className="dmw__empty">{copy.modeAskNote}</p>
      ) : !stateSelected ? (
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

      <p className="dmw__privacy">{saved ? copy.privacySaved : copy.privacy}</p>
      {/* Only where there is an estimate to disclaim. The retention line above
          stays in both modes — questions are logged either way, which is the
          whole reason it cannot be quietly dropped. */}
      {mode === "estimate" && <p className="dmw__disclaimer">{copy.disclaimer}</p>}
    </aside>
  );
}
