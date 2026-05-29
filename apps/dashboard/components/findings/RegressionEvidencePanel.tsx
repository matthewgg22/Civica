// Pre-registered PER regression panel — rendered on /findings/regression.
//
// Presentational only: takes a RegressionReport (built by
// lib/analytics/per-regression.ts from the harness artifact) and renders the
// pre-registered plan next to the computed coefficient table. No data
// fetching, no state — a Server Component fed entirely by its prop, so the
// page stays static and the panel is trivially testable.
//
// The synthetic watermark is deliberately loud: until the FOIA'd CDSS QC
// data lands, every number here is simulated. When source_kind flips to
// "foia", the watermark prop is null and the loud banner is replaced by a
// quiet "live" badge — no other change needed.

import type { RegressionReport, RenderedModel } from "../../lib/analytics/per-regression";

const GITHUB_BLOB =
  "https://github.com/matthewgg22/Civica/blob/codex/rebuild-feb18";

function shortUnit(unit: string): string {
  switch (unit) {
    case "percentage points":
      return "pp";
    default:
      return unit;
  }
}

/** Lay gloss for non-linear link functions: odds/rate ratio = exp(coef). */
function ratioGloss(m: RenderedModel): string | null {
  const b = m.result.estimate;
  if (m.spec.modelFamily === "logit") {
    return `odds ×${Math.exp(b).toFixed(2)}`;
  }
  if (m.spec.modelFamily === "poisson") {
    const pct = (Math.exp(b) - 1) * 100;
    return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)}% at full adoption`;
  }
  return null;
}

function familyLabel(family: string): string {
  switch (family) {
    case "ols":
      return "OLS";
    case "logit":
      return "Logistic";
    case "poisson":
      return "Poisson";
    default:
      return family;
  }
}

export default function RegressionEvidencePanel({
  report,
}: {
  report: RegressionReport;
}) {
  const { provenance } = report;
  return (
    <section className="space-y-8">
      {/* --------------------------------------------------------------- */}
      {/* Provenance / data-source banner                                 */}
      {/* --------------------------------------------------------------- */}
      {report.isSynthetic ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning">
            <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
              Synthetic
            </span>
            Illustrative power analysis — not real outcomes
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-graphite">
            {report.watermark}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-pine/30 bg-pine/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-pine">
            <span className="rounded bg-pine/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
              Live
            </span>
            Fitted on FOIA&apos;d CDSS case-level QC data
          </p>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* The plan — what we locked, before data                          */}
      {/* --------------------------------------------------------------- */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-graphite">
          Pre-registered plan
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          The model below was fixed on{" "}
          <span className="font-mono text-ink">{report.provenance.prereg_locked_at}</span>{" "}
          — the dependent variables, the treatment, the controls, and the
          hypothesized direction were all committed before any outcome data
          was in hand. That is what makes a &ldquo;we cut error&rdquo; claim
          falsifiable rather than fishing.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PlanItem label="Treatment">
            <code className="font-mono text-ink">{report.treatmentKey}</code>{" "}
            (enrolled via Civica vs. comparison)
          </PlanItem>
          <PlanItem label="Sample">
            <span className="font-mono text-ink tabular-nums">
              {report.nCases.toLocaleString()}
            </span>{" "}
            cases ·{" "}
            <span className="font-mono text-ink tabular-nums">
              {report.nNavigatorMonths.toLocaleString()}
            </span>{" "}
            navigator-months
          </PlanItem>
          <PlanItem label="Controls">
            {report.controls.map((c) => (
              <span
                key={c}
                className="mr-1 mb-1 inline-block rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[11px] text-graphite"
              >
                {c}
              </span>
            ))}
          </PlanItem>
          <PlanItem label="Models">
            5 dependent variables · OLS, Logistic &amp; Poisson
          </PlanItem>
        </dl>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* Results — one row per pre-registered DV                         */}
      {/* --------------------------------------------------------------- */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-graphite">
          Treatment effect per outcome
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-graphite/20 text-left">
                <Th className="w-[34%]">Outcome</Th>
                <Th>Model</Th>
                <Th className="text-right">Effect</Th>
                <Th className="text-right">95% CI</Th>
                <Th className="text-right">p</Th>
                <Th className="text-right">n</Th>
                <Th className="text-right">Fit</Th>
              </tr>
            </thead>
            <tbody>
              {report.models.map((m) => (
                <ModelRow key={m.spec.dvKey} m={m} synthetic={report.isSynthetic} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-graphite">
          Effect = the <code className="font-mono">{report.treatmentKey}</code>{" "}
          coefficient with controls held constant. Stars: *** p&lt;0.001, **
          p&lt;0.01, * p&lt;0.05. OLS effects are in natural units (pp, days);
          logistic/Poisson show the coefficient with an odds/rate-ratio gloss.
          OLS reports R²; logistic/Poisson report McFadden pseudo-R².
        </p>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* Synthetic self-test                                             */}
      {/* --------------------------------------------------------------- */}
      {report.isSynthetic && (
        <div className="rounded-md border border-graphite/15 bg-surface-secondary p-4 text-sm">
          <p className="font-semibold text-ink">Harness self-test</p>
          <p className="mt-1 leading-relaxed text-graphite">
            Each synthetic outcome was generated with a known planted effect.
            The fit recovers it when the 95% CI covers that planted value —
            a check that the estimation machinery is wired correctly before we
            trust it on real data.{" "}
            <span className="font-medium text-ink">
              {report.models.filter((m) => m.recoversTruth === true).length}/
              {report.models.length} outcomes recovered.
            </span>
          </p>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/* Provenance footer                                               */}
      {/* --------------------------------------------------------------- */}
      <footer className="border-t border-graphite/15 pt-5 text-xs leading-relaxed text-graphite">
        <p>
          Computed{" "}
          <span className="font-mono">{provenance.generated_at}</span>
          {provenance.seed !== null && (
            <>
              {" "}· seed <span className="font-mono">{provenance.seed}</span>
            </>
          )}
          {provenance.git_sha && (
            <>
              {" "}· <span className="font-mono">{provenance.git_sha}</span>
            </>
          )}{" "}
          · {provenance.environment.python && (
            <>
              Python <span className="font-mono">{provenance.environment.python}</span>,{" "}
            </>
          )}
          statsmodels{" "}
          <span className="font-mono">{provenance.environment.statsmodels}</span>.
        </p>
        <p className="mt-2">
          Harness:{" "}
          <a
            href={`${GITHUB_BLOB}/tools/per-regression/src/build_per_regression.py`}
            className="text-pine underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            tools/per-regression
          </a>{" "}
          · Plan of record:{" "}
          <a
            href={`/findings/${planFindingId(provenance.prereg_finding)}`}
            className="text-pine underline-offset-2 hover:underline"
          >
            pre-registration finding
          </a>
          . Baseline anchored to CA FY2024 total PER{" "}
          <span className="font-mono">
            {provenance.baseline_anchor.ca_total_per_fy2024}%
          </span>
          .
        </p>
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModelRow({ m, synthetic }: { m: RenderedModel; synthetic: boolean }) {
  const gloss = ratioGloss(m);
  const r2 = m.result.r2;
  const pseudo = m.result.pseudo_r2;
  const fit =
    r2 !== null
      ? `R² ${r2.toFixed(2)}`
      : pseudo !== null
        ? `R²ᴹ ${pseudo.toFixed(2)}`
        : "—";
  return (
    <tr className="border-b border-graphite/10 align-top">
      <td className="py-3 pr-3">
        <div className="font-medium text-ink">{m.spec.dvLabel}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-graphite">
          {m.spec.plainClaim}
        </div>
      </td>
      <td className="py-3 pr-3 text-graphite">{familyLabel(m.spec.modelFamily)}</td>
      <td className="py-3 pr-3 text-right">
        <div className="font-mono tabular-nums text-ink">
          {m.estimateFormatted}{" "}
          <span className="text-graphite">{shortUnit(m.spec.unit)}</span>
        </div>
        {gloss && (
          <div className="mt-0.5 font-mono text-[11px] text-graphite">{gloss}</div>
        )}
      </td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums text-graphite">
        {m.ciFormatted}
      </td>
      <td className="py-3 pr-3 text-right">
        <span className="font-mono tabular-nums text-ink">{m.pFormatted}</span>{" "}
        <span
          className={
            m.significant ? "font-mono text-pine" : "font-mono text-graphite"
          }
        >
          {m.stars}
        </span>
      </td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums text-graphite">
        {m.result.n.toLocaleString()}
      </td>
      <td className="py-3 text-right">
        <div className="font-mono tabular-nums text-graphite">{fit}</div>
        {synthetic && m.recoversTruth !== null && (
          <div
            className={`mt-0.5 font-mono text-[11px] ${
              m.recoversTruth ? "text-pine" : "text-warning"
            }`}
            title="95% CI covers the planted synthetic effect"
          >
            {m.recoversTruth ? "✓ recovered" : "✗ missed"}
          </div>
        )}
      </td>
    </tr>
  );
}

function PlanItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-graphite/15 bg-surface-secondary p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-graphite">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm text-graphite">{children}</dd>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-graphite ${className}`}
    >
      {children}
    </th>
  );
}

/** "docs/findings/2026-05-28-foo.md" → "2026-05-28-foo" (the /findings id). */
function planFindingId(ref: string): string {
  return ref
    .replace(/^.*\//, "")
    .replace(/\.md$/, "");
}
