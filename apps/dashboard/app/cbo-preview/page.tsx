import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createServerClientFromCookies } from "../../lib/supabase";
import { homeForRole } from "../../lib/roleRouting";
import DemoModeBadge from "../../components/DemoModeBadge";
import CBOContactButton from "../../components/CBOContactButton";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Feature flag — CBO_PREVIEW_ENABLED must be set to render this page.
// If unset: 404.
// Set in Vercel project env or .env.local: CBO_PREVIEW_ENABLED=true
// ---------------------------------------------------------------------------
function cboPreviewEnabled(): boolean {
  const v = process.env.CBO_PREVIEW_ENABLED;
  return v === "true" || v === "1";
}

// ---------------------------------------------------------------------------
// Static demo data — no Supabase query; all content is a sales asset.
// ---------------------------------------------------------------------------
const FUNNEL_STEPS = [
  { name: "Intake", count: 1_240, pct: null },
  { name: "Screened", count: 1_087, pct: "87.7%" },
  { name: "Draft complete", count: 891, pct: "71.9%" },
  { name: "Navigator review", count: 812, pct: "65.5%" },
  { name: "Handoff", count: 764, pct: "61.6%" },
] as const;

// Cut from 6 to 3 cards to (a) drop the AI-template 3-column emoji grid
// (Slop blacklist #2 + #7) and (b) front-load the props a procurement
// reader actually evaluates Civica on: federal penalty avoidance,
// quantified navigator productivity, and out-of-box compliance posture.
const VALUE_PROPS = [
  {
    eyebrow: "Penalty avoidance",
    headline: "PER below the §10105 threshold",
    body:
      "Structured intake catches eligibility errors before submission. Civica cohort runs 4.2% PER vs ~10.8% with manual forms — under the federal payment-error trigger.",
  },
  {
    eyebrow: "Productivity",
    headline: "3× more households per navigator",
    body:
      "AI-assisted Q&A drops intake from ~45 min to ~12 min per applicant. One navigator supports 23 enrollments/month with Civica vs 7 with manual forms.",
  },
  {
    eyebrow: "Audit-ready",
    headline: "CCPA + OBBBA guardrails out of the box",
    body:
      "Consent logging, data retention windows, encryption at rest, role-based access. Configured for California; OBBBA work-requirement updates auto-applied.",
  },
] as const;

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------
export default async function CBOPreviewPage() {
  // Feature flag gate — return 404 if not enabled.
  if (!cboPreviewEnabled()) {
    notFound();
  }

  // Role gate — server component must enforce independently of middleware.
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: unknown } | null)?.role;

  if (typeof role !== "string" || (role !== "cbo_preview" && role !== "admin")) {
    redirect(typeof role === "string" ? homeForRole(role) : "/login");
  }

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <header className="px-6 md:px-8 py-5 border-b border-hairline flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Civica · CBO preview</p>
          <h1 className="text-2xl font-semibold text-ink mt-1.5 tracking-tight">
            Platform preview
          </h1>
          <p className="text-sm text-graphite mt-0.5">
            Read-only demo for prospective licensee CBOs
          </p>
        </div>
        {/* DemoModeBadge always visible — this page is always demo data */}
        <div className="flex items-center gap-4 shrink-0">
          <DemoModeBadge />
          <form action="/auth/signout" method="post">
            <button className="text-[13px] font-medium text-pine hover:underline">Sign out</button>
          </form>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* KPI row — 3 cards                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 md:px-8 py-6" aria-label="Platform impact metrics">
        <p className="eyebrow mb-4">Impact at a glance</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            label="Avg applications / navigator / mo"
            value="23"
            subtext="Without Civica: 7 (manual process)"
            variant="positive"
          />
          <KpiCard
            label="Error rate (Civica cohort)"
            value="4.2%"
            subtext="Without Civica: ~10.8%"
            variant="positive"
          />
          <KpiCard
            label="Avg time to handoff"
            value="6 days"
            subtext="Without Civica: ~22 days"
            variant="positive"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Enrollment funnel                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 md:px-8 py-6" aria-label="Enrollment funnel">
        <p className="eyebrow mb-4">Enrollment funnel (demo cohort, 30 days)</p>
        <div className="flex flex-wrap items-stretch gap-2">
          {FUNNEL_STEPS.map((step, i) => (
            <FunnelStep
              key={step.name}
              name={step.name}
              count={step.count}
              pct={step.pct ?? null}
              isFirst={i === 0}
              isLast={i === FUNNEL_STEPS.length - 1}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted mt-3">
          Conversion % relative to intake (1,240 applicants).
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Value proposition grid                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 md:px-8 py-6" aria-label="Value propositions">
        <p className="eyebrow mb-4">Why CBOs license Civica</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {VALUE_PROPS.map((vp) => (
            <ValuePropCard
              key={vp.headline}
              eyebrow={vp.eyebrow}
              headline={vp.headline}
              body={vp.body}
            />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA / contact card                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 md:px-8 py-6 mt-auto" aria-label="Contact">
        <div
          className="border border-hairline rounded-[4px] bg-surface p-6 md:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-brick) 25%, transparent)",
          }}
        >
          <div>
            <p className="text-base font-semibold text-ink">
              Interested in licensing Civica for your CBO?
            </p>
            <p className="text-sm text-graphite mt-1">
              We partner with community-based organizations serving SNAP-eligible
              households. Reach out to start a conversation.
            </p>
          </div>
          <CBOContactButton />
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// KPI card sub-component
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
  variant: "neutral" | "positive" | "warning";
}) {
  const valueColor =
    variant === "positive"
      ? "var(--color-ink)"
      : variant === "warning"
        ? "var(--color-warning)"
        : "var(--color-ink)";

  const borderStyle =
    variant === "warning"
      ? { borderColor: "color-mix(in srgb, var(--color-warning) 30%, transparent)" }
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
        style={{ color: valueColor }}
      >
        {value}
      </p>
      <p className="text-[12px] text-graphite mt-1.5 leading-relaxed">
        {subtext}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel step sub-component
// ---------------------------------------------------------------------------
function FunnelStep({
  name,
  count,
  pct,
  isFirst,
  isLast,
}: {
  name: string;
  count: number;
  pct: string | null;
  isFirst: boolean;
  isLast: boolean;
}) {
  const isHandoff = isLast;

  return (
    <div className="flex items-center gap-2">
      <div
        className="bg-surface border border-hairline rounded-[4px] px-4 py-3 min-w-[120px]"
        style={
          isHandoff
            ? {
                borderColor:
                  "color-mix(in srgb, var(--color-brick) 30%, transparent)",
              }
            : {}
        }
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {name}
        </p>
        <p className="text-xl font-semibold tabular-nums text-ink mt-1">
          {count.toLocaleString()}
        </p>
        {pct !== null && (
          <p className="text-[11px] text-graphite mt-0.5">{pct}</p>
        )}
        {isFirst && (
          <p className="text-[11px] text-muted mt-0.5">applicants</p>
        )}
      </div>
      {!isLast && (
        <span
          className="text-xl font-light flex-shrink-0"
          style={{ color: "var(--color-graphite)" }}
          aria-hidden="true"
        >
          ›
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value proposition card sub-component
// ---------------------------------------------------------------------------
function ValuePropCard({
  eyebrow,
  headline,
  body,
}: {
  eyebrow: string;
  headline: string;
  body: string;
}) {
  return (
    <div className="bg-surface border border-hairline rounded-[4px] p-6 flex flex-col">
      <p className="eyebrow mb-2">{eyebrow}</p>
      <p className="text-[17px] font-semibold text-ink leading-snug tracking-tight">
        {headline}
      </p>
      <p className="text-[13px] text-graphite mt-3 leading-relaxed">
        {body}
      </p>
    </div>
  );
}
