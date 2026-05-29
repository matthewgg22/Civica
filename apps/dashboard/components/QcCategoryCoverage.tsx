/**
 * QcCategoryCoverage — stub for the future T5 state-audit dashboard.
 *
 * Renders coverage % of federal QC ELEMENT categories that have a real
 * Civica control, plus per-category breakdown sorted by weighted error share.
 *
 * Currently feature-flagged off. To enable for local dev:
 *   NEXT_PUBLIC_SHOW_QC_COVERAGE=1
 *
 * Data path:
 *   analytics.qcMapping.coverage() →
 *     civica-analytics/qc-mappings/v1/category_mapping.parquet (DuckDB over httpfs)
 *
 * When T5 lands the state-audit app, lift this into the real route.
 */
import { analytics, type QcCategoryCoverage } from "@civica/analytics-engine";

const FEATURE_FLAG = process.env.NEXT_PUBLIC_SHOW_QC_COVERAGE === "1";

export async function QcCategoryCoverage() {
  if (!FEATURE_FLAG) return null;

  let rows: QcCategoryCoverage[];
  try {
    const result = await analytics.qcMapping.coverage();
    rows = result.rows;
  } catch (err) {
    return (
      <div className="rounded border border-hairline p-4 text-sm text-secondary">
        QC coverage unavailable: {(err as Error).message}
      </div>
    );
  }

  const total = rows.length;
  const documented = rows.filter((r) => r.has_civica_control).length;
  const documentedShare = rows
    .filter((r) => r.has_civica_control)
    .reduce((s, r) => s + r.share_of_errored_cases_pct, 0);
  const sorted = [...rows].sort(
    (a, b) => b.share_of_errored_cases_pct - a.share_of_errored_cases_pct,
  );

  return (
    <section
      aria-labelledby="qc-coverage-title"
      className="rounded-lg border border-hairline p-6"
    >
      <header className="mb-4 flex items-baseline justify-between">
        <h2 id="qc-coverage-title" className="text-lg font-semibold">
          QC ELEMENT coverage
        </h2>
        <p className="text-sm text-secondary">
          {documented} / {total} categories documented ·{" "}
          {documentedShare.toFixed(1)}% of weighted error share
        </p>
      </header>

      <ul className="space-y-2">
        {sorted.map((r) => (
          <li
            key={r.element_code}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span
              aria-label={
                r.has_civica_control
                  ? "Civica control documented"
                  : "no Civica control"
              }
              className={
                r.has_civica_control
                  ? "inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700"
                  : "inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber/20 text-amber-dark"
              }
            >
              {r.has_civica_control ? "✓" : "·"}
            </span>
            <span className="flex-1 truncate">{r.cdss_error_category}</span>
            <span className="tabular-nums text-secondary">
              {r.share_of_errored_cases_pct.toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>

      <footer className="mt-4 text-xs text-secondary">
        Source: USDA FNS SNAP QC Public-Use File FY2023 · mapping at{" "}
        <code>data-ops/derived/qc_category_mapping.yaml</code>
      </footer>
    </section>
  );
}
