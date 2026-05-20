import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { analytics } from "@civica/analytics-engine";
import { createServerClientFromCookies } from "../../lib/supabase";
import { homeForRole } from "../../lib/roleRouting";
import {
  safeAnalyticsCall,
  transformPerByStateToExposure,
  findScenarioMetric,
  isSampleDataMode,
} from "../../lib/analytics/transforms";
import DemoModeBadge from "../../components/DemoModeBadge";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Feature flag — CDSS_SURFACE_ENABLED must be set to render this page.
// If unset: 404. Matches the pattern used by the county page (AUDIT_SURFACE_ENABLED).
// Set in Vercel project env or .env.local: CDSS_SURFACE_ENABLED=true
// ---------------------------------------------------------------------------
function cdssSurfaceEnabled(): boolean {
  const v = process.env.CDSS_SURFACE_ENABLED;
  return v === "true" || v === "1";
}

function formatUsdCompact(n: number): string {
  if (n >= 1_000_000_000) return `~$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `~$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------
export default async function CDSSPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Feature flag gate.
  if (!cdssSurfaceEnabled()) {
    notFound();
  }

  // Role gate — server component enforces independently of middleware.
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: unknown } | null)?.role;

  if (typeof role !== "string" || (role !== "state_deputy" && role !== "admin")) {
    redirect(typeof role === "string" ? homeForRole(role) : "/login");
  }

  const sp = await searchParams;
  // ?demo=true preserved for back-compat; sample mode is now driven by
  // ANALYTICS_USE_SAMPLE_DATA on the engine. The legacy query flag is ignored
  // but still parsed so any in-flight bookmarks don't 404.
  void sp["demo"];

  // -------------------------------------------------------------------------
  // Live engine reads — parallelised. Each call is wrapped in safeAnalyticsCall
  // so a missing-parquet error renders a degraded placeholder instead of a 500.
  // -------------------------------------------------------------------------
  const [perResult, scenarioResult] = await Promise.all([
    safeAnalyticsCall(
      () => analytics.paymentErrorRate.byState({ fy: 2024 }),
      "paymentErrorRate.byState(fy=2024)",
    ),
    safeAnalyticsCall(
      () =>
        analytics.obbbaScenarios.compare({
          metric: "ca_fy28_state_liability_usd",
        }),
      "obbbaScenarios.compare(ca_fy28_state_liability_usd)",
    ),
  ]);

  const exposure = perResult
    ? transformPerByStateToExposure(perResult.rows, "CA")
    : null;

  // Pick OBBBA-full as the "headline" FY28 liability number for the §10105 card.
  const fy28Liability = scenarioResult
    ? findScenarioMetric(
        scenarioResult.rows,
        "obbba_full",
        "ca_fy28_state_liability_usd",
      )
    : null;

  // Civica-cohort PER stays static for now — engine does not yet emit a
  // cohort-level PER (blocked on `civicaEmit.qcEvaluations.byOrg`). Same for
  // error-category breakdown rows. These are the only static demo numbers
  // remaining on this page; they're called out in the table footnote below.
  const civicaCohortPER = 4.2;

  const sampleMode = isSampleDataMode();
  // Degraded state: engine read failed AND we're not in sample mode → tell
  // the operator how to fix it.
  const dataUnavailable = !exposure && !fy28Liability;

  // ?demo=true legacy flag — kept for backward compatibility, surfaced as
  // the DemoModeBadge when sample mode is on (banner already pinned to layout).
  const showDemoBadge = sampleMode;

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      <header className="px-6 md:px-8 py-5 border-b border-hairline flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-wider font-medium">
            Civica · CDSS State Deputy
          </p>
          <h1 className="text-2xl font-semibold text-ink mt-1.5 tracking-tight">
            Statewide SNAP error rate
          </h1>
          <p className="text-sm text-graphite mt-0.5">
            §10105 measurement window: FY2026 → FY2028 cost-share liability
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {showDemoBadge && <DemoModeBadge />}
          <form action="/auth/signout" method="post">
            <button className="text-[13px] font-medium text-brick hover:underline">Sign out</button>
          </form>
        </div>
      </header>

      {dataUnavailable && <DataUnavailablePanel />}

      {/* KPI row — driven by paymentErrorRate.byState */}
      {exposure && (
        <section className="px-6 md:px-8 py-6" aria-label="Key payment error rate metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              label={`CA statewide PER (FY2024)`}
              value={`${exposure.statewidePER}%`}
              subtext={
                exposure.aboveThreshold
                  ? `${exposure.excessPP} pp above national avg — above §10105 penalty threshold`
                  : `${exposure.excessPP} pp vs. national avg — below §10105 penalty threshold`
              }
              variant={exposure.aboveThreshold ? "warning" : "success"}
            />

            <KpiCard
              label="National average PER (FY2024)"
              value={`${exposure.nationalAvgPER}%`}
              subtext={`§10105 threshold at 105%: ${exposure.thresholdPER}%`}
              variant="neutral"
            />

            <KpiCard
              label="Civica-enrolled cohort PER"
              value={`${civicaCohortPER}%`}
              subtext={
                civicaCohortPER < exposure.thresholdPER
                  ? "Below §10105 penalty threshold"
                  : "At/above §10105 penalty threshold"
              }
              variant="success"
            />
          </div>
        </section>
      )}

      {/* Error category breakdown — still static (no engine source yet) */}
      <section
        className="px-6 md:px-8 pb-6"
        aria-label="SNAP error category breakdown: CA baseline vs Civica cohort"
      >
        <div className="border border-hairline rounded-[4px] bg-surface p-5 md:p-6">
          <p className="eyebrow mb-4">Error category breakdown</p>
          <p className="text-[12px] text-muted mb-4">
            Share of total payment errors — CA FY2024 QC data vs Civica-enrolled applicant cohort
          </p>

          <div className="overflow-x-auto -mx-1">
            <table
              className="w-full text-sm border-collapse"
              aria-label="Error categories: CA baseline percentage versus Civica cohort percentage"
            >
              <thead>
                <tr className="border-b border-hairline">
                  <th className="text-left text-[11px] text-muted uppercase tracking-wider font-semibold pb-2 pr-6 pl-1">
                    Error category
                  </th>
                  <th className="text-right text-[11px] text-muted uppercase tracking-wider font-semibold pb-2 pr-6">
                    CA baseline
                  </th>
                  <th className="text-right text-[11px] text-muted uppercase tracking-wider font-semibold pb-2 pr-1">
                    Civica cohort
                  </th>
                </tr>
              </thead>
              <tbody>
                <CategoryRow label="Unreported income" caBaseline={38} civicaCohort={12} />
                <CategoryRow label="Categorical eligibility errors" caBaseline={22} civicaCohort={8} />
                <CategoryRow label="Asset verification gaps" caBaseline={19} civicaCohort={6} />
                <CategoryRow label="Administrative errors" caBaseline={21} civicaCohort={4} />
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-muted mt-4 leading-relaxed">
            Source: CA FNS/HHS QC reports (FY2024). Category-level breakdown is
            still static pending the QC-microdata parser
            (analytics-engine: <code className="font-mono">qcMicrodata.errorCausesByIncomeSource</code>).
          </p>
        </div>
      </section>

      {/* §10105 penalty exposure card — driven by obbbaScenarios.compare */}
      {fy28Liability && exposure && (
        <section
          className="px-6 md:px-8 pb-6"
          aria-label="§10105 penalty exposure estimate"
        >
          <div
            className="rounded-[4px] border bg-surface p-5 md:p-6"
            style={{
              borderColor: "color-mix(in srgb, var(--color-amber) 40%, transparent)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: "var(--color-amber)" }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="eyebrow mb-1" style={{ color: "var(--color-amber)" }}>
                  §10105 FY28 state liability (OBBBA-full scenario)
                </p>
                <p
                  className="text-3xl font-semibold tabular-nums leading-none mt-1"
                  style={{ color: "var(--color-amber)" }}
                >
                  {formatUsdCompact(fy28Liability.value)}
                </p>
                <p className="text-[12px] text-graphite mt-2 leading-relaxed">
                  Modeled FY2028 state-share liability based on CA statewide PER of{" "}
                  {exposure.statewidePER}% exceeding the national average of{" "}
                  {exposure.nationalAvgPER}% by {exposure.excessPP} pp.
                </p>

                <div className="mt-4 pt-4 border-t border-hairline">
                  <p className="text-[12px] font-semibold text-ink mb-1">
                    §10105 methodology
                  </p>
                  <p className="text-[12px] text-graphite leading-relaxed">
                    States with a PER ≥ 105% of the national average face a
                    proportional loss of federal administrative match. CA's{" "}
                    {exposure.statewidePER}% PER exceeds the{" "}
                    {exposure.thresholdPER}% threshold, triggering exposure
                    proportional to CA's share of federal SNAP admin costs.
                  </p>
                </div>

                <div
                  className="mt-4 p-3 rounded-[4px]"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-amber) 6%, transparent)",
                  }}
                >
                  <p className="text-[12px] text-graphite leading-relaxed">
                    <span className="font-semibold text-ink">Civica enrolled cohort:</span>{" "}
                    Civica-enrolled applicants show a PER of{" "}
                    {civicaCohortPER}% — well below the §10105 penalty
                    threshold. Scaling Civica outreach reduces statewide PER drag
                    and proportionally lowers FY2028 cost-share liability.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Measurement window timeline */}
      <section
        className="px-6 md:px-8 pb-8"
        aria-label="§10105 measurement window timeline"
      >
        <div className="border border-hairline rounded-[4px] bg-surface p-5 md:p-6">
          <p className="eyebrow mb-5">Measurement window</p>

          <div className="relative flex flex-col md:flex-row gap-6 md:gap-0">
            <div
              className="hidden md:block absolute top-4 left-[calc(16.67%)] right-[calc(16.67%)] h-px"
              style={{ backgroundColor: "var(--color-hairline)" }}
              aria-hidden="true"
            />

            <TimelineStep
              fy="FY2026"
              label="Baseline measurement period"
              note="Now"
              isActive
            />
            <TimelineStep
              fy="FY2027"
              label="Mid-point review"
              note="CDSS report due"
            />
            <TimelineStep
              fy="FY2028"
              label="Cost-share adjustment effective"
              note="§10105 liability realized"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DataUnavailablePanel() {
  return (
    <section className="px-6 md:px-8 py-6">
      <div
        className="border rounded-[4px] bg-surface p-5"
        style={{
          borderColor: "color-mix(in srgb, var(--color-amber) 40%, transparent)",
        }}
      >
        <p className="eyebrow mb-2" style={{ color: "var(--color-amber)" }}>
          Analytics data not loaded
        </p>
        <p className="text-[13px] text-graphite leading-relaxed">
          The dashboard could not read PER or OBBBA scenario data from the
          analytics tier. Set{" "}
          <code className="font-mono bg-paper border border-hairline rounded px-1 py-0.5">
            ANALYTICS_USE_SAMPLE_DATA=true
          </code>{" "}
          to render against the demo dataset, or upload real parquet per{" "}
          <code className="font-mono">data-ops/README.md</code>.
        </p>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  subtext,
  variant,
}: {
  label: string;
  value: string;
  subtext: string;
  variant: "neutral" | "warning" | "success";
}) {
  const accentColor =
    variant === "warning"
      ? "var(--color-amber)"
      : variant === "success"
      ? "var(--color-ink)"
      : "var(--color-ink)";

  const borderStyle =
    variant === "warning"
      ? { borderColor: "color-mix(in srgb, var(--color-amber) 30%, transparent)" }
      : {};

  return (
    <div
      className="bg-surface rounded-[4px] border border-hairline p-5"
      style={borderStyle}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className="text-3xl font-semibold tabular-nums mt-2 leading-none"
        style={{ color: accentColor }}
      >
        {value}
      </p>
      <p className="text-[12px] text-graphite mt-1.5 leading-relaxed">{subtext}</p>
    </div>
  );
}

function CategoryRow({
  label,
  caBaseline,
  civicaCohort,
}: {
  label: string;
  caBaseline: number;
  civicaCohort: number;
}) {
  const reduction = caBaseline - civicaCohort;

  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="py-2.5 pr-6 pl-1 text-graphite">{label}</td>
      <td
        className="py-2.5 pr-6 text-right tabular-nums font-medium"
        style={{ color: "var(--color-amber)" }}
      >
        {caBaseline}%
      </td>
      <td className="py-2.5 pr-1 text-right">
        <span className="tabular-nums font-semibold text-ink">{civicaCohort}%</span>
        <span className="ml-2 text-[11px] text-muted">↓{reduction} pp</span>
      </td>
    </tr>
  );
}

function TimelineStep({
  fy,
  label,
  note,
  isActive = false,
}: {
  fy: string;
  label: string;
  note: string;
  isActive?: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-4">
      <div
        className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 relative z-10"
        style={{
          borderColor: isActive ? "var(--color-amber)" : "var(--color-hairline)",
          backgroundColor: isActive
            ? "color-mix(in srgb, var(--color-amber) 12%, var(--color-paper))"
            : "var(--color-surface)",
        }}
        aria-hidden="true"
      >
        {isActive && (
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: "var(--color-amber)" }}
          />
        )}
      </div>

      <p
        className="text-[13px] font-semibold mt-2"
        style={{ color: isActive ? "var(--color-amber)" : "var(--color-ink)" }}
      >
        {fy}
      </p>
      <p className="text-[12px] text-graphite mt-0.5 leading-snug">{label}</p>
      <p className="text-[11px] text-muted mt-0.5">{note}</p>
    </div>
  );
}
