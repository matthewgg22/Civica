"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PhaseGroup, QueueApplication } from "../../lib/cbo/demo-pipeline";
import { PIPELINE_STEPS, formatUsd } from "../../lib/cbo/demo-pipeline";
import TableExport from "./TableExport";

type Risk = "Low risk" | "Medium risk" | "High risk";

const TOTAL_STEPS = PIPELINE_STEPS.length;
function pct(n: number) { return Math.round((n / TOTAL_STEPS) * 100); }
function riskLabel(r: Risk) { return r === "High risk" ? "HIGH" : r === "Medium risk" ? "MED" : "LOW"; }
function riskText(r: Risk) { return r === "High risk" ? "text-brick font-semibold" : r === "Medium risk" ? "text-warning" : "text-muted"; }
function topRisk(cases: QueueApplication[]): Risk {
  if (cases.some((c) => c.risk === "High risk")) return "High risk";
  if (cases.some((c) => c.risk === "Medium risk")) return "Medium risk";
  return "Low risk";
}

// #4 — navigator capacity ceiling (cases a navigator can carry at once)
const CAPACITY = 20;

// #9 — synthetic avg days to handoff per navigator (illustrative)
const NAV_AVG_DAYS: Record<string, number> = {
  "A. Cole":   7,
  "J. Ruiz":   5,
  "L. Park":   9,
  "M. Diaz":   4,
  "R. Okafor": 6,
};

// Synthetic caseworker contact info, surfaced when a roster row is expanded.
const NAV_CONTACT: Record<string, { email: string; phone: string }> = {
  "A. Cole":   { email: "acole@civica.org",   phone: "(213) 555-0142" },
  "J. Ruiz":   { email: "jruiz@civica.org",   phone: "(619) 555-0188" },
  "L. Park":   { email: "lpark@civica.org",   phone: "(408) 555-0119" },
  "M. Diaz":   { email: "mdiaz@civica.org",   phone: "(559) 555-0173" },
  "R. Okafor": { email: "rokafor@civica.org", phone: "(510) 555-0164" },
};

// 4-week trend deltas (start → now). Up is good for apps; down is good for
// error rate and handoff days. Shown as a single percent change, not a chart —
// a director wants "how much better, which direction," not a 4-point line.
const TRENDS = {
  appsPerNav:  { from: 18,  to: 23,  goodWhenUp: true  },
  errorRate:   { from: 6.1, to: 4.2, goodWhenUp: false },
  daysHandoff: { from: 9,   to: 6,   goodWhenUp: false },
};

function TrendDelta({ from, to, goodWhenUp, caption }: { from: number; to: number; goodWhenUp: boolean; caption: string }) {
  const changePct = Math.round(((to - from) / from) * 100);
  const isUp = to > from;
  const isGood = goodWhenUp ? isUp : !isUp;
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-[11px]">
      <span className={`font-semibold tabular-nums ${isGood ? "text-pine" : "text-warning"}`}>
        {isUp ? "↑" : "↓"} {Math.abs(changePct)}%
      </span>
      <span className="text-muted">{caption}</span>
    </span>
  );
}

// Snapshot time-range options + the trend caption each one shows.
const SNAPSHOT_RANGES = ["Day", "Week", "Month", "YTD", "Year"] as const;
type SnapshotRange = typeof SNAPSHOT_RANGES[number];
const RANGE_CAPTION: Record<SnapshotRange, string> = {
  Day:   "vs yesterday",
  Week:  "1-wk trend",
  Month: "4-wk trend",
  YTD:   "year to date",
  Year:  "1-yr trend",
};

// ── Navigator initials avatar ─────────────────────────────────────────────────

function NavAvatar({ name }: { name: string }) {
  if (name === "Unassigned") {
    return (
      <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-hairline text-[11px] text-muted">
        ?
      </span>
    );
  }
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-pine/10 text-pine text-[11px] font-semibold">
      {initials}
    </span>
  );
}

// ── Navigator roster row ──────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
      className={`shrink-0 text-graphite transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavigatorRow({
  name, cases, border,
}: {
  name: string;
  cases: QueueApplication[];
  border: boolean;
}) {
  const [open, setOpen] = useState(false);
  const flags = cases.reduce((s, c) => s + c.docFlags.length, 0);
  const risk = topRisk(cases);
  const avgDays = NAV_AVG_DAYS[name] ?? null;
  const contact = NAV_CONTACT[name];

  // #4 capacity bar — share of the navigator's case ceiling
  const utilPct = Math.min((cases.length / CAPACITY) * 100, 100);
  const utilColor = utilPct >= 80 ? "bg-brick" : utilPct >= 60 ? "bg-warning" : "bg-pine/50";

  const exportRows = cases.map((c) => [
    name,
    c.caseId,
    c.name,
    `${c.county} County, CA`,
    c.stage,
    `${pct(c.completedSteps)}%`,
    c.estimatedBenefitUsd != null ? formatUsd(c.estimatedBenefitUsd) : "—",
    String(c.docFlags.length),
    riskLabel(c.risk),
  ]);

  return (
    <div className={border ? "border-t border-hairline" : ""}>
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper transition-colors">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
        >
          <NavAvatar name={name} />
          <span className="text-[14px] font-semibold leading-none text-ink">{name}</span>
          <Chevron open={open} />
        </button>

        {/* #4 cases + capacity bar */}
        <span className="shrink-0 w-28 flex items-center justify-end gap-2">
          <span className="text-[13px] tabular-nums text-ink">
            {cases.length}<span className="text-graphite text-[12px]">/{CAPACITY}</span>
          </span>
          <span className="w-14 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
            <span className={`block h-full rounded-full transition-all ${utilColor}`} style={{ width: `${utilPct}%` }} />
          </span>
        </span>

        <span className={`shrink-0 w-16 text-right text-[13px] tabular-nums ${flags > 0 ? "text-brick font-semibold" : "text-muted"}`}>
          {flags > 0 ? `${flags} flag${flags !== 1 ? "s" : ""}` : "clean"}
        </span>

        <span className={`shrink-0 w-14 text-right text-[11px] uppercase tracking-wider ${riskText(risk)}`}>
          {riskLabel(risk)}
        </span>

        {/* #9 avg days to handoff */}
        <span className="shrink-0 w-16 text-right">
          {avgDays != null ? (
            <span className="text-[13px] tabular-nums text-graphite">{avgDays}d</span>
          ) : (
            <span className="text-[12px] text-muted">—</span>
          )}
        </span>

        <div className="shrink-0 w-28 flex justify-end">
          <TableExport
            filename={`progress-${name.toLowerCase().replace(/[\s.]/g, "-")}`}
            title={`Progress report — ${name}`}
            columns={["Navigator", "Case ID", "Applicant", "County", "Stage", "Completion", "Est. benefit", "Flags", "Risk"]}
            rows={exportRows}
            note={`Progress report for navigator ${name}. Benefit estimate and verification needs are computed by Civica's rules engine; applicant records are synthetic.`}
          />
        </div>
      </div>

      {/* Expanded: caseworker contact + the cases they're handling */}
      {open && (
        <div className="px-4 pb-4 pt-1 bg-paper/60 border-t border-hairline">
          {contact && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 py-2.5 text-[12px]">
              <a href={`mailto:${contact.email}`} className="text-pine hover:underline">{contact.email}</a>
              <a href={`tel:${contact.phone.replace(/[^\d]/g, "")}`} className="text-graphite hover:text-ink">{contact.phone}</a>
              {avgDays != null && <span className="text-muted">avg {avgDays}d to handoff</span>}
            </div>
          )}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1.5 mt-1">
            Handling {cases.length} case{cases.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-px">
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/packets/${c.id}`}
                className="flex items-center gap-3 px-1.5 py-1.5 rounded-[2px] text-[12px] hover:bg-surface transition-colors"
              >
                <span className="font-mono tabular-nums text-graphite w-[88px] shrink-0">{c.caseId}</span>
                <span className="font-semibold text-ink w-[84px] shrink-0 truncate">{c.name}</span>
                <span className="text-graphite flex-1 min-w-0 truncate">{c.stage}</span>
                {c.docFlags.length > 0 && (
                  <span className="text-[11px] text-brick font-semibold tabular-nums shrink-0">{c.docFlags.length} flag{c.docFlags.length > 1 ? "s" : ""}</span>
                )}
                <span className={`text-[10px] uppercase tracking-wider shrink-0 w-[32px] text-right ${riskText(c.risk)}`}>{riskLabel(c.risk)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Case row (flat table, no expand) ─────────────────────────────────────────

function CaseRow({ app, border }: { app: QueueApplication; border: boolean }) {
  const completion = pct(app.completedSteps);
  const enrolled = app.phase === "enrolled";
  const flags = app.docFlags.length;

  return (
    <Link
      href={`/packets/${app.id}`}
      className={`flex items-center gap-3 px-4 py-2 hover:bg-paper transition-colors ${border ? "border-t border-hairline" : ""}`}
    >
      <span className="text-[11px] text-graphite font-mono tabular-nums tracking-tight shrink-0 w-[88px]">{app.caseId}</span>
      <span className="text-[13px] font-semibold text-ink shrink-0 w-[84px] truncate">{app.name}</span>
      <span className="text-[12px] text-graphite shrink-0 w-[80px] truncate hidden md:block">{app.navigator}</span>
      <span className="text-[12px] text-graphite shrink-0 w-[96px] truncate hidden sm:block">{app.county} County</span>
      <span className="text-[12px] text-ink flex-1 min-w-0 truncate">{app.stage}</span>
      <span className="hidden lg:flex items-center justify-end shrink-0 w-[112px]">
        {enrolled && app.estimatedBenefitUsd !== null ? (
          <span className="text-[12px] tabular-nums text-ink font-medium">{formatUsd(app.estimatedBenefitUsd)}/mo</span>
        ) : (
          <span className="flex items-center gap-2 w-full">
            {/* Progress = neutral graphite (how far along). Risk lives in its
                own column — a full bar shouldn't read as a warning. */}
            <span className="h-1.5 flex-1 rounded-full bg-surface-secondary overflow-hidden">
              <span className="block h-full rounded-full bg-graphite" style={{ width: `${completion}%` }} />
            </span>
            <span className="text-[11px] tabular-nums text-graphite w-[28px] text-right">{completion}%</span>
          </span>
        )}
      </span>
      <span className="shrink-0 w-[52px] text-right">
        {flags > 0 ? (
          <span className="text-[11px] font-semibold text-brick tabular-nums">{flags} flag{flags > 1 ? "s" : ""}</span>
        ) : (
          <span className="text-[11px] text-muted">clean</span>
        )}
      </span>
      <span className={`text-[11px] uppercase tracking-wider shrink-0 w-[32px] text-right ${riskText(app.risk)}`}>
        {riskLabel(app.risk)}
      </span>
    </Link>
  );
}

// ── Collapsible caseload category ─────────────────────────────────────────────
// A broad bucket (Active / Enrolled & closed) the director opens on demand.
// Collapsed, the header still carries the at-a-glance summary (count, flags,
// high-risk) so it's informative without expanding.

function CaseCategory({
  label, blurb, cases, defaultOpen,
}: {
  label: string;
  blurb: string;
  cases: QueueApplication[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const flags = cases.reduce((s, c) => s + c.docFlags.length, 0);
  const high = cases.filter((c) => c.risk === "High risk").length;

  return (
    <div className="border border-hairline rounded-[3px] bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-paper transition-colors"
      >
        <Chevron open={open} />
        <span className="text-[14px] font-semibold text-ink shrink-0">{label}</span>
        <span className="text-[12px] text-graphite truncate hidden sm:block">{blurb}</span>
        <span className="flex-1" />
        <span className="text-[13px] tabular-nums text-ink shrink-0">{cases.length} case{cases.length !== 1 ? "s" : ""}</span>
        {flags > 0 && (
          <span className="text-[12px] text-brick font-medium tabular-nums shrink-0">{flags} flag{flags !== 1 ? "s" : ""}</span>
        )}
        {high > 0 && (
          <span className="text-[11px] uppercase tracking-wider text-brick font-semibold shrink-0">{high} high</span>
        )}
      </button>

      {open && (
        <div className="border-t border-hairline">
          {cases.length > 0 ? (
            <>
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-secondary border-b border-hairline text-[10px] font-semibold uppercase tracking-wider text-graphite">
                <span className="shrink-0 w-[88px]">Case ID</span>
                <span className="shrink-0 w-[84px]">Applicant</span>
                <span className="shrink-0 w-[80px] hidden md:block">Navigator</span>
                <span className="shrink-0 w-[96px] hidden sm:block">County</span>
                <span className="flex-1 min-w-0">Stage</span>
                <span className="shrink-0 w-[112px] hidden lg:block text-right">Progress / Benefit</span>
                <span className="shrink-0 w-[52px] text-right">Flags</span>
                <span className="shrink-0 w-[32px] text-right">Risk</span>
              </div>
              {cases.map((app, i) => (
                <CaseRow key={app.id} app={app} border={i > 0} />
              ))}
            </>
          ) : (
            <p className="px-4 py-6 text-[13px] text-muted text-center">No cases in this category.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OverviewDirector({
  phases,
  synthetic,
}: {
  phases: PhaseGroup[];
  synthetic: boolean;
}) {
  const [snapshotRange, setSnapshotRange] = useState<SnapshotRange>("Month");

  const allCases = useMemo(() => phases.flatMap((p) => p.cases), [phases]);

  // #8 unassigned dispatch
  const unassignedCases = useMemo(
    () => allCases.filter((c) => c.navigator === "Unassigned"),
    [allCases],
  );

  // #3 benefits enrolled this month
  const enrolledCases = useMemo(
    () => phases.find((p) => p.key === "enrolled")?.cases ?? [],
    [phases],
  );
  const totalBenefitUsd = enrolledCases.reduce((s, c) => s + (c.estimatedBenefitUsd ?? 0), 0);
  const enrolledWithBenefit = enrolledCases.filter((c) => c.estimatedBenefitUsd != null).length;

  // Build navigator → cases map, sorted: named navigators alphabetical, Unassigned last.
  const navigatorMap = useMemo(() => {
    const map = new Map<string, QueueApplication[]>();
    for (const c of allCases) {
      const nav = c.navigator ?? "Unassigned";
      if (!map.has(nav)) map.set(nav, []);
      map.get(nav)!.push(c);
    }
    return new Map(
      [...map.entries()].sort(([a], [b]) => {
        if (a === "Unassigned") return 1;
        if (b === "Unassigned") return -1;
        return a.localeCompare(b);
      }),
    );
  }, [allCases]);

  const navigatorList = [...navigatorMap.entries()];

  // Caseload split into two broad, collapsible categories the director opens on
  // demand — "active" (still being worked) vs "enrolled & closed" (outcome
  // reached). Within each, cases sort high-risk first.
  const caseCategories = useMemo(() => {
    const byRisk = (a: QueueApplication, b: QueueApplication) => {
      const order: Record<Risk, number> = { "High risk": 0, "Medium risk": 1, "Low risk": 2 };
      return order[a.risk] - order[b.risk];
    };
    const active = allCases.filter((c) => c.phase === "requesting" || c.phase === "live").sort(byRisk);
    const closed = allCases.filter((c) => c.phase === "enrolled" || c.phase === "recert").sort(byRisk);
    return [
      { key: "active", label: "Active cases",      blurb: "In progress — needs navigator action", cases: active, defaultOpen: true },
      { key: "closed", label: "Enrolled & closed", blurb: "Receiving benefits, recertifying, or closed", cases: closed, defaultOpen: false },
    ];
  }, [allCases]);

  const totalFlags = allCases.reduce((s, c) => s + c.docFlags.length, 0);
  const highRiskCount = allCases.filter((c) => c.risk === "High risk").length;

  const allExportRows = allCases.map((c) => [
    c.navigator ?? "Unassigned",
    c.caseId,
    c.name,
    `${c.county} County, CA`,
    c.stage,
    `${pct(c.completedSteps)}%`,
    c.estimatedBenefitUsd != null ? formatUsd(c.estimatedBenefitUsd) : "—",
    String(c.docFlags.length),
    riskLabel(c.risk),
  ]);

  return (
    <div className="space-y-8">

      {/* ── KPI hero — the Snapshot ── #1 #3
          The hero block: larger numbers, more breathing room, the heaviest
          thing on the page. No "vs manual" pitch framing — a director running
          the program doesn't need re-selling daily. The range selector picks
          the period; numbers are illustrative (synthetic caseload). */}
      <section aria-label="Snapshot">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">Snapshot</p>
          <div className="inline-flex items-center rounded-[2px] border border-hairline overflow-hidden" role="group" aria-label="Snapshot period">
            {SNAPSHOT_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSnapshotRange(r)}
                aria-pressed={snapshotRange === r}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${r !== "Day" ? "border-l border-hairline" : ""} ${
                  snapshotRange === r ? "bg-ink/8 text-ink" : "text-graphite hover:bg-ink/5"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-stretch border border-hairline rounded-[3px] bg-surface overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {/* Apps per navigator */}
          <div className="flex-1 px-6 py-5 flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Apps / navigator</p>
            <span className="text-[34px] font-semibold tabular-nums text-ink leading-none mt-2">23</span>
            <TrendDelta {...TRENDS.appsPerNav} caption={RANGE_CAPTION[snapshotRange]} />
          </div>
          {/* Error rate */}
          <div className="flex-1 px-6 py-5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Error rate</p>
            <span className="text-[34px] font-semibold tabular-nums text-ink leading-none mt-2">4.2%</span>
            <TrendDelta {...TRENDS.errorRate} caption={RANGE_CAPTION[snapshotRange]} />
          </div>
          {/* Avg handoff */}
          <div className="flex-1 px-6 py-5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Time to handoff</p>
            <span className="text-[34px] font-semibold tabular-nums text-ink leading-none mt-2">6d</span>
            <TrendDelta {...TRENDS.daysHandoff} caption={RANGE_CAPTION[snapshotRange]} />
          </div>
          {/* Benefits enrolled — live from engine */}
          <div className="flex-1 px-6 py-5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Benefits enrolled</p>
            {totalBenefitUsd > 0 ? (
              <>
                <span className="text-[34px] font-semibold tabular-nums text-ink leading-none mt-2">
                  {formatUsd(totalBenefitUsd)}
                </span>
                <span className="mt-1.5 text-[11px] text-muted">
                  /mo · {enrolledWithBenefit} household{enrolledWithBenefit !== 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <span className="text-[20px] font-semibold text-muted mt-2">—</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Needs dispatch — dedicated unassigned-applications queue ──
          The director's most actionable daily task: assign a caseworker to
          applications that have none. Surfaced as its own section (not a chip)
          so it's impossible to miss. Hidden when everything is assigned. */}
      {synthetic && unassignedCases.length > 0 && (
        <section aria-label="Needs dispatch">
          <div className="flex items-baseline justify-between mb-3">
            <p className="eyebrow">Needs dispatch</p>
            <span className="text-[12px] text-warning font-medium">
              {unassignedCases.length} application{unassignedCases.length !== 1 ? "s" : ""} without a caseworker
            </span>
          </div>
          <div className="border border-warning/30 rounded-[3px] bg-warning/[0.04] overflow-hidden">
            {unassignedCases.map((c, i) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-warning/15" : ""}`}
              >
                <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-warning/40 text-[11px] text-warning" aria-hidden="true">?</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-ink">{c.name}</span>
                    <span className="text-[11px] text-graphite font-mono tabular-nums">{c.caseId}</span>
                    <span className="text-[12px] text-graphite">· {c.county} County</span>
                  </div>
                  <p className="text-[12px] text-graphite mt-0.5">{c.stage} · waiting {c.updated}</p>
                </div>
                <Link
                  href={`/cbo-preview?section=pipeline`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-[2px] bg-pine px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-pine-pressed transition-colors"
                >
                  Assign →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Navigator roster ── */}
      {synthetic && (
        <section aria-label="Navigator roster">
          <div className="flex items-baseline justify-between mb-3">
            <p className="eyebrow">Navigator roster</p>
            <span className="text-[12px] text-graphite">
              {allCases.length} active
              {totalFlags > 0 && (
                <> · <span className="text-brick font-medium">{totalFlags} flag{totalFlags !== 1 ? "s" : ""}</span></>
              )}
              {totalFlags === 0 && " · clean"}
              {highRiskCount > 0 && (
                <> · <span className="text-brick font-semibold">{highRiskCount} high risk</span></>
              )}
            </span>
          </div>
          <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-secondary border-b border-hairline text-[10px] font-semibold uppercase tracking-wider text-graphite">
              <span className="flex-1">Navigator</span>
              <span className="w-28 text-right">Workload</span>
              <span className="w-16 text-right">Flags</span>
              <span className="w-14 text-right">Risk</span>
              <span className="w-16 text-right">Avg days</span>
              <span className="w-28 text-right">Progress report</span>
            </div>
            {navigatorList
              .filter(([nav]) => nav !== "Unassigned")
              .map(([nav, cases], i) => (
                <NavigatorRow key={nav} name={nav} cases={cases} border={i > 0} />
              ))}
          </div>
        </section>
      )}

      {/* ── Active caseload ── */}
      {synthetic && (
        <section id="active-caseload" aria-label="Active caseload">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="eyebrow">Caseload</p>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-graphite">{allCases.length} cases</span>
              <TableExport
                filename="cbo-caseload-all"
                title="CBO caseload — all applications"
                columns={["Navigator", "Case ID", "Applicant", "County", "Stage", "Completion", "Est. benefit", "Flags", "Risk"]}
                rows={allExportRows}
                note="Illustrative caseload. Benefit estimates are computed by Civica's rules engine; applicant records are synthetic."
              />
            </div>
          </div>

          <div className="space-y-3">
            {caseCategories.map((cat) => (
              <CaseCategory key={cat.key} label={cat.label} blurb={cat.blurb} cases={cat.cases} defaultOpen={cat.defaultOpen} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
