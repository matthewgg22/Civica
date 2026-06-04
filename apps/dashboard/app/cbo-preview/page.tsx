import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import DemoModeBadge from "../../components/DemoModeBadge";
import CBOContactButton from "../../components/CBOContactButton";
import StatusPill from "../../components/StatusPill";
import StatusBadge from "../../components/StatusBadge";
import ProductSwitcher from "../../components/ProductSwitcher";

export const dynamic = "force-dynamic";

function cboPreviewEnabled(): boolean {
  const v = process.env.CBO_PREVIEW_ENABLED;
  return v === "true" || v === "1";
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_QUEUE: {
  bucket: string; bucketLabel: string; accent: string; count: number;
  rows: { id: string; shortId: string; name: string; county: string; status: string; risk: string; riskBg: string; time: string }[];
}[] = [
  {
    bucket: "needs-attention", bucketLabel: "Needs Attention", accent: "bg-warning", count: 0,
    rows: [
      { id: "demo-pkt-003-jasmine", shortId: "JASMINE", name: "Jasmine T.", county: "Los Angeles",   status: "Needs Documents",               risk: "Medium risk", riskBg: "bg-warning", time: "1d ago" },
      { id: "demo-pkt-elena",       shortId: "9ELENA",  name: "Elena V.",   county: "San Francisco", status: "Needs Applicant Clarification", risk: "High risk",   riskBg: "bg-brick",   time: "2d ago" },
    ],
  },
  {
    bucket: "in-progress", bucketLabel: "In Progress", accent: "bg-indigo", count: 0,
    rows: [
      { id: "demo-pkt-002-carlos", shortId: "CARLOS", name: "Carlos R.", county: "Fresno",     status: "In Navigator Review",  risk: "Medium risk", riskBg: "bg-warning", time: "5h ago" },
      { id: "demo-pkt-sofia",      shortId: "SOFIA",  name: "Sofia M.",  county: "Sacramento", status: "Submitted for Review", risk: "Low risk",    riskBg: "bg-pine",    time: "1d ago" },
      { id: "demo-pkt-marcus",     shortId: "MARCUS", name: "Marcus W.", county: "Oakland",    status: "In Navigator Review",  risk: "Medium risk", riskBg: "bg-warning", time: "3d ago" },
    ],
  },
  {
    bucket: "ready", bucketLabel: "Ready for Handoff", accent: "bg-teal", count: 0,
    rows: [
      { id: "demo-pkt-001-maria", shortId: "MARIA", name: "Maria G.", county: "Alameda", status: "Ready for Handoff", risk: "Low risk", riskBg: "bg-pine", time: "1d ago" },
    ],
  },
  {
    bucket: "complete", bucketLabel: "Complete", accent: "bg-pine", count: 36,
    rows: [],
  },
];

const DEMO_OUTREACH = {
  applications: [
    { name: "David L.",    county: "Sacramento",    reason: "Stalled 6 days — income docs missing",    urgency: "high"   as const },
    { name: "Priya S.",    county: "San Diego",     reason: "Stalled 4 days — SSN clarification needed", urgency: "medium" as const },
    { name: "Robert M.",   county: "Riverside",     reason: "Started 3 days ago, no progress",         urgency: "medium" as const },
    { name: "Carmen F.",   county: "Fresno",        reason: "Stalled 8 days — household size conflict", urgency: "high"   as const },
  ],
  interview: [
    { name: "James K.",    county: "San Jose",  status: "Interview scheduled 2d ago — no completion logged", urgency: "high"   as const },
    { name: "Amara N.",    county: "Stockton",  status: "Interview scheduled tomorrow",                      urgency: "low"    as const },
    { name: "Luis G.",     county: "Modesto",   status: "Passed interview — awaiting final review",          urgency: "medium" as const },
  ],
  recertification: [
    { name: "Patricia W.", county: "Los Angeles",  daysLeft: -3,  stage: "Overdue"        },
    { name: "Henry O.",    county: "Bakersfield",  daysLeft: -7,  stage: "Overdue"        },
    { name: "Mei L.",      county: "San Jose",     daysLeft: 8,   stage: "7-day cadence"  },
    { name: "Samuel R.",   county: "Fresno",       daysLeft: 12,  stage: "14-day cadence" },
    { name: "Yolanda B.",  county: "Sacramento",   daysLeft: 25,  stage: "30-day cadence" },
    { name: "Omar A.",     county: "Oakland",      daysLeft: 48,  stage: "60-day cadence" },
  ],
};

const DEMO_RENEWALS = {
  overdue: 12,
  expiring30: 24,
  expiring60: 31,
  cadenceRows: [
    { stage: "Overdue",        count: 12, color: "bg-brick",    label: "Past cert end date — immediate action" },
    { stage: "7-day cadence",  count: 8,  color: "bg-warning",  label: "Final window — in-person or warm transfer" },
    { stage: "14-day cadence", count: 11, color: "bg-warning",  label: "Confirm by phone, walk through portal" },
    { stage: "30-day cadence", count: 24, color: "bg-amber",    label: "Reminder + schedule check-in" },
    { stage: "60-day cadence", count: 31, color: "bg-pine/60",  label: "First notice sent" },
  ],
  sampleRows: [
    { name: "Patricia W.", county: "Los Angeles",  certEnd: "2026-06-01",  stage: "Overdue",        daysLeft: -3  },
    { name: "Samuel R.",   county: "Fresno",       certEnd: "2026-06-16",  stage: "7-day cadence",  daysLeft: 12  },
    { name: "Yolanda B.",  county: "Sacramento",   certEnd: "2026-06-29",  stage: "30-day cadence", daysLeft: 25  },
    { name: "Omar A.",     county: "Oakland",      certEnd: "2026-08-03",  stage: "60-day cadence", daysLeft: 59  },
  ],
};

const DEMO_QC = {
  per: 4.2,
  perBenchmark: 10.8,
  obbbaReady: 94,
  pillars: [
    { label: "Income verification",     pass: 96, fail: 4,  note: "§10104 threshold" },
    { label: "Household composition",   pass: 98, fail: 2,  note: "Citizenship + residency" },
    { label: "Work requirements",       pass: 91, fail: 9,  note: "ABAWD + §10108 exemptions" },
    { label: "Deduction calculation",   pass: 89, fail: 11, note: "SUA + shelter" },
  ],
  recentFlags: [
    { id: "QC-0041", field: "Gross income",   issue: "Self-employment income missing quarterly average",  status: "Open"     },
    { id: "QC-0040", field: "Shelter deduction", issue: "Rent amount exceeds SUA cap without documentation", status: "Resolved" },
    { id: "QC-0039", field: "Household size",  issue: "Household member added mid-period, proration needed", status: "Open"     },
  ],
};

const FUNNEL_STEPS = [
  { name: "Intake",            count: 1_240, pct: null },
  { name: "Screened",          count: 1_087, pct: "87.7%" },
  { name: "Draft complete",    count: 891,   pct: "71.9%" },
  { name: "Navigator review",  count: 812,   pct: "65.5%" },
  { name: "Handoff",           count: 764,   pct: "61.6%" },
] as const;

const TABS = [
  { key: "overview",     label: "Overview"        },
  { key: "applications", label: "Applications"    },
  { key: "outreach",     label: "Outreach"        },
  { key: "renewals",     label: "Renewals"        },
  { key: "qc",           label: "Quality Control" },
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
  const active = (params.section as TabKey) ?? "overview";

  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-paper flex flex-col">
      {/* Unified nav bar — matches the staff AppHeader design */}
      <header className="bg-surface border-b border-hairline px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/cbo-preview" className="shrink-0 hover:opacity-90 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/civica-wheat-mark.png" alt="Civica" width={44} height={44} className="w-[44px] h-[44px] object-contain" />
            </Link>
            <div>
              <Link href="/cbo-preview" className="block text-[16px] font-semibold tracking-tight text-ink leading-none hover:opacity-80 transition-opacity">
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
                  className={`px-3 py-1.5 rounded-[4px] text-[14px] font-semibold whitespace-nowrap min-h-[44px] flex items-center transition-colors ${
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
          <DemoModeBadge />
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
          <p className="eyebrow">Read-only demo for prospective licensee CBOs</p>
          <h1 className="text-[26px] font-bold tracking-tight leading-none text-ink mt-1">
            {TABS.find((t) => t.key === active)?.label ?? "Overview"}
          </h1>
        </div>
        {active === "overview"     && <OverviewSection />}
        {active === "applications" && <ApplicationsSection />}
        {active === "outreach"     && <OutreachSection />}
        {active === "renewals"     && <RenewalsSection />}
        {active === "qc"           && <QCSection />}
      </div>

      {/* Contact CTA — always visible, centered */}
      <div className="border-t border-hairline">
        <div className="w-full max-w-6xl mx-auto px-6 md:px-8 py-6">
          <div className="border border-hairline rounded-[4px] bg-surface p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
            <div key={kpi.label} className="bg-surface border border-hairline rounded-[4px] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite leading-tight">{kpi.label}</p>
              <p className="text-[28px] font-semibold tabular-nums text-ink leading-none mt-2">{kpi.value}</p>
              <p className="text-[12px] text-pine font-medium mt-1.5">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Funnel — full-width proportional bars (fix B) */}
      <section aria-label="Enrollment funnel">
        <p className="eyebrow mb-3">Enrollment funnel (demo cohort, 30 days)</p>
        <div className="bg-surface border border-hairline rounded-[4px] p-5 space-y-3">
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
          <p className="eyebrow">What navigators see · sample queue</p>
          <Link href="/cbo-preview?section=applications" className="text-[12px] text-pine hover:underline">
            See full applications view →
          </Link>
        </div>
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {[
            { id: "demo-pkt-003-jasmine", shortId: "JASMINE", name: "Jasmine T.", county: "Los Angeles", status: "Needs Documents",      risk: "Medium risk", riskBg: "bg-warning", time: "2h ago" },
            { id: "demo-pkt-002-carlos",  shortId: "CARLOS",  name: "Carlos R.", county: "Fresno",       status: "In Navigator Review", risk: "Medium risk", riskBg: "bg-warning", time: "5h ago" },
            { id: "demo-pkt-001-maria",   shortId: "MARIA",   name: "Maria G.",  county: "Alameda",      status: "Ready for Handoff",   risk: "Low risk",    riskBg: "bg-pine",    time: "1d ago" },
          ].map((p, i) => (
            <QueueRow key={p.id} {...p} border={i > 0} />
          ))}
        </div>
        <p className="text-[11px] text-graphite mt-3">Sample data — synthetic packets. No real applicant information is shown.</p>
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
            <div key={vp.headline} className="bg-surface border border-hairline rounded-[4px] p-6 flex flex-col">
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
  const total = DEMO_QUEUE.reduce((s, b) => s + (b.rows.length || b.count), 0);
  return (
    <div className="space-y-5">
      {/* Stat chips */}
      <div className="flex items-center gap-3 flex-wrap">
        {DEMO_QUEUE.map((bucket) => {
          const count = bucket.rows.length || bucket.count;
          return (
            <div key={bucket.bucket} className="bg-surface border border-hairline rounded-[4px] px-4 py-2.5 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${bucket.accent}`} />
              <span className="text-[13px] font-semibold text-ink tabular-nums">{count}</span>
              <span className="text-[12px] text-graphite">{bucket.bucketLabel}</span>
            </div>
          );
        })}
        <div className="bg-surface border border-hairline rounded-[4px] px-4 py-2.5">
          <span className="text-[12px] text-graphite">Active total: </span>
          <span className="text-[13px] font-semibold text-ink tabular-nums">{total}</span>
        </div>
      </div>

      {/* Buckets */}
      {DEMO_QUEUE.map((bucket) => {
        const count = bucket.rows.length || (bucket as { count?: number }).count || 0;
        if (count === 0) return null;
        return (
          <section key={bucket.bucket} aria-label={bucket.bucketLabel}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2.5 h-5 rounded-sm ${bucket.accent}`} />
              <h2 className="text-[14px] font-bold text-ink">{bucket.bucketLabel}</h2>
              <span className="text-[13px] text-muted tabular-nums">{count}</span>
            </div>
            <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
              {bucket.rows.length > 0 ? (
                bucket.rows.map((p, i) => <QueueRow key={p.id} {...p} border={i > 0} />)
              ) : (
                <div className="px-5 py-4 text-[13px] text-muted italic">
                  {bucket.count} completed applications in the last 90 days.
                </div>
              )}
            </div>
          </section>
        );
      })}
      <p className="text-[11px] text-graphite">Sample data — synthetic packets. No real applicant information is shown.</p>
    </div>
  );
}

// ─── Outreach ──────────────────────────────────────────────────────────────────

function OutreachSection() {
  return (
    <div className="space-y-6">
      {/* Applications bucket */}
      <section aria-label="Stalled applications">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-bold text-ink flex items-center gap-2">
            <span className="w-2.5 h-5 rounded-sm bg-warning" />
            Applications
            <span className="text-[13px] text-muted font-normal">{DEMO_OUTREACH.applications.length} needing follow-up</span>
          </h2>
        </div>
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {DEMO_OUTREACH.applications.map((row, i) => (
            <div key={row.name} className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${row.urgency === "high" ? "bg-brick" : "bg-warning"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-ink">{row.name} <span className="text-[13px] font-normal text-graphite">· {row.county}, CA</span></p>
                <p className="text-[12px] text-muted mt-0.5">{row.reason}</p>
              </div>
              <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm ${row.urgency === "high" ? "bg-brick/10 text-brick" : "bg-warning/10 text-warning"}`}>
                {row.urgency === "high" ? "High" : "Medium"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Interview bucket */}
      <section aria-label="Interview lifecycle">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-5 rounded-sm bg-indigo" />
          <h2 className="text-[14px] font-bold text-ink">Interview</h2>
          <span className="text-[13px] text-muted">{DEMO_OUTREACH.interview.length} active</span>
        </div>
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {DEMO_OUTREACH.interview.map((row, i) => (
            <div key={row.name} className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${row.urgency === "high" ? "bg-brick" : row.urgency === "medium" ? "bg-warning" : "bg-pine"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-ink">{row.name} <span className="text-[13px] font-normal text-graphite">· {row.county}, CA</span></p>
                <p className="text-[12px] text-muted mt-0.5">{row.status}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recertification bucket */}
      <section aria-label="Recertification">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-5 rounded-sm bg-amber" />
          <h2 className="text-[14px] font-bold text-ink">Recertification</h2>
          <span className="text-[13px] text-muted">{DEMO_OUTREACH.recertification.length} households in window</span>
        </div>
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {DEMO_OUTREACH.recertification.map((row, i) => {
            const overdue = row.daysLeft < 0;
            return (
              <div key={row.name} className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${overdue ? "bg-brick" : row.daysLeft <= 14 ? "bg-warning" : "bg-amber"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink">{row.name} <span className="text-[13px] font-normal text-graphite">· {row.county}, CA</span></p>
                  <p className="text-[12px] text-muted mt-0.5">{row.stage}</p>
                </div>
                <span className={`text-[12px] tabular-nums font-semibold ${overdue ? "text-brick" : row.daysLeft <= 14 ? "text-warning" : "text-amber"}`}>
                  {overdue ? `${Math.abs(row.daysLeft)}d overdue` : `${row.daysLeft}d left`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-[11px] text-graphite">Sample data — synthetic outreach queue. No real applicant information is shown.</p>
    </div>
  );
}

// ─── Renewals ──────────────────────────────────────────────────────────────────

function RenewalsSection() {
  const maxCount = Math.max(...DEMO_RENEWALS.cadenceRows.map((r) => r.count));
  return (
    <div className="space-y-6">
      {/* Summary stat strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-hairline rounded-[4px] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brick">Overdue</p>
          <p className="text-[32px] font-semibold tabular-nums text-brick leading-none mt-1">{DEMO_RENEWALS.overdue}</p>
          <p className="text-[12px] text-muted mt-1">past cert end date</p>
        </div>
        <div className="bg-surface border border-hairline rounded-[4px] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-warning">Expiring in 30d</p>
          <p className="text-[32px] font-semibold tabular-nums text-warning leading-none mt-1">{DEMO_RENEWALS.expiring30}</p>
          <p className="text-[12px] text-muted mt-1">need priority outreach</p>
        </div>
        <div className="bg-surface border border-hairline rounded-[4px] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber">Expiring in 60d</p>
          <p className="text-[32px] font-semibold tabular-nums text-amber leading-none mt-1">{DEMO_RENEWALS.expiring60}</p>
          <p className="text-[12px] text-muted mt-1">first notice cadence</p>
        </div>
      </div>

      {/* Cadence breakdown */}
      <section aria-label="Recertification cadence">
        <h2 className="text-[14px] font-bold text-ink mb-4">Renewal cadence</h2>
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {DEMO_RENEWALS.cadenceRows.map((row, i) => (
            <div key={row.stage} className={`px-5 py-4 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[14px] font-semibold text-ink">{row.stage}</span>
                  <span className="text-[12px] text-muted ml-2">{row.label}</span>
                </div>
                <span className="text-[14px] font-semibold tabular-nums text-ink">{row.count}</span>
              </div>
              <div className="h-2 bg-paper rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.count / maxCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sample rows */}
      <section aria-label="Sample renewal queue">
        <h2 className="text-[14px] font-bold text-ink mb-3">Sample households</h2>
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {DEMO_RENEWALS.sampleRows.map((row, i) => {
            const overdue = row.daysLeft < 0;
            return (
              <div key={row.name} className={`flex items-center gap-5 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink">{row.name} <span className="text-[13px] font-normal text-graphite">· {row.county}, CA</span></p>
                  <p className="text-[12px] text-muted mt-0.5">Cert end: {row.certEnd} · {row.stage}</p>
                </div>
                <span className={`text-[12px] tabular-nums font-semibold ${overdue ? "text-brick" : row.daysLeft <= 14 ? "text-warning" : row.daysLeft <= 30 ? "text-amber" : "text-graphite"}`}>
                  {overdue ? `${Math.abs(row.daysLeft)}d overdue` : `${row.daysLeft}d remaining`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-[11px] text-graphite">Sample data — synthetic recertification queue.</p>
    </div>
  );
}

// ─── Quality Control ───────────────────────────────────────────────────────────

function QCSection() {
  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-hairline rounded-[4px] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Payment Error Rate (PER)</p>
          <p className="text-[36px] font-semibold tabular-nums text-ink leading-none mt-1">{DEMO_QC.per}%</p>
          <p className="text-[12px] text-pine font-medium mt-1">↓ vs {DEMO_QC.perBenchmark}% without Civica</p>
          <p className="text-[11px] text-muted mt-0.5">Below §10105 federal trigger</p>
        </div>
        <div className="bg-surface border border-hairline rounded-[4px] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">OBBBA Readiness</p>
          <p className="text-[36px] font-semibold tabular-nums text-ink leading-none mt-1">{DEMO_QC.obbbaReady}%</p>
          <p className="text-[12px] text-pine font-medium mt-1">Work-requirement compliance</p>
          <p className="text-[11px] text-muted mt-0.5">FY2026 rules engine active</p>
        </div>
        <div className="bg-surface border border-hairline rounded-[4px] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Open QC flags</p>
          <p className="text-[36px] font-semibold tabular-nums text-ink leading-none mt-1">{DEMO_QC.recentFlags.filter((f) => f.status === "Open").length}</p>
          <p className="text-[12px] text-graphite mt-1">of {DEMO_QC.recentFlags.length} total this week</p>
          <p className="text-[11px] text-muted mt-0.5">Auto-flagged by engine</p>
        </div>
      </div>

      {/* Pillar breakdown */}
      <section aria-label="QC pillars">
        <h2 className="text-[14px] font-bold text-ink mb-3">Error by pillar</h2>
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {DEMO_QC.pillars.map((p, i) => (
            <div key={p.label} className={`px-5 py-4 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[14px] font-semibold text-ink">{p.label}</span>
                  <span className="text-[12px] text-muted ml-2">{p.note}</span>
                </div>
                <span className={`text-[12px] font-semibold tabular-nums ${p.fail > 8 ? "text-warning" : "text-pine"}`}>{p.fail}% error rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-paper rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${p.fail > 8 ? "bg-warning" : "bg-pine/60"}`} style={{ width: `${p.fail}%` }} />
                </div>
                <span className="text-[11px] text-muted tabular-nums w-10 text-right">{p.pass}% pass</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent flags */}
      <section aria-label="Recent QC flags">
        <h2 className="text-[14px] font-bold text-ink mb-3">Recent flags</h2>
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {DEMO_QC.recentFlags.map((flag, i) => (
            <div key={flag.id} className={`flex items-start gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono text-graphite">{flag.id}</span>
                  <span className="text-[13px] font-semibold text-ink">{flag.field}</span>
                </div>
                <p className="text-[12px] text-muted mt-0.5">{flag.issue}</p>
              </div>
              <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm shrink-0 ${flag.status === "Open" ? "bg-warning/10 text-warning" : "bg-pine/10 text-pine"}`}>
                {flag.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-graphite">Demo data — representative QC metrics from a synthetic cohort. Engine version FY2026.</p>
    </div>
  );
}

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
          <p className="text-[15px] font-semibold text-ink">{name}</p>
          <p className="text-[13px] text-graphite">{county}, CA</p>
          <span className="text-[11px] text-graphite font-mono tabular-nums">{shortId}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <StatusPill status={status} />
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider">
            <span className={`w-2 h-2 rounded-full shrink-0 ${riskBg}`} />
            <span className="text-muted">{risk}</span>
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[13px] tabular-nums font-medium text-graphite">{time}</p>
        <p className="text-[11px] text-graphite uppercase tracking-wider mt-0.5">updated</p>
      </div>
    </Link>
  );
}
