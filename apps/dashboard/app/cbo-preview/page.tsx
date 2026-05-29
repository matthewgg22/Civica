import KpiCard from "../../components/KpiCard";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import DemoModeBadge from "../../components/DemoModeBadge";
import CBOContactButton from "../../components/CBOContactButton";
import StatusPill from "../../components/StatusPill";
import StatusBadge from "../../components/StatusBadge";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Feature flag — CBO_PREVIEW_ENABLED must be set to render this page.
// If unset: 404. Lets the page ship dark and turn on for partnership pushes.
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

// Sample packets — illustrative rows that mirror the real navigator queue
// styling (StatusBadge circle + applicant + county + StatusPill + risk dot
// + time-ago) without any Supabase query. Three rows chosen to show the
// most common navigator-facing states: needs-attention, in-review, and
// ready-for-handoff. Risk tiers split low/medium so the dot pattern is
// visible in the snapshot.
// badge bg + glyph are derived from `status` by the shared StatusBadge
// component, so only status/risk/identity fields live on the sample row.
// Each `id` is a real demo packet ID handled by getDemoPacketDetail() in
// lib/demo-data.ts. Clicking a row navigates to /packets/<id>, which is
// allowed through middleware via the `/packets/demo-pkt-` entry in
// FULLY_PUBLIC_PREFIXES — so prospective CBOs land directly on the
// navigator review surface without an auth wall.
const SAMPLE_PACKETS = [
  {
    id: "demo-pkt-003-jasmine",
    shortId: "jasmine",
    applicantName: "Jasmine T.",
    county: "Los Angeles",
    status: "Needs Documents",
    riskLabel: "Medium risk",
    riskDotBg: "bg-warning",
    timeAgo: "2h ago",
  },
  {
    id: "demo-pkt-002-carlos",
    shortId: "carlos",
    applicantName: "Carlos R.",
    county: "Fresno",
    status: "In Navigator Review",
    riskLabel: "Medium risk",
    riskDotBg: "bg-warning",
    timeAgo: "5h ago",
  },
  {
    id: "demo-pkt-001-maria",
    shortId: "maria",
    applicantName: "Maria G.",
    county: "Alameda",
    status: "Ready for Handoff",
    riskLabel: "Low risk",
    riskDotBg: "bg-teal",
    timeAgo: "1d ago",
  },
] as const;

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------
export default async function CBOPreviewPage() {
  // Feature flag gate — return 404 if not enabled. Page is public when on
  // (no role gate; middleware bypasses auth via FULLY_PUBLIC_PREFIXES).
  if (!cboPreviewEnabled()) {
    notFound();
  }

  // Auth read is informational only — used to decide whether to show the
  // Sign-out button. Anonymous visitors render the page without it.
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        {/* DemoModeBadge always visible — this page is always demo data.
            Sign-out only renders for authenticated visitors. */}
        <div className="flex items-center gap-4 shrink-0">
          <DemoModeBadge />
          {user && (
            <form action="/auth/signout" method="post">
              <button className="text-[13px] font-medium text-pine hover:underline">Sign out</button>
            </form>
          )}
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
            variant="neutral"
          />
          <KpiCard
            label="Error rate (Civica cohort)"
            value="4.2%"
            subtext="Without Civica: ~10.8%"
            variant="neutral"
          />
          <KpiCard
            label="Avg time to handoff"
            value="6 days"
            subtext="Without Civica: ~22 days"
            variant="neutral"
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
      {/* Sample queue — clickable rows into the navigator review surface     */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 md:px-8 py-6" aria-label="Sample navigator queue">
        <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
          <p className="eyebrow">What navigators see · sample queue</p>
          <p className="text-[12px] text-graphite">
            Click a row to open the packet review surface →
          </p>
        </div>
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {SAMPLE_PACKETS.map((p, i) => (
            <Link
              key={p.id}
              href={`/packets/${p.id}`}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-paper focus-visible:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine/30 transition-colors ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <StatusBadge status={p.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-[15px] font-semibold text-ink">{p.applicantName}</p>
                  <p className="text-[14px] text-graphite">{p.county}, CA</p>
                  <span className="text-[11px] text-muted font-mono tabular-nums">{p.shortId}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusPill status={p.status} />
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.riskDotBg}`} />
                    <span className="text-muted">{p.riskLabel}</span>
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 flex items-center gap-3">
                <div>
                  <p className="text-[13px] tabular-nums font-medium text-graphite">{p.timeAgo}</p>
                  <p className="text-[11px] text-muted uppercase tracking-wider mt-0.5">updated</p>
                </div>
                <span aria-hidden="true" className="text-muted text-[14px]">→</span>
              </div>
            </Link>
          ))}
        </div>
        <p className="text-[11px] text-muted mt-3">
          Sample data — synthetic packets seeded from <code className="font-mono">demo-data.ts</code>. No real applicant information is shown.
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

// KpiCard extracted to ../../components/KpiCard.tsx per /plan-design-review
// T10. Imported at the top of this file.

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
