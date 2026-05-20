import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { analytics } from "@civica/analytics-engine";
import { createServerClientFromCookies } from "../../lib/supabase";
import { homeForRole } from "../../lib/roleRouting";
import { trackPageView } from "../../lib/analytics/events";
import {
  safeAnalyticsCall,
  transformPerByStateToExposure,
  findScenarioMetric,
  isSampleDataMode,
} from "../../lib/analytics/transforms";
import CountyUrgencyBanner from "../../components/CountyUrgencyBanner";
import DemoModeBadge from "../../components/DemoModeBadge";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Feature flag — AUDIT_SURFACE_ENABLED must be set to render this page.
// If unset: 404. Matches the pattern in the state-audit-surface-design spec.
// Set in Vercel project env or .env.local: AUDIT_SURFACE_ENABLED=true
// ---------------------------------------------------------------------------
function auditSurfaceEnabled(): boolean {
  const v = process.env.AUDIT_SURFACE_ENABLED;
  return v === "true" || v === "1";
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

/** Days from today to Oct 1, 2026 (floored, min 0). */
function daysUntilOct1_2026(): number {
  const deadline = new Date("2026-10-01T00:00:00Z");
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------
export default async function CountyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!auditSurfaceEnabled()) {
    notFound();
  }

  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: unknown } | null)?.role;

  if (typeof role !== "string" || (role !== "county_director" && role !== "admin")) {
    redirect(typeof role === "string" ? homeForRole(role) : "/login");
  }

  const actorId = (user as NonNullable<typeof user>).id;
  const profile = (user as NonNullable<typeof user>).user_metadata as
    | { org_id?: string }
    | undefined;

  trackPageView({
    page: "county-10106",
    actorId,
    orgId: profile?.org_id,
  });

  const sp = await searchParams;
  void sp["demo"]; // legacy flag; ignored — sample mode is engine-driven.

  const stateCode = "CA";

  // -------------------------------------------------------------------------
  // Live engine reads. Engine output replaces the old static §10106 demo.
  // -------------------------------------------------------------------------
  const [perResult, adminCostScenarioResult] = await Promise.all([
    safeAnalyticsCall(
      () => analytics.paymentErrorRate.byState({ fy: 2024, state: stateCode }),
      `paymentErrorRate.byState(fy=2024, state=${stateCode})`,
    ),
    safeAnalyticsCall(
      () =>
        analytics.obbbaScenarios.compare({
          metric: "ca_fy28_admin_cost_shift_usd",
        }),
      "obbbaScenarios.compare(ca_fy28_admin_cost_shift_usd)",
    ),
  ]);

  const exposure = perResult
    ? transformPerByStateToExposure(perResult.rows, stateCode)
    : null;

  const adminCostShift = adminCostScenarioResult
    ? findScenarioMetric(
        adminCostScenarioResult.rows,
        "obbba_full",
        "ca_fy28_admin_cost_shift_usd",
      )
    : null;

  const sampleMode = isSampleDataMode();
  const dataUnavailable = !exposure && !adminCostShift;

  const days = daysUntilOct1_2026();

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      <CountyUrgencyBanner daysUntilDeadline={days} />

      <header className="px-6 md:px-8 py-5 border-b border-hairline flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-wider font-medium">
            Civica · County DPSS
          </p>
          <h1 className="text-2xl font-semibold text-ink mt-1.5 tracking-tight">
            §10106 Admin cost-share
          </h1>
          <p className="text-sm text-graphite mt-0.5">
            Federal match: 50% now → 25% from Oct 1, 2026
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {sampleMode && <DemoModeBadge />}
          <form action="/auth/signout" method="post">
            <button className="text-[13px] font-medium text-brick hover:underline">Sign out</button>
          </form>
        </div>
      </header>

      {dataUnavailable && (
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
              Could not read PER or OBBBA scenario data. Set{" "}
              <code className="font-mono bg-paper border border-hairline rounded px-1 py-0.5">
                ANALYTICS_USE_SAMPLE_DATA=true
              </code>{" "}
              for the demo dataset, or upload real parquet per{" "}
              <code className="font-mono">data-ops/README.md</code>.
            </p>
          </div>
        </section>
      )}

      <section className="px-6 md:px-8 py-6" aria-label="Key metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* KPI (a): Current admin share */}
          <KpiCard
            label="Current admin cost-share"
            value="50%"
            subtext="Federal match through Sep 30, 2026"
            variant="neutral"
          />

          {/* KPI (b): Post-§10106 share */}
          <KpiCard
            label="Post-§10106 share"
            value="25%"
            subtext="Effective Oct 1, 2026"
            variant="warning"
          />

          {/* KPI (c): Exposure — engine-driven (obbba_full scenario admin cost shift) */}
          <KpiCard
            label={`Estimated ${stateCode} exposure`}
            value={
              adminCostShift ? formatCurrency(adminCostShift.value) : "—"
            }
            subtext={
              adminCostShift
                ? `Modeled FY28 federal admin cost shift to ${stateCode} (OBBBA-full scenario)`
                : "OBBBA scenario data unavailable"
            }
            variant="warning"
          />
        </div>
      </section>

      <section
        className="px-6 md:px-8 py-4 flex-1"
        aria-label="State-level breakdown"
      >
        <div className="border border-hairline rounded-[4px] bg-surface p-6 md:p-8">
          <p className="eyebrow mb-3">State-level breakdown</p>
          <p className="text-sm text-graphite leading-relaxed">
            County-by-county per-case admin processing cost, applications-per-navigator
            throughput, and projected FY2027 admin cost exposure will appear here.
          </p>
          <p className="text-sm text-graphite mt-2 leading-relaxed">
            State-level breakdown coming soon.
          </p>
          {exposure && (
            <p className="text-xs text-muted mt-4">
              {exposure.stateCode} PER (FY2024): {exposure.statewidePER}% — national
              avg {exposure.nationalAvgPER}% (§10105 threshold {exposure.thresholdPER}%).
            </p>
          )}
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
  variant: "neutral" | "warning";
}) {
  const accentStyle =
    variant === "warning"
      ? { color: "var(--color-amber)" }
      : { color: "var(--color-ink)" };

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
        style={accentStyle}
      >
        {value}
      </p>
      <p className="text-[12px] text-graphite mt-1.5 leading-relaxed">{subtext}</p>
    </div>
  );
}
