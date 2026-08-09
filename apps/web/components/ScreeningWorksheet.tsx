"use client";

// The right-hand "submission file" panel (mockup frames 03-05): the
// benefit-calculation worksheet, the still-needed checklist, and the
// screening result banner. Every number here comes straight from
// trace.benefit_calc — snap-rules' own computeBenefit output — never
// re-derived or rounded again in this component.

import type { ScreeningClassification } from "@civica/demeter-engine";

const OUTCOME_COPY: Record<
  string,
  { label: string; tone: "certain" | "warn" | "deny" | "pending" }
> = {
  categorically_eligible: { label: "Categorically eligible", tone: "certain" },
  expedited: { label: "Expedited", tone: "certain" },
  likely_eligible: { label: "Likely eligible", tone: "certain" },
  likely_ineligible: { label: "Likely ineligible", tone: "deny" },
  needs_county_review: { label: "Needs county review", tone: "warn" },
  not_enough_information: { label: "Not enough information", tone: "pending" },
};

interface BenefitCalcDetail {
  gross_monthly_income: number;
  earned_income_deduction: number;
  standard_deduction: number;
  dependent_care_deduction: number;
  medical_deduction: number;
  child_support_deduction: number;
  excess_shelter_deduction: number;
  net_monthly_income: number;
  thirty_percent_of_net: number;
  max_allotment_for_household_size: number;
  monthly_benefit: number;
}

function money(n: number): string {
  return n < 0 ? `-$${Math.abs(n).toLocaleString()}` : `$${n.toLocaleString()}`;
}

const CALC_ROWS: Array<[keyof BenefitCalcDetail, string]> = [
  ["gross_monthly_income", "Gross monthly income"],
  ["earned_income_deduction", "Earned income deduction, 20%"],
  ["standard_deduction", "Standard deduction"],
  ["dependent_care_deduction", "Dependent care deduction"],
  ["medical_deduction", "Excess medical, over $35"],
  ["child_support_deduction", "Child support paid"],
  ["excess_shelter_deduction", "Excess shelter deduction"],
  ["net_monthly_income", "Net monthly income"],
  ["max_allotment_for_household_size", "Maximum allotment"],
];

export function ScreeningWorksheet({
  caseLabel,
  stateCode,
  classification,
  guestScreeningsLeft,
}: {
  caseLabel: string | null;
  stateCode: string;
  classification: ScreeningClassification | null;
  guestScreeningsLeft: number | null;
}) {
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

      <button type="button" className="worksheet__export" disabled title="Export needs an account">
        Export PDF
      </button>
      <p className="worksheet__disclaimer">
        Screening estimate only. The county agency makes the final determination.
      </p>
    </aside>
  );
}
