import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createServerClientFromCookies } from "../../lib/supabase";
import { homeForRole } from "../../lib/roleRouting";
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

// ---------------------------------------------------------------------------
// Demo data (CA FY2024 placeholders).
// Used when ?demo=true OR when the real analytics pipeline hasn't been wired.
// Real data path: query analytics-engine / Supabase bucket once populated.
// Default: demo mode (pipeline not yet active in staging).
// ---------------------------------------------------------------------------
const DEMO_DATA = {
  // CA FY2024 Payment Error Rate from HHS/FNS SNAP QC report
  caPerFy2024Pct: 7.2,
  // Federal admin cost estimate for CA SNAP administration (placeholder)
  federalAdminCostDollars: 850_000_000,
  // 50% → 25% exposure = 25% of federal admin cost
  exposureDollars: 850_000_000 * 0.25,
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000)
    return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(0)}M`;
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
  // Feature flag gate — return 404 if not enabled.
  if (!auditSurfaceEnabled()) {
    notFound();
  }

  // Role gate — server component must enforce independently of middleware.
  // TODO(post-MVP): also accept shared-link audit_access_tokens (see
  // state-audit-surface-design spec §4.2). For MVP, require Supabase session.
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: unknown } | null)?.role;

  if (typeof role !== "string" || (role !== "county_director" && role !== "admin")) {
    redirect(typeof role === "string" ? homeForRole(role) : "/login");
  }

  // Demo mode: ?demo=true OR default (real pipeline not yet active).
  const sp = await searchParams;
  const demoParam = sp["demo"];
  const isDemoMode = demoParam === "true" || demoParam === undefined;

  const days = daysUntilOct1_2026();

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* T-DR1 + T-DR4: Urgency banner — amber token, NOT brick              */}
      {/* T-DR5: responsive — text wraps on tablet, no overflow               */}
      {/* ------------------------------------------------------------------ */}
      <CountyUrgencyBanner daysUntilDeadline={days} />

      {/* Page header */}
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

        {/* T-DR2: Demo mode badge */}
        {isDemoMode && <DemoModeBadge />}
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* T-DR1 + T-DR5: KPI row                                              */}
      {/* 3-col desktop, 2-col tablet (md), 1-col stacked mobile              */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 md:px-8 py-6" aria-label="Key metrics">
        {isDemoMode && (
          <p className="text-[11px] text-muted mb-4">
            Showing CA FY2024 demo data. Pass{" "}
            <code className="font-mono bg-surface border border-hairline rounded px-1 py-0.5">
              ?demo=false
            </code>{" "}
            to see live data (requires analytics pipeline).
          </p>
        )}

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

          {/* KPI (c): Exposure */}
          <KpiCard
            label="Estimated CA exposure"
            value={
              isDemoMode
                ? formatCurrency(DEMO_DATA.exposureDollars)
                : "Live data loading…"
            }
            subtext={
              isDemoMode
                ? `Based on ~${formatCurrency(DEMO_DATA.federalAdminCostDollars)} federal admin cost (CA FY2024)`
                : "Connect analytics pipeline to populate"
            }
            variant="warning"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* T-DR1: State-level breakdown placeholder                             */}
      {/* ------------------------------------------------------------------ */}
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
          {isDemoMode && (
            <p className="text-xs text-muted mt-4">
              CA PER (FY2024 demo): {DEMO_DATA.caPerFy2024Pct}%
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
