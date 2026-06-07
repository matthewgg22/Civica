import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import CBOContactButton from "../../components/CBOContactButton";
import StatusPill from "../../components/StatusPill";
import StatusBadge from "../../components/StatusBadge";
import ProductSwitcher from "../../components/ProductSwitcher";
import QcTab from "../../components/cbo/QcTab";
import ApplicationsQueue from "../../components/cbo/ApplicationsQueue";
import { buildPipeline } from "../../lib/cbo/demo-pipeline";

export const dynamic = "force-dynamic";

function cboPreviewEnabled(): boolean {
  const v = process.env.CBO_PREVIEW_ENABLED;
  return v === "true" || v === "1";
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const FUNNEL_STEPS = [
  { name: "Intake",            count: 1_240, pct: null },
  { name: "Screened",          count: 1_087, pct: "87.7%" },
  { name: "Draft complete",    count: 891,   pct: "71.9%" },
  { name: "Navigator review",  count: 812,   pct: "65.5%" },
  { name: "Handoff",           count: 764,   pct: "61.6%" },
] as const;

const TABS = [
  { key: "overview", label: "Overview"        },
  { key: "pipeline", label: "Pipeline"        },
  { key: "qc",       label: "Quality Control" },
] as const;

type TabKey = typeof TABS[number]["key"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CBOPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  if (!cboPreviewEnabled()) notFound();

  const params = await searchParams;
  // Unknown / retired sections (e.g. a stale ?section=outreach link) fall back
  // to Overview rather than rendering an empty body.
  const requested = params.section as TabKey | undefined;
  const active: TabKey = TABS.some((t) => t.key === requested) ? (requested as TabKey) : "overview";

  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      {/* Unified nav bar — matches the staff AppHeader design */}
      <header className="bg-surface border-b border-hairline px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/cbo-preview" className="shrink-0 hover:opacity-90 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/civica-wheat-mark.png" alt="Civica" width={50} height={50} className="w-[50px] h-[50px] object-contain" />
            </Link>
            <div>
              <Link href="/cbo-preview" className="block text-[17px] font-semibold tracking-tight text-ink leading-none hover:opacity-80 transition-opacity">
                Civica
              </Link>
              <div className="mt-0.5">
                <ProductSwitcher currentHref="/cbo-preview" />
              </div>
            </div>
          </div>
          {/* Section tabs */}
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Preview sections">
            {TABS.map((tab) => {
              const isActive = active === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={`/cbo-preview${tab.key === "overview" ? "" : `?section=${tab.key}`}`}
                  className={`px-3 py-1.5 rounded-[2px] text-[14px] font-semibold whitespace-nowrap min-h-[44px] flex items-center transition-colors ${
                    isActive ? "bg-ink/8 text-ink" : "text-graphite hover:text-ink hover:bg-ink/5"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <form action="/auth/signout" method="post">
              <button className="text-[13px] font-medium text-pine hover:underline">Sign out</button>
            </form>
          )}
        </div>
      </header>

      {/* Mobile section tabs — horizontal scroll below the bar */}
      <nav className="md:hidden bg-surface border-b border-hairline px-4 overflow-x-auto scrollbar-none" aria-label="Preview sections">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/cbo-preview${tab.key === "overview" ? "" : `?section=${tab.key}`}`}
                className={`px-3 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive ? "border-pine text-ink" : "border-transparent text-graphite"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Page title + section content — centered max-width (fix A) */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-6 md:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-[26px] font-bold tracking-tight leading-none text-ink mt-1">
            {TABS.find((t) => t.key === active)?.label ?? "Overview"}
          </h1>
        </div>
        {active === "overview"     && <OverviewSection />}
        {active === "pipeline" && <ApplicationsSection />}
        {active === "qc"           && <QcTab />}
        <p className="text-[11px] text-graphite mt-10">Sample data shown for demonstration.</p>
      </div>

      {/* Contact CTA — always visible, centered */}
      <div className="border-t border-hairline">
        <div className="w-full max-w-6xl mx-auto px-6 md:px-8 py-6">
          <div className="border border-hairline rounded-[2px] bg-surface p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold text-ink">Interested in licensing Civica for your CBO?</p>
              <p className="text-[13px] text-graphite mt-1">We partner with community-based organizations serving SNAP-eligible households.</p>
            </div>
            <CBOContactButton />
          </div>
        </div>
      </div>

    </main>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewSection() {
  const funnelMax = FUNNEL_STEPS[0].count;
  return (
    <div className="space-y-8">
      {/* KPIs — compact (fix C) */}
      <section aria-label="Impact at a glance">
        <p className="eyebrow mb-3">Impact at a glance</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Avg applications / navigator / mo", value: "23",     sub: "vs 7 manual" },
            { label: "Error rate (Civica cohort)",        value: "4.2%",   sub: "vs ~10.8% manual" },
            { label: "Avg time to handoff",               value: "6 days", sub: "vs ~22 days manual" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-surface border border-hairline rounded-[2px] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite leading-tight">{kpi.label}</p>
              <p className="text-[28px] font-semibold tabular-nums text-ink leading-none mt-2">{kpi.value}</p>
              <p className="text-[12px] text-pine font-medium mt-1.5">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Funnel — full-width proportional bars (fix B) */}
      <section aria-label="Enrollment funnel">
        <p className="eyebrow mb-3">Enrollment funnel (last 30 days)</p>
        <div className="bg-surface border border-hairline rounded-[2px] p-4 space-y-3">
          {FUNNEL_STEPS.map((step, i) => (
            <div key={step.name}>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="text-[13px] font-semibold text-ink">{step.name}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold tabular-nums text-ink">{step.count.toLocaleString()}</span>
                  {step.pct && <span className="text-[12px] text-graphite tabular-nums w-12 text-right">{step.pct}</span>}
                </span>
              </div>
              <div className="h-2.5 bg-paper rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${i === FUNNEL_STEPS.length - 1 ? "bg-pine" : "bg-pine/55"}`}
                  style={{ width: `${(step.count / funnelMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-graphite mt-2">Conversion % relative to intake (1,240 applicants).</p>
      </section>

      {/* Sample queue preview */}
      <section aria-label="Sample navigator queue">
        <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
          <p className="eyebrow">What navigators see</p>
          <Link href="/cbo-preview?section=pipeline" className="text-[12px] text-pine hover:underline">
            See full applications view →
          </Link>
        </div>
        <div className="bg-surface border border-hairline rounded-[2px] overflow-hidden">
          {[
            { id: "demo-pkt-003-jasmine", shortId: "CF-2026-0188", name: "Jasmine T.", county: "Los Angeles", status: "Needs Documents",      risk: "Medium risk", riskBg: "bg-warning", time: "2h ago" },
            { id: "demo-pkt-002-carlos",  shortId: "CF-2026-0203", name: "Carlos R.", county: "Fresno",       status: "In Navigator Review", risk: "Medium risk", riskBg: "bg-warning", time: "5h ago" },
            { id: "demo-pkt-001-maria",   shortId: "CF-2026-0179", name: "Maria G.",  county: "Alameda",      status: "Ready for Handoff",   risk: "Low risk",    riskBg: "bg-pine",    time: "1d ago" },
          ].map((p, i) => (
            <QueueRow key={p.id} {...p} border={i > 0} />
          ))}
        </div>
      </section>

      {/* Value props */}
      <section aria-label="Value propositions">
        <p className="eyebrow mb-4">Why CBOs license Civica</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { eyebrow: "Penalty avoidance",  headline: "PER below the §10105 threshold",        body: "Structured intake catches eligibility errors before submission. Civica cohort runs 4.2% PER vs ~10.8% with manual forms — under the federal payment-error trigger." },
            { eyebrow: "Productivity",        headline: "3× more households per navigator",      body: "AI-assisted Q&A drops intake from ~45 min to ~12 min per applicant. One navigator supports 23 enrollments/month with Civica vs 7 with manual forms." },
            { eyebrow: "Audit-ready",          headline: "CCPA + OBBBA guardrails out of the box", body: "Consent logging, data retention windows, encryption at rest, role-based access. Configured for California; OBBBA work-requirement updates auto-applied." },
          ].map((vp) => (
            <div key={vp.headline} className="bg-surface border border-hairline rounded-[2px] p-5 flex flex-col">
              <p className="eyebrow mb-2">{vp.eyebrow}</p>
              <p className="text-[17px] font-semibold text-ink leading-snug tracking-tight">{vp.headline}</p>
              <p className="text-[13px] text-graphite mt-3 leading-relaxed">{vp.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Applications ──────────────────────────────────────────────────────────────

function ApplicationsSection() {
  // Server-side: run each synthetic applicant through the REAL engine, grouped
  // by lifecycle phase (Requesting → Live → Enrolled → Recertification).
  const phases = buildPipeline("CA", new Date());
  return <ApplicationsQueue phases={phases} />;
}

// ─── Quality Control ───────────────────────────────────────────────────────────

// ─── Shared sub-components ────────────────────────────────────────────────────

function QueueRow({
  id, shortId, name, county, status, risk, riskBg, time, border,
}: {
  id: string; shortId: string; name: string; county: string;
  status: string; risk: string; riskBg: string; time: string; border?: boolean;
}) {
  return (
    <Link
      href={`/packets/${id}`}
      className={`flex items-center gap-4 px-5 py-4 hover:bg-paper transition-colors ${border ? "border-t border-hairline" : ""}`}
    >
      <StatusBadge status={status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[11px] text-graphite font-mono tabular-nums tracking-tight">{shortId}</span>
          <p className="text-[15px] font-semibold text-ink">{name}</p>
          <p className="text-[13px] text-graphite">· {county} County, CA</p>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <StatusPill status={status} />
          {(risk === "Medium risk" || risk === "High risk") && (
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${risk === "High risk" ? "text-brick" : "text-warning"}`}>
              {risk}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[13px] tabular-nums font-medium text-graphite">{time}</p>
        <p className="text-[11px] text-graphite uppercase tracking-wider mt-0.5">updated</p>
      </div>
    </Link>
  );
}
