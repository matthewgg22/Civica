import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createServerClientFromCookies } from "../../lib/supabase";
import { homeForRole } from "../../lib/roleRouting";
import { perExposure } from "../../lib/analytics/section10105";
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

  // Demo mode: all data is demo for now. ?demo=true is informational only.
  const sp = await searchParams;
  const demoParam = sp["demo"];
  const forceDemo = demoParam === "true";
  void forceDemo; // will drive live query post-MVP

  const analytics = perExposure("CA");
  const isDemoMode = analytics.demoMode;

  // §10105 threshold: 105% of national avg.
  const thresholdPER = +(analytics.nationalAvgPER * 1.05).toFixed(2);
  const excessPP = +(analytics.statewidePER - analytics.nationalAvgPER).toFixed(1);

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
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
          {isDemoMode && <DemoModeBadge />}
          <form action="/auth/signout" method="post">
            <button className="text-[13px] font-medium text-pine hover:underline">Sign out</button>
          </form>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* KPI row — 3 cards                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 md:px-8 py-6" aria-label="Key payment error rate metrics">
        {isDemoMode && (
          <p className="text-[11px] text-muted mb-4">
            Showing CA FY2024 demo data. Pass{" "}
            <code className="font-mono bg-surface border border-hairline rounded px-1 py-0.5">
              ?demo=true
            </code>{" "}
            in the URL to confirm demo mode. Live QC pipeline data coming post-MVP.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            label="CA statewide PER (FY2024)"
            value={`${analytics.statewidePER}%`}
            subtext={`${excessPP} pp above national avg — above §10105 penalty threshold`}
            variant="warning"
          />

          <KpiCard
            label="National average PER (FY2024)"
            value={`${analytics.nationalAvgPER}%`}
            subtext={`§10105 threshold at 105%: ${thresholdPER}%`}
            variant="neutral"
          />

          <KpiCard
            label="Civica-enrolled cohort PER"
            value={`${analytics.civicaCohortPER}%`}
            subtext="✓ Below §10105 penalty threshold"
            variant="success"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Error category breakdown                                             */}
      {/* ------------------------------------------------------------------ */}
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
                <CategoryRow
                  label="Unreported income"
                  caBaseline={38}
                  civicaCohort={12}
                />
                <CategoryRow
                  label="Categorical eligibility errors"
                  caBaseline={22}
                  civicaCohort={8}
                />
                <CategoryRow
                  label="Asset verification gaps"
                  caBaseline={19}
                  civicaCohort={6}
                />
                <CategoryRow
                  label="Administrative errors"
                  caBaseline={21}
                  civicaCohort={4}
                />
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-muted mt-4 leading-relaxed">
            Source: CA FNS/HHS QC reports (FY2024). Civica cohort figures are
            derived from verified applicant outcomes in enrolled counties.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* §10105 penalty exposure card                                         */}
      {/* ------------------------------------------------------------------ */}
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
                §10105 penalty exposure
              </p>
              <p
                className="text-3xl font-semibold tabular-nums leading-none mt-1"
                style={{ color: "var(--color-amber)" }}
              >
                ~$510M
              </p>
              <p className="text-[12px] text-graphite mt-2 leading-relaxed">
                FY2028 estimated penalty based on CA statewide PER of{" "}
                {analytics.statewidePER}% exceeding the national average of{" "}
                {analytics.nationalAvgPER}% by {excessPP} pp.
              </p>

              <div className="mt-4 pt-4 border-t border-hairline">
                <p className="text-[12px] font-semibold text-ink mb-1">
                  §10105 methodology
                </p>
                <p className="text-[12px] text-graphite leading-relaxed">
                  States with a PER ≥ 105% of the national average face a
                  proportional loss of federal administrative match. CA's{" "}
                  {analytics.statewidePER}% PER exceeds the{" "}
                  {thresholdPER}% threshold, triggering exposure proportional
                  to CA's share of federal SNAP admin costs (~$850M annually).
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
                  {analytics.civicaCohortPER}% — well below the §10105 penalty
                  threshold. Scaling Civica outreach reduces statewide PER drag
                  and proportionally lowers FY2028 cost-share liability.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Measurement window timeline                                          */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="px-6 md:px-8 pb-8"
        aria-label="§10105 measurement window timeline"
      >
        <div className="border border-hairline rounded-[4px] bg-surface p-5 md:p-6">
          <p className="eyebrow mb-5">Measurement window</p>

          <div className="relative flex flex-col md:flex-row gap-6 md:gap-0">
            {/* Connector line — desktop only */}
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
// KPI card sub-component (server-only, no interactivity needed)
// ---------------------------------------------------------------------------
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
      ? "var(--color-ink)" // Use ink; CSS variable --color-green may not exist
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

// ---------------------------------------------------------------------------
// Error category table row
// ---------------------------------------------------------------------------
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
        <span className="ml-2 text-[11px] text-muted">
          ↓{reduction} pp
        </span>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Timeline step
// ---------------------------------------------------------------------------
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
      {/* Dot */}
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

      {/* Labels */}
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
