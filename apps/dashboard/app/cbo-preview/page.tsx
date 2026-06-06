import { Fragment } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import DemoModeBadge from "../../components/DemoModeBadge";
import CBOContactButton from "../../components/CBOContactButton";
import ProductSwitcher from "../../components/ProductSwitcher";
import { AppDownloadIsland } from "../../components/AppDownloadIsland";
import QcTab from "../../components/cbo/QcTab";
import EngineHouseholdsPanel from "../../components/cbo/EngineHouseholdsPanel";
import TableExport, { type TableExportProps } from "../../components/cbo/TableExport";
import { CA_BASELINE_PER, PROJECTED_PER_AT_FULL_ENGAGEMENT } from "@civica/snap-qc-engine";

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
        {active === "qc"           && <QcTab />}
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

      <AppDownloadIsland />
    </main>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewSection() {
  const funnelMax = FUNNEL_STEPS[0].count;
  const SAMPLE_QUEUE = [
    { id: "demo-pkt-003-jasmine", shortId: "JASMINE", name: "Jasmine T.", county: "Los Angeles", status: "Needs Documents",      risk: "Medium risk", time: "2h ago" },
    { id: "demo-pkt-002-carlos",  shortId: "CARLOS",  name: "Carlos R.", county: "Fresno",       status: "In Navigator Review", risk: "Medium risk", time: "5h ago" },
    { id: "demo-pkt-001-maria",   shortId: "MARIA",   name: "Maria G.",  county: "Alameda",      status: "Ready for Handoff",   risk: "Low risk",    time: "1d ago" },
  ];
  return (
    <div className="space-y-8">
      {/* KPIs — divided metric row, no per-card chrome */}
      <section aria-label="Projected impact">
        <p className="eyebrow mb-2">Projected impact at full engagement</p>
        <div className="border border-hairline rounded-[2px] bg-surface grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-hairline">
          {[
            { label: "Applications / navigator / mo", value: "23",     sub: "target vs 7 on manual forms" },
            { label: "Projected payment-error rate",  value: `${PROJECTED_PER_AT_FULL_ENGAGEMENT}%`, sub: `modeled, vs ${CA_BASELINE_PER}% CA baseline` },
            { label: "Time to handoff",               value: "6 days", sub: "target vs ~22 days on manual forms" },
          ].map((kpi) => (
            <div key={kpi.label} className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite leading-tight">{kpi.label}</p>
              <p className="text-[26px] font-semibold tabular-nums text-ink leading-none mt-2">{kpi.value}</p>
              <p className="text-[11px] text-graphite mt-1.5">{kpi.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-graphite mt-2">
          Projected from Civica&apos;s error-rate model, not a measured cohort. CA baseline{" "}
          {CA_BASELINE_PER}% is California&apos;s FY2024 payment-error rate (USDA FNS-380).
        </p>
      </section>

      {/* Funnel — table with thin sharp monochrome bars */}
      <section aria-label="Enrollment funnel">
        <p className="eyebrow mb-2">Enrollment funnel (demo cohort, 30 days)</p>
        <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-secondary">
                <th className="py-2 pl-4 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Stage</th>
                <th className="py-2 px-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">Count</th>
                <th className="py-2 pr-4 pl-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {FUNNEL_STEPS.map((step, i) => (
                <tr key={step.name} className="border-b border-hairline last:border-b-0">
                  <td className="py-2 pl-4 pr-4">
                    <span className="text-[13px] text-ink">{step.name}</span>
                    <div className="mt-1 h-[3px] w-full bg-paper">
                      <div
                        className={i === FUNNEL_STEPS.length - 1 ? "h-full bg-ink" : "h-full bg-graphite"}
                        style={{ width: `${(step.count / funnelMax) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-2 px-4 text-right text-[13px] font-semibold tabular-nums text-ink align-top whitespace-nowrap">{step.count.toLocaleString()}</td>
                  <td className="py-2 pr-4 pl-4 text-right text-[12px] tabular-nums text-muted align-top whitespace-nowrap">{step.pct ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-graphite mt-2">Conversion % relative to intake (1,240 applicants).</p>
      </section>

      {/* Sample queue preview — institutional table */}
      <section aria-label="Sample navigator queue">
        <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
          <p className="eyebrow">What navigators see · sample queue</p>
          <Link href="/cbo-preview?section=applications" className="text-[12px] text-pine hover:underline">
            See full applications view →
          </Link>
        </div>
        <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-secondary">
                <th className="py-2 pl-4 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Applicant</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">County</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Status</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Risk</th>
                <th className="py-2 pr-4 pl-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">Updated</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_QUEUE.map((p) => <QueueTableRow key={p.id} {...p} />)}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-graphite mt-2">Sample data — synthetic packets. No real applicant information is shown.</p>
      </section>

      {/* Value props — divided typographic grid, no card chrome */}
      <section aria-label="Value propositions">
        <p className="eyebrow mb-2">Why CBOs license Civica</p>
        <div className="border border-hairline rounded-[2px] bg-surface grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hairline">
          {[
            { eyebrow: "Penalty avoidance",  headline: "Built to stay under the §10105 line",   body: `California's SNAP payment-error rate is ${CA_BASELINE_PER}% (USDA FNS-380, FY2024). Civica's structured intake catches eligibility errors before submission; the error model projects ${PROJECTED_PER_AT_FULL_ENGAGEMENT}% at full engagement. A projection from the engine, not yet a measured cohort.` },
            { eyebrow: "Productivity",        headline: "3× more households per navigator",      body: "AI-assisted Q&A drops intake from ~45 min to ~12 min per applicant. One navigator supports 23 enrollments/month with Civica vs 7 with manual forms." },
            { eyebrow: "Audit-ready",          headline: "CCPA + OBBBA guardrails out of the box", body: "Consent logging, data retention windows, encryption at rest, role-based access. Configured for California; OBBBA work-requirement updates auto-applied." },
          ].map((vp) => (
            <div key={vp.headline} className="px-5 py-5 flex flex-col">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">{vp.eyebrow}</p>
              <p className="text-[15px] font-semibold text-ink leading-snug">{vp.headline}</p>
              <p className="text-[12px] text-graphite mt-2 leading-relaxed">{vp.body}</p>
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
  const summary = DEMO_QUEUE.map((b) => ({ label: b.bucketLabel, count: b.rows.length || b.count }));
  return (
    <div className="space-y-8">
      {/* Real engine output — the proof this isn't a mockup */}
      <EngineHouseholdsPanel />

      <div className="border-t border-hairline pt-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <p className="eyebrow">Navigator pipeline · sample workflow</p>
          <TableExport
            filename="cbo-navigator-pipeline"
            title="Navigator pipeline — sample workflow"
            columns={["Bucket", "Applicant", "County", "Status", "Risk", "Updated"]}
            rows={DEMO_QUEUE.flatMap((b) =>
              b.rows.map((r) => [
                b.bucketLabel,
                r.name,
                `${r.county}, CA`,
                r.status,
                r.risk === "High risk" ? "HIGH" : r.risk === "Medium risk" ? "MED" : "LOW",
                r.time,
              ]),
            )}
            note="Sample pipeline — synthetic packets illustrating the navigator workflow. No real applicant information is shown."
          />
        </div>

        {/* Summary strip — counts as text, divided by rules, no card chrome */}
        <div className="flex items-center flex-wrap gap-x-5 gap-y-1 text-[12px]">
          {summary.map((s) => (
            <span key={s.label} className="text-graphite">
              {s.label} <span className="font-semibold text-ink tabular-nums">{s.count}</span>
            </span>
          ))}
          <span className="text-muted">·</span>
          <span className="text-graphite">
            Active total <span className="font-semibold text-ink tabular-nums">{total}</span>
          </span>
        </div>

        {/* One dense table, grouped by status. Hairline rules, text-only risk, no pills. */}
        <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-secondary">
                <th className="py-2 pl-4 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Applicant</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">County</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Status</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Risk</th>
                <th className="py-2 pr-4 pl-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">Updated</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_QUEUE.map((bucket) => {
                const count = bucket.rows.length || bucket.count;
                if (count === 0) return null;
                return (
                  <Fragment key={bucket.bucket}>
                    <tr className="border-b border-hairline bg-paper">
                      <td colSpan={5} className="py-1.5 px-4">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-graphite">{bucket.bucketLabel}</span>
                        <span className="ml-2 text-[11px] text-graphite tabular-nums">{count}</span>
                      </td>
                    </tr>
                    {bucket.rows.length > 0 ? (
                      bucket.rows.map((p) => <QueueTableRow key={p.id} {...p} />)
                    ) : (
                      <tr className="border-b border-hairline">
                        <td colSpan={5} className="py-2.5 px-4 text-[12px] text-muted italic">
                          {bucket.count} completed applications in the last 90 days.
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-graphite">Sample pipeline — synthetic packets illustrating the navigator workflow. No real applicant information is shown.</p>
      </div>
    </div>
  );
}

/** Institutional pipeline row: plain text, text-only risk (HIGH=brick), no badge/pill. */
function QueueTableRow({
  id, shortId, name, county, status, risk, time,
}: {
  id: string; shortId: string; name: string; county: string;
  status: string; risk: string; riskBg?: string; time: string;
}) {
  const riskClass =
    risk === "High risk" ? "text-brick font-semibold" : risk === "Medium risk" ? "text-ink" : "text-muted";
  const riskLabel = risk === "High risk" ? "HIGH" : risk === "Medium risk" ? "MED" : "LOW";
  return (
    <tr className="border-b border-hairline last:border-b-0 hover:bg-paper transition-colors">
      <td className="py-2 pl-4 pr-4">
        <Link href={`/packets/${id}`} className="text-[13px] font-semibold text-ink hover:text-pine">
          {name}
        </Link>
        <span className="ml-2 text-[11px] text-graphite font-mono tabular-nums">{shortId}</span>
      </td>
      <td className="py-2 px-4 text-[12px] text-graphite whitespace-nowrap">{county}, CA</td>
      <td className="py-2 px-4 text-[12px] text-ink whitespace-nowrap">{status}</td>
      <td className={`py-2 px-4 text-[11px] uppercase tracking-wider tabular-nums whitespace-nowrap ${riskClass}`}>{riskLabel}</td>
      <td className="py-2 pr-4 pl-4 text-right text-[12px] text-muted tabular-nums whitespace-nowrap">{time}</td>
    </tr>
  );
}

// ─── Outreach ──────────────────────────────────────────────────────────────────

function OutreachTableShell({
  label, count, exportProps, children,
}: {
  label: string; count: string; exportProps?: TableExportProps; children: React.ReactNode;
}) {
  return (
    <section aria-label={label}>
      <div className="flex items-end justify-between gap-3 mb-2">
        <div className="flex items-baseline gap-2">
          <p className="eyebrow">{label}</p>
          <span className="text-[12px] text-muted tabular-nums">{count}</span>
        </div>
        {exportProps && <TableExport {...exportProps} />}
      </div>
      <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
        <table className="w-full border-collapse">{children}</table>
      </div>
    </section>
  );
}

const OUTREACH_TH = "py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite";

function OutreachSection() {
  return (
    <div className="space-y-6">
      {/* Stalled applications */}
      <OutreachTableShell
        label="Applications · needing follow-up"
        count={`${DEMO_OUTREACH.applications.length}`}
        exportProps={{
          filename: "cbo-outreach-applications",
          title: "Outreach — applications needing follow-up",
          columns: ["Applicant", "County", "Reason", "Priority"],
          rows: DEMO_OUTREACH.applications.map((r) => [r.name, `${r.county}, CA`, r.reason, r.urgency === "high" ? "HIGH" : "MED"]),
          note: "Sample data — synthetic outreach queue. No real applicant information is shown.",
        }}
      >
        <thead>
          <tr className="border-b border-hairline bg-surface-secondary">
            <th className={`${OUTREACH_TH} pl-4`}>Applicant</th>
            <th className={OUTREACH_TH}>County</th>
            <th className={OUTREACH_TH}>Reason</th>
            <th className={`${OUTREACH_TH} text-right pr-4`}>Priority</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_OUTREACH.applications.map((row) => (
            <tr key={row.name} className="border-b border-hairline last:border-b-0">
              <td className="py-2 pl-4 pr-4 text-[13px] font-semibold text-ink whitespace-nowrap">{row.name}</td>
              <td className="py-2 px-4 text-[12px] text-graphite whitespace-nowrap">{row.county}, CA</td>
              <td className="py-2 px-4 text-[12px] text-graphite">{row.reason}</td>
              <td className={`py-2 px-4 pr-4 text-right text-[11px] uppercase tracking-wider whitespace-nowrap ${row.urgency === "high" ? "text-brick font-semibold" : "text-ink"}`}>
                {row.urgency === "high" ? "HIGH" : "MED"}
              </td>
            </tr>
          ))}
        </tbody>
      </OutreachTableShell>

      {/* Interview lifecycle */}
      <OutreachTableShell
        label="Interview · active"
        count={`${DEMO_OUTREACH.interview.length}`}
        exportProps={{
          filename: "cbo-outreach-interview",
          title: "Outreach — interview lifecycle",
          columns: ["Applicant", "County", "Status", "Priority"],
          rows: DEMO_OUTREACH.interview.map((r) => [r.name, `${r.county}, CA`, r.status, r.urgency === "high" ? "HIGH" : r.urgency === "medium" ? "MED" : "LOW"]),
          note: "Sample data — synthetic outreach queue. No real applicant information is shown.",
        }}
      >
        <thead>
          <tr className="border-b border-hairline bg-surface-secondary">
            <th className={`${OUTREACH_TH} pl-4`}>Applicant</th>
            <th className={OUTREACH_TH}>County</th>
            <th className={OUTREACH_TH}>Status</th>
            <th className={`${OUTREACH_TH} text-right pr-4`}>Priority</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_OUTREACH.interview.map((row) => (
            <tr key={row.name} className="border-b border-hairline last:border-b-0">
              <td className="py-2 pl-4 pr-4 text-[13px] font-semibold text-ink whitespace-nowrap">{row.name}</td>
              <td className="py-2 px-4 text-[12px] text-graphite whitespace-nowrap">{row.county}, CA</td>
              <td className="py-2 px-4 text-[12px] text-graphite">{row.status}</td>
              <td className={`py-2 px-4 pr-4 text-right text-[11px] uppercase tracking-wider whitespace-nowrap ${row.urgency === "high" ? "text-brick font-semibold" : row.urgency === "medium" ? "text-ink" : "text-graphite"}`}>
                {row.urgency === "high" ? "HIGH" : row.urgency === "medium" ? "MED" : "LOW"}
              </td>
            </tr>
          ))}
        </tbody>
      </OutreachTableShell>

      {/* Recertification */}
      <OutreachTableShell
        label="Recertification · in window"
        count={`${DEMO_OUTREACH.recertification.length}`}
        exportProps={{
          filename: "cbo-outreach-recertification",
          title: "Outreach — recertification window",
          columns: ["Household", "County", "Stage", "Due"],
          rows: DEMO_OUTREACH.recertification.map((r) => [r.name, `${r.county}, CA`, r.stage, r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft}d`]),
          note: "Sample data — synthetic outreach queue. No real applicant information is shown.",
        }}
      >
        <thead>
          <tr className="border-b border-hairline bg-surface-secondary">
            <th className={`${OUTREACH_TH} pl-4`}>Household</th>
            <th className={OUTREACH_TH}>County</th>
            <th className={OUTREACH_TH}>Stage</th>
            <th className={`${OUTREACH_TH} text-right pr-4`}>Due</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_OUTREACH.recertification.map((row) => {
            const overdue = row.daysLeft < 0;
            return (
              <tr key={row.name} className="border-b border-hairline last:border-b-0">
                <td className="py-2 pl-4 pr-4 text-[13px] font-semibold text-ink whitespace-nowrap">{row.name}</td>
                <td className="py-2 px-4 text-[12px] text-graphite whitespace-nowrap">{row.county}, CA</td>
                <td className="py-2 px-4 text-[12px] text-graphite whitespace-nowrap">{row.stage}</td>
                <td className={`py-2 px-4 pr-4 text-right text-[12px] tabular-nums whitespace-nowrap ${overdue ? "text-brick font-semibold" : "text-muted"}`}>
                  {overdue ? `${Math.abs(row.daysLeft)}d overdue` : `${row.daysLeft}d`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </OutreachTableShell>

      <p className="text-[11px] text-graphite">Sample data — synthetic outreach queue. No real applicant information is shown.</p>
    </div>
  );
}

// ─── Renewals ──────────────────────────────────────────────────────────────────

function RenewalsSection() {
  const maxCount = Math.max(...DEMO_RENEWALS.cadenceRows.map((r) => r.count));
  return (
    <div className="space-y-6">
      {/* Summary — divided metric row; only Overdue carries the attention signal */}
      <div className="border border-hairline rounded-[2px] bg-surface grid grid-cols-3 divide-x divide-hairline">
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">Overdue</p>
          <p className="text-[28px] font-semibold tabular-nums text-brick leading-none mt-1">{DEMO_RENEWALS.overdue}</p>
          <p className="text-[11px] text-graphite mt-1">past cert end date</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">Expiring in 30d</p>
          <p className="text-[28px] font-semibold tabular-nums text-ink leading-none mt-1">{DEMO_RENEWALS.expiring30}</p>
          <p className="text-[11px] text-graphite mt-1">need priority outreach</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">Expiring in 60d</p>
          <p className="text-[28px] font-semibold tabular-nums text-ink leading-none mt-1">{DEMO_RENEWALS.expiring60}</p>
          <p className="text-[11px] text-graphite mt-1">first notice cadence</p>
        </div>
      </div>

      {/* Cadence breakdown — table with thin sharp monochrome bars */}
      <section aria-label="Recertification cadence">
        <div className="flex items-end justify-between gap-3 mb-2">
          <p className="eyebrow">Renewal cadence</p>
          <TableExport
            filename="cbo-renewal-cadence"
            title="Renewal cadence"
            columns={["Stage", "Action", "Count"]}
            rows={DEMO_RENEWALS.cadenceRows.map((r) => [r.stage, r.label, String(r.count)])}
            note="Sample data — synthetic recertification queue."
          />
        </div>
        <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-secondary">
                <th className="py-2 pl-4 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Stage</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Action</th>
                <th className="py-2 pr-4 pl-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">Count</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_RENEWALS.cadenceRows.map((row) => (
                <tr key={row.stage} className="border-b border-hairline last:border-b-0">
                  <td className="py-2 pl-4 pr-4 align-top w-[28%]">
                    <span className="text-[13px] text-ink whitespace-nowrap">{row.stage}</span>
                    <div className="mt-1 h-[3px] w-full bg-paper">
                      <div className={row.stage === "Overdue" ? "h-full bg-brick" : "h-full bg-graphite"} style={{ width: `${(row.count / maxCount) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-2 px-4 text-[12px] text-graphite align-top">{row.label}</td>
                  <td className="py-2 pr-4 pl-4 text-right text-[13px] font-semibold tabular-nums text-ink align-top whitespace-nowrap">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sample households — institutional table */}
      <section aria-label="Sample renewal queue">
        <div className="flex items-end justify-between gap-3 mb-2">
          <p className="eyebrow">Sample households</p>
          <TableExport
            filename="cbo-renewal-households"
            title="Renewal — sample households"
            columns={["Household", "County", "Cert end", "Stage", "Due"]}
            rows={DEMO_RENEWALS.sampleRows.map((r) => [r.name, `${r.county}, CA`, r.certEnd, r.stage, r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft}d`])}
            note="Sample data — synthetic recertification queue."
          />
        </div>
        <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-secondary">
                <th className="py-2 pl-4 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Household</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">County</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Cert end</th>
                <th className="py-2 px-4 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite">Stage</th>
                <th className="py-2 pr-4 pl-4 text-right text-[10px] font-semibold uppercase tracking-wider text-graphite">Due</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_RENEWALS.sampleRows.map((row) => {
                const overdue = row.daysLeft < 0;
                return (
                  <tr key={row.name} className="border-b border-hairline last:border-b-0">
                    <td className="py-2 pl-4 pr-4 text-[13px] font-semibold text-ink whitespace-nowrap">{row.name}</td>
                    <td className="py-2 px-4 text-[12px] text-graphite whitespace-nowrap">{row.county}, CA</td>
                    <td className="py-2 px-4 text-[12px] text-muted tabular-nums whitespace-nowrap">{row.certEnd}</td>
                    <td className="py-2 px-4 text-[12px] text-graphite whitespace-nowrap">{row.stage}</td>
                    <td className={`py-2 pr-4 pl-4 text-right text-[12px] tabular-nums whitespace-nowrap ${overdue ? "text-brick font-semibold" : "text-muted"}`}>
                      {overdue ? `${Math.abs(row.daysLeft)}d overdue` : `${row.daysLeft}d`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-graphite">Sample data — synthetic recertification queue.</p>
    </div>
  );
}

