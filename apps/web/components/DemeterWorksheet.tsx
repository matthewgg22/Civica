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

import type { ReactNode } from "react";
import type { ScreeningClassification, PartialFacts } from "@civica/demeter-engine";
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
  /** The estimate's pre-listed section slots (owner refinement 2026-08-21):
   *  what WILL fill in, shown up front. Copy, never data — the no-invented-
   *  figures test walks every language. */
  templateTitle: string;
  template: readonly string[];
  /** "From what you've told me" — the panel's record of what it HEARD.
   *  Previously it showed only the verdict and what was still missing, so a
   *  mis-heard income or household size stayed invisible. */
  captured: string;
  capturedNote: string;
  capturedHousehold: string;
  capturedHouseholdOne: string;
  capturedHouseholdN: string;
  capturedIncome: string;
  capturedIncomeNone: string;
  capturedRent: string;
  capturedUtilities: string;
  capturedHomeless: string;
  capturedHomelessYes: string;
  capturedAssets: string;
  capturedExpedited: string;
  basedOn: string;
  askPrefix: string;
  askFor: Record<string, string>;
}

/** The facts the extractor has HEARD, as label/value pairs for display.
 *
 *  ONLY WHAT WAS SAID. The extractor is instructed never to infer, so an
 *  omitted field means "not mentioned" and gets no row — a blank is honest
 *  here and a zero would not be. `income: []` is the one exception worth
 *  distinguishing: an explicit empty income array is the model recording
 *  "they told me they have none", which is a different and load-bearing fact
 *  from never having been asked.
 */
function capturedRows(
  facts: PartialFacts | null | undefined,
  copy: DemeterWorksheetCopy,
): Array<[string, string]> {
  if (!facts) return [];
  const rows: Array<[string, string]> = [];

  const size = facts.household?.length ?? 0;
  if (size > 0) {
    rows.push([
      copy.capturedHousehold,
      size === 1 ? copy.capturedHouseholdOne : copy.capturedHouseholdN.replace("{n}", String(size)),
    ]);
  }

  if (facts.income) {
    const monthly = facts.income.reduce((n, line) => n + (Number(line.amount) || 0), 0);
    rows.push([
      copy.capturedIncome,
      facts.income.length === 0 || monthly === 0 ? copy.capturedIncomeNone : money(monthly),
    ]);
  }

  const shelter = facts.shelter;
  if (shelter?.homeless_deduction === true) {
    rows.push([copy.capturedHomeless, copy.capturedHomelessYes]);
  }
  if (typeof shelter?.rent === "number") {
    rows.push([copy.capturedRent, money(shelter.rent)]);
  }
  if (typeof shelter?.sua_amount === "number" && shelter.sua_amount > 0) {
    rows.push([copy.capturedUtilities, money(shelter.sua_amount)]);
  }

  if (facts.assets !== undefined && facts.assets !== null) {
    const n = Number(facts.assets);
    rows.push([copy.capturedAssets, Number.isFinite(n) ? money(n) : String(facts.assets)]);
  }

  if (facts.expedited === true) rows.push([copy.capturedExpedited, ""]);

  return rows;
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
  facts,
  stateSelected,
  saved,
  copy,
  onPickState,
  mode,
  onModeChange,
  onAskFor,
  footLinks,
}: {
  classification: ScreeningClassification | null;
  /** What the extractor has HEARD so far. Rendered as its own section so the
   *  reader can catch a mis-heard figure before it reaches the estimate. */
  facts?: PartialFacts | null;
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
  /** Put a question in the composer for the reader to send. PREFILL, never
   *  auto-send: the panel suggests, the person still writes. */
  onAskFor?: (prompt: string) => void;
  /** Standing links (state portal, how-we-verify) — facts about where the
   *  answers come from, rendered at the card's foot with the retention
   *  line, their natural family (owner rec, 2026-08-22). */
  footLinks?: ReactNode;
}) {
  const outcome = classification?.outcome;
  const outcomeCopy = outcome ? OUTCOME_COPY[outcome] : undefined;
  const calc = classification?.verdict?.trace?.benefit_calc as BenefitCalcDetail | undefined;
  // Only rows the calculation actually produced — an empty worksheet should
  // not print eight $0 lines at someone.
  const rows = calc ? CALC_ROWS.filter(([k]) => calc[k] !== undefined) : [];
  // Only in estimate mode: ask mode extracts nothing, so there is nothing
  // heard to show, and rendering an empty section would imply otherwise.
  const captured = mode === "estimate" ? capturedRows(facts, copy) : [];

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
      {/* data-mode drives the sliding thumb in CSS. The selected pill used to
          appear on the other half instantly, which reads as two separate
          buttons lighting up rather than as one switch being moved. */}
      <div
        className="dmw__mode"
        data-mode={mode}
        role="radiogroup"
        aria-label={copy.modeLabel}
      >
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

      {/* THE TEMPLATE (owner refinement): the shape of the thing being
          built, listed before anything has filled in — ghost slots, not a
          waiting sentence. Gone the moment real rows exist. */}
      {mode === "estimate" && !classification && (
        <section className="dmw__template" aria-label={copy.templateTitle}>
          <p className="dmw__section-title">{copy.templateTitle}</p>
          <ul className="dmw__template-list">
            {copy.template.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {outcomeCopy && (
        <section className={`dmw__result dmw__result--${outcomeCopy.tone}`}>
          <p className="dmw__result-label">{copy.result}</p>
          <p className="dmw__result-value">{outcomeCopy.label}</p>
          <p className="dmw__result-summary">{classification!.summary}</p>
          {calc && classification!.outcome !== "not_enough_information" && (
            <>
              <p className="dmw__result-benefit">
                {copy.estimate} <strong>{money(calc.monthly_benefit)}</strong>
              </p>
              {/* THE FIGURE'S OWN INPUTS, on the same card as the figure. A
                  number with no visible cause is a number nobody can correct:
                  if the household size was misheard, the estimate is wrong and
                  nothing on screen said why. The list above already holds these
                  facts — repeating the load-bearing ones HERE is what ties the
                  two together at a glance. */}
              {captured.length > 0 && (
                <p className="dmw__result-basis">
                  {copy.basedOn}{" "}
                  {captured
                    .map(([label, value]) => (value ? `${label.toLowerCase()}: ${value}` : label.toLowerCase()))
                    .join(" · ")}
                </p>
              )}
            </>
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

      {/* WHAT IT HEARD, before what it lacks. The panel used to show only the
          verdict and the missing list, so a mis-heard figure — an income read
          as monthly when it was weekly, a household of one recorded as two —
          was invisible until it surfaced in the estimate, if it ever did.
          Putting it on screen makes correcting it a sentence in the chat
          rather than a discovery at the end. */}
      {captured.length > 0 && (
        <section className="dmw__captured">
          <p className="dmw__section-title">{copy.captured}</p>
          <dl className="dmw__captured-list">
            {captured.map(([label, value]) => (
              <div className="dmw__captured-row" key={label}>
                <dt>{label}</dt>
                {value ? <dd>{value}</dd> : null}
              </div>
            ))}
          </dl>
          <p className="dmw__captured-note">{copy.capturedNote}</p>
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
          {/* A LIST THAT ASKS. These were bullets: the reader had to work out
              which mattered, then go and type it themselves. Where we know the
              question an item stands for, it becomes that question, one tap
              into the composer. PREFILL, NOT SEND — the panel suggests and the
              person still writes, because a message they did not type appearing
              in their own conversation is a different product. Items with no
              mapping (Zod's fallbacks) stay plain text rather than inventing a
              question for a field path. */}
          <ul>
            {classification.completeness.stillNeeded.map((item) => {
              const prompt = copy.askFor[item];
              return (
                <li key={item}>
                  {prompt && onAskFor ? (
                    <button
                      type="button"
                      className="dmw__askbtn"
                      onClick={() => onAskFor(prompt)}
                      aria-label={`${copy.askPrefix}: ${prompt}`}
                    >
                      {item}
                    </button>
                  ) : (
                    item
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="dmw__privacy">{saved ? copy.privacySaved : copy.privacy}</p>
      {/* The estimate disclaimer MERGED INTO the retention line above (owner,
          2026-08-26): "An estimate, not a decision" now opens that sentence, so
          printing it again here was the third statement where two do the work.
          The retention ask itself is unchanged and still shows in both modes,
          because questions are logged either way. */}
      {footLinks && <div className="dmw__footlinks">{footLinks}</div>}
    </aside>
  );
}
