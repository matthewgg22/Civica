"use client";

// The right-hand "submission file" panel (mockup frames 03-05): the
// benefit-calculation worksheet, the still-needed checklist, and the
// screening result banner. Every number here comes straight from
// trace.benefit_calc — snap-rules' own computeBenefit output — never
// re-derived or rounded again in this component.

import type { ScreeningClassification } from "@civica/demeter-engine";
import { OUTCOME_COPY, CALC_ROWS, money, type BenefitCalcDetail } from "../lib/screening-worksheet-shape";

export function ScreeningWorksheet({
  screeningId,
  caseLabel,
  stateCode,
  classification,
  guestScreeningsLeft,
}: {
  screeningId: string | null;
  caseLabel: string | null;
  stateCode: string;
  classification: ScreeningClassification | null;
  guestScreeningsLeft: number | null;
}) {
  // guestScreeningsLeft is populated ONLY for a guest identity (route.ts
  // sets it to null for an org member) — the same signal the route already
  // uses, reused here rather than threading a separate isOrgMember prop.
  const canExport = screeningId !== null && guestScreeningsLeft === null && classification !== null;
  const outcome = classification?.outcome;
  const copy = outcome ? OUTCOME_COPY[outcome] : undefined;
  const calc = classification?.verdict?.trace?.benefit_calc as BenefitCalcDetail | undefined;
  // Only rows the calculation actually produced a nonzero-or-present value
  // for — an empty worksheet should not print eight $0 lines.
  const rows = calc ? CALC_ROWS.filter(([k]) => calc[k] !== undefined) : [];

  return (
    <aside className="worksheet" aria-label="Submission file">
      <div className="worksheet__head">
        <span className="worksheet__eyebrow">Submission file</span>
        {caseLabel ? (
          <span className="worksheet__case">Case {caseLabel}</span>
        ) : (
          <span className="worksheet__case worksheet__case--guest">Guest session · not saved</span>
        )}
      </div>
      <p className="worksheet__policy">{stateCode} policy set</p>

      {copy && (
        <section className={`worksheet__result worksheet__result--${copy.tone}`}>
          <p className="worksheet__result-label">Screening result</p>
          <p className="worksheet__result-value">{copy.label}</p>
          <p className="worksheet__result-summary">{classification!.summary}</p>
          {calc && classification!.outcome !== "not_enough_information" && (
            <p className="worksheet__result-benefit">
              Est. monthly benefit: <strong>{money(calc.monthly_benefit)}</strong>
            </p>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section className="worksheet__calc">
          <p className="worksheet__section-title">Benefit calculation</p>
          <dl className="worksheet__calc-list">
            {rows.map(([key, label]) => (
              <div className="worksheet__calc-row" key={key}>
                <dt>{label}</dt>
                <dd>{money(calc![key])}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {classification && classification.completeness.stillNeeded.length > 0 && (
        <section className="worksheet__needed">
          <p className="worksheet__section-title">
            Still needed
            <span className="worksheet__needed-count">
              {classification.completeness.stillNeeded.length} item
              {classification.completeness.stillNeeded.length === 1 ? "" : "s"}
            </span>
          </p>
          <ul>
            {classification.completeness.stillNeeded.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {!classification && (
        <p className="worksheet__empty">
          Describe the household and the file will build here — questions asked, citations,
          and the benefit calculation.
        </p>
      )}

      {guestScreeningsLeft !== null && (
        <p className="worksheet__guest-note">
          {guestScreeningsLeft > 0
            ? `${guestScreeningsLeft} guest screening${guestScreeningsLeft === 1 ? "" : "s"} left. Sign in to keep this one and export it.`
            : "Guest screening limit reached — sign in to keep going."}
        </p>
      )}

      {guestScreeningsLeft === 0 && (
        <section className="worksheet__paywall">
          <p className="worksheet__paywall-text">
            This is your last guest screening. Sign in to keep this case file, screen more
            households, and export to PDF.
          </p>
          <a className="worksheet__paywall-cta" href="/screen/sign-in">
            Sign in
          </a>
        </section>
      )}

      {canExport ? (
        <a className="worksheet__export" href={`/api/screen/${screeningId}/export`}>
          Export PDF
        </a>
      ) : (
        <button type="button" className="worksheet__export" disabled title="Export needs an account">
          Export PDF
        </button>
      )}
      <p className="worksheet__disclaimer">
        Screening estimate only. The county agency makes the final determination.
      </p>
    </aside>
  );
}
