"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PhaseGroup, QueueApplication } from "../../lib/cbo/demo-pipeline";
import { PIPELINE_STEPS, formatUsd } from "../../lib/cbo/demo-pipeline";
import {
  PERIODS,
  PERIOD_LABEL,
  snapshotFor,
  rangeForPeriod,
  fmtRange,
  isoDate,
  reportDocument,
  type Period,
  type ReportData,
} from "../../lib/cbo/progress-report";
import TableExport from "./TableExport";

type Risk = "Low risk" | "Medium risk" | "High risk";

const TOTAL_STEPS = PIPELINE_STEPS.length;
function pct(n: number) { return Math.round((n / TOTAL_STEPS) * 100); }
function riskLabel(r: Risk) { return r === "High risk" ? "HIGH" : r === "Medium risk" ? "MED" : "LOW"; }
function riskText(r: Risk) { return r === "High risk" ? "text-brick font-semibold" : r === "Medium risk" ? "text-warning" : "text-muted"; }
function barColor(r: Risk) { return r === "High risk" ? "bg-brick" : r === "Medium risk" ? "bg-warning" : "bg-pine"; }
function topRisk(cases: QueueApplication[]): Risk {
  if (cases.some((c) => c.risk === "High risk")) return "High risk";
  if (cases.some((c) => c.risk === "Medium risk")) return "Medium risk";
  return "Low risk";
}

// #6 — parse relative "updated" strings to days elapsed
function daysAgo(updated: string): number {
  if (updated === "today") return 0;
  const h = updated.match(/(\d+)h ago/);
  if (h) return 0;
  const d = updated.match(/(\d+)d ago/);
  if (d) return parseInt(d[1]);
  const w = updated.match(/(\d+)w ago/);
  if (w) return parseInt(w[1]) * 7;
  return 0;
}

// #4 — navigator capacity ceiling (cases per navigator)
const CAPACITY = 5;

// #9 — synthetic avg days to handoff per navigator (illustrative)
const NAV_AVG_DAYS: Record<string, number> = {
  "A. Cole":   7,
  "J. Ruiz":   5,
  "L. Park":   9,
  "M. Diaz":   4,
  "R. Okafor": 6,
};

// 4-week trend deltas (start → now). Up is good for apps; down is good for
// error rate and handoff days. Shown as a single percent change, not a chart —
// a director wants "how much better, which direction," not a 4-point line.
const TRENDS = {
  appsPerNav:  { from: 18,  to: 23,  goodWhenUp: true  },
  errorRate:   { from: 6.1, to: 4.2, goodWhenUp: false },
  daysHandoff: { from: 9,   to: 6,   goodWhenUp: false },
};

function TrendDelta({ from, to, goodWhenUp }: { from: number; to: number; goodWhenUp: boolean }) {
  const changePct = Math.round(((to - from) / from) * 100);
  const isUp = to > from;
  const isGood = goodWhenUp ? isUp : !isUp;
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-[11px]">
      <span className={`font-semibold tabular-nums ${isGood ? "text-pine" : "text-warning"}`}>
        {isUp ? "↑" : "↓"} {Math.abs(changePct)}%
      </span>
      <span className="text-muted">4-wk trend</span>
    </span>
  );
}

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

function NavigatorRow({
  name, cases, onFilter,
}: {
  name: string;
  cases: QueueApplication[];
  onFilter: (nav: string) => void;
}) {
  const flags = cases.reduce((s, c) => s + c.docFlags.length, 0);
  const risk = topRisk(cases);
  const isUnassigned = name === "Unassigned";
  const avgDays = NAV_AVG_DAYS[name] ?? null;

  // #4 capacity bar
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
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-hairline first:border-t-0 hover:bg-paper transition-colors">
      <button
        type="button"
        onClick={() => onFilter(name)}
        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
        aria-label={`Filter by ${name}`}
      >
        <NavAvatar name={name} />
        <span className={`text-[14px] font-semibold leading-none ${isUnassigned ? "text-muted" : "text-ink"}`}>
          {name}
        </span>
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
        {isUnassigned ? (
          <Link
            href="/cbo-preview?section=pipeline"
            className="text-[12px] font-semibold text-pine hover:underline"
          >
            Assign →
          </Link>
        ) : (
          <TableExport
            filename={`progress-${name.toLowerCase().replace(/[\s.]/g, "-")}`}
            title={`Progress report — ${name}`}
            columns={["Navigator", "Case ID", "Applicant", "County", "Stage", "Completion", "Est. benefit", "Flags", "Risk"]}
            rows={exportRows}
            note={`Progress report for navigator ${name}. Benefit estimate and verification needs are computed by Civica's rules engine.`}
          />
        )}
      </div>
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
            <span className="h-1.5 flex-1 rounded-full bg-paper overflow-hidden">
              <span className={`block h-full rounded-full ${barColor(app.risk)}`} style={{ width: `${completion}%` }} />
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

// ── Snapshot: animated numbers + period toggle ───────────────────────────────

// Tween a number toward `target` with an ease-out curve. Resumes smoothly from
// the currently-displayed value if the target changes mid-flight, and respects
// prefers-reduced-motion (jumps instantly). SSR-safe: initial state == target,
// so the server renders the final figure (no hydration mismatch).
function useCountUp(target: number, duration = 650): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = target;
    if (reduce || from === to) {
      fromRef.current = to;
      setVal(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const cur = from + (to - from) * ease(p);
      fromRef.current = cur;
      setVal(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        fromRef.current = to;
        setVal(to);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}

function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const v = useCountUp(value);
  return <span className={`tabular-nums ${className ?? ""}`}>{format(v)}</span>;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function PeriodToggle({
  value,
  onChange,
  idPrefix,
}: {
  value: Period;
  onChange: (p: Period) => void;
  idPrefix: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Snapshot period"
      className="inline-flex items-center rounded-[2px] border border-hairline bg-surface p-0.5"
    >
      {PERIODS.map((p) => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            id={`${idPrefix}-${p.key}`}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(p.key)}
            className={`rounded-[2px] px-2.5 py-1 text-[12px] font-semibold transition-colors ${
              active ? "bg-ink text-white" : "text-graphite hover:bg-surface-secondary"
            }`}
          >
            {p.label}
          </button>
        );
      })}
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
  const [navFilter, setNavFilter] = useState<string | null>(null);

  const allCases = useMemo(() => phases.flatMap((p) => p.cases), [phases]);

  // #8 unassigned dispatch
  const unassignedCases = useMemo(
    () => allCases.filter((c) => c.navigator === "Unassigned"),
    [allCases],
  );

  // #2 recert countdown
  const recertCases = useMemo(
    () => phases.find((p) => p.key === "recert")?.cases ?? [],
    [phases],
  );
  const overdueRecerts  = recertCases.filter((c) => c.stage.toLowerCase().includes("overdue"));
  const upcomingRecerts = recertCases.filter((c) => !c.stage.toLowerCase().includes("overdue"));

  // #3 benefits enrolled this month
  const enrolledCases = useMemo(
    () => phases.find((p) => p.key === "enrolled")?.cases ?? [],
    [phases],
  );
  const totalBenefitUsd = enrolledCases.reduce((s, c) => s + (c.estimatedBenefitUsd ?? 0), 0);
  const enrolledWithBenefit = enrolledCases.filter((c) => c.estimatedBenefitUsd != null).length;

  // #6 stale cases — in progress, no activity in ≥5 days (5 is a real stall;
  // 2 days is normal turnaround). Recerts are surfaced separately.
  const staleCases = useMemo(
    () => allCases.filter(
      (c) => c.phase !== "enrolled" && c.phase !== "recert" && daysAgo(c.updated) >= 5,
    ),
    [allCases],
  );

  // #2 #6 #8 — single consolidated "needs attention" list, ranked by urgency.
  type Tone = "brick" | "warning" | "muted";
  const attentionItems: { key: string; href: string; label: string; tone: Tone }[] = [
    ...overdueRecerts.map((c) => ({
      key: c.id, href: `/packets/${c.id}`, label: `${c.name} recert overdue`, tone: "brick" as Tone,
    })),
    ...upcomingRecerts.map((c) => {
      const days = c.stage.match(/(\d+)\s*day/)?.[1];
      return {
        key: c.id, href: `/packets/${c.id}`,
        label: `${c.name} recert due${days ? ` in ${days}d` : ""}`, tone: "warning" as Tone,
      };
    }),
    ...staleCases.map((c) => ({
      key: c.id, href: `/packets/${c.id}`, label: `${c.name} stalled ${c.updated}`, tone: "muted" as Tone,
    })),
    ...(unassignedCases.length > 0
      ? [{
          key: "unassigned", href: "#active-caseload",
          label: `${unassignedCases.length} unassigned`, tone: "muted" as Tone,
        }]
      : []),
  ];
  const toneText = (t: Tone) =>
    t === "brick" ? "text-brick" : t === "warning" ? "text-warning" : "text-graphite";

  // #5 caseload by phase — counts vary across the 4 lifecycle phases, so a
  // single proportional bar reads as a real distribution (not a flat per-stage
  // list where every stage holds one case).
  const phaseDistribution = phases.map((p) => ({
    key: p.key, label: p.label, accent: p.accent, count: p.cases.length,
  }));
  const totalPhaseCases = phaseDistribution.reduce((s, p) => s + p.count, 0);

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

  // Cases for the active caseload table, optionally filtered by navigator.
  const tableGroups = useMemo(() => {
    const byRisk = (a: QueueApplication, b: QueueApplication) => {
      const order: Record<Risk, number> = { "High risk": 0, "Medium risk": 1, "Low risk": 2 };
      return order[a.risk] - order[b.risk];
    };
    if (navFilter) {
      const cases = (navigatorMap.get(navFilter) ?? []).slice().sort(byRisk);
      return [{ navigator: navFilter, cases }];
    }
    return navigatorList.map(([nav, cases]) => ({
      navigator: nav,
      cases: [...cases].sort(byRisk),
    }));
  }, [navigatorMap, navigatorList, navFilter]);

  const displayCount = tableGroups.reduce((s, g) => s + g.cases.length, 0);
  const totalFlags = allCases.reduce((s, c) => s + c.docFlags.length, 0);
  const highRiskCount = allCases.filter((c) => c.risk === "High risk").length;

  // ── Snapshot: period-scoped KPIs (Month anchored to the live engine total) ──
  const [period, setPeriod] = useState<Period>("month");
  const snapshot = useMemo(() => snapshotFor(period, totalBenefitUsd), [period, totalBenefitUsd]);
  const { from: periodFrom, to: periodTo } = rangeForPeriod(period, new Date());
  const periodRangeLabel = fmtRange(periodFrom, periodTo);

  // ── Progress report (period or custom range → PDF / Word .doc) ──
  const [reportPeriod, setReportPeriod] = useState<Period | "custom">("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const buildReportData = (): ReportData => {
    const now = new Date();
    let periodLabel: string;
    let rangeLabel: string;
    let snap;
    if (reportPeriod === "custom") {
      const from = customFrom ? new Date(`${customFrom}T00:00:00`) : now;
      const to = customTo ? new Date(`${customTo}T00:00:00`) : now;
      periodLabel = "Custom range";
      rangeLabel = fmtRange(from, to);
      snap = snapshotFor("month", totalBenefitUsd);
    } else {
      const { from, to } = rangeForPeriod(reportPeriod, now);
      periodLabel = PERIOD_LABEL[reportPeriod];
      rangeLabel = fmtRange(from, to);
      snap = snapshotFor(reportPeriod, totalBenefitUsd);
    }
    return {
      periodLabel,
      rangeLabel,
      generatedAt: isoDate(now),
      snapshot: snap,
      phases: phaseDistribution.map((p) => ({ label: p.label, count: p.count })),
      navigators: navigatorList.map(([name, cases]) => ({
        name,
        cases: cases.length,
        flags: cases.reduce((s, c) => s + c.docFlags.length, 0),
        risk: riskLabel(topRisk(cases)),
        avgDays: NAV_AVG_DAYS[name] ?? null,
      })),
      totals: { cases: allCases.length, flags: totalFlags, benefitsUsd: totalBenefitUsd },
    };
  };

  const downloadWordReport = () => {
    const html = reportDocument(buildReportData(), { forWord: true });
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civica-progress-report-${reportPeriod}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openPdfReport = () => {
    const w = window.open("", "_blank", "width=880,height=1000");
    if (!w) {
      alert("Couldn't open the report — allow pop-ups for this site, then try again.");
      return;
    }
    w.document.write(reportDocument(buildReportData(), { forWord: false }));
    w.document.close();
  };

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

      {/* ── Needs attention — single consolidated strip ── #2 #6 #8 */}
      {synthetic && attentionItems.length > 0 && (
        <div
          className="flex items-center gap-x-2.5 gap-y-1 flex-wrap rounded-[2px] border border-hairline bg-surface px-4 py-2"
          role="alert"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-graphite shrink-0 mr-1">
            Needs attention
          </span>
          {attentionItems.map((it, i) => (
            <Fragment key={it.key}>
              {i > 0 && <span className="text-graphite/40 text-[12px]" aria-hidden="true">·</span>}
              <Link href={it.href} className={`text-[12px] font-medium hover:underline ${toneText(it.tone)}`}>
                {it.label}
              </Link>
            </Fragment>
          ))}
        </div>
      )}

      {/* ── Snapshot — period-scoped KPIs with animated transitions ── #1 #3 */}
      <section aria-label="Snapshot">
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-baseline gap-2.5">
            <p className="eyebrow">Snapshot</p>
            <span className="text-[12px] text-graphite tabular-nums">{periodRangeLabel}</span>
          </div>
          <PeriodToggle value={period} onChange={setPeriod} idPrefix="snapshot" />
        </div>
        <div className="flex items-stretch border border-hairline rounded-[2px] bg-surface overflow-hidden">
          {/* Applications */}
          <div className="flex-1 px-5 py-3.5 flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Applications</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <AnimatedNumber value={snapshot.apps} format={fmtInt} className="text-[24px] font-semibold text-ink leading-none" />
              <span className="text-[12px] text-graphite font-medium">submitted</span>
            </div>
            <TrendDelta {...TRENDS.appsPerNav} />
          </div>
          {/* Households enrolled */}
          <div className="flex-1 px-5 py-3.5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Households enrolled</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <AnimatedNumber value={snapshot.enrolled} format={fmtInt} className="text-[24px] font-semibold text-ink leading-none" />
              <span className="text-[12px] text-graphite font-medium">approved</span>
            </div>
            <span className="mt-1 text-[11px] text-muted">{PERIOD_LABEL[period]}</span>
          </div>
          {/* Benefits secured — anchored to the live engine total on Month */}
          <div className="flex-1 px-5 py-3.5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Benefits secured</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              {totalBenefitUsd > 0 ? (
                <AnimatedNumber value={snapshot.benefitsUsd} format={fmtMoney} className="text-[24px] font-semibold text-ink leading-none" />
              ) : (
                <span className="text-[18px] font-semibold text-muted">—</span>
              )}
            </div>
            {totalBenefitUsd > 0 && (
              <span className="mt-1 text-[11px] text-muted">
                {enrolledWithBenefit} household{enrolledWithBenefit !== 1 ? "s" : ""} · {PERIOD_LABEL[period].toLowerCase()}
              </span>
            )}
          </div>
          {/* Error rate — period-scoped cohort figure */}
          <div className="flex-1 px-5 py-3.5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Error rate (Civica cohort)</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <AnimatedNumber value={snapshot.errorRate} format={fmtPct} className="text-[24px] font-semibold text-ink leading-none" />
              <span className="text-[12px] text-pine font-medium">vs ~10.8% manual</span>
            </div>
            <TrendDelta {...TRENDS.errorRate} />
          </div>
          {/* Avg time to handoff */}
          <div className="flex-1 px-5 py-3.5 border-l border-hairline flex flex-col">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Avg time to handoff</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <AnimatedNumber value={snapshot.handoff} format={(n) => `${Math.round(n)} days`} className="text-[24px] font-semibold text-ink leading-none" />
              <span className="text-[12px] text-pine font-medium">vs ~22 manual</span>
            </div>
            <TrendDelta {...TRENDS.daysHandoff} />
          </div>
        </div>

        {/* ── Generate progress report (period or custom range → PDF / Word) ── */}
        <div className="mt-3 rounded-[2px] border border-hairline bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <div className="flex items-baseline gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Generate progress report</p>
            </div>
            {/* Range selector: the five periods + Custom */}
            <div role="tablist" aria-label="Report range" className="inline-flex items-center rounded-[2px] border border-hairline p-0.5">
              {PERIODS.map((p) => {
                const active = reportPeriod === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setReportPeriod(p.key)}
                    className={`rounded-[2px] px-2.5 py-1 text-[12px] font-semibold transition-colors ${active ? "bg-ink text-white" : "text-graphite hover:bg-surface-secondary"}`}
                  >
                    {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                role="tab"
                aria-selected={reportPeriod === "custom"}
                onClick={() => setReportPeriod("custom")}
                className={`rounded-[2px] px-2.5 py-1 text-[12px] font-semibold transition-colors ${reportPeriod === "custom" ? "bg-ink text-white" : "text-graphite hover:bg-surface-secondary"}`}
              >
                Custom
              </button>
            </div>

            {reportPeriod === "custom" && (
              <div className="flex items-center gap-2 text-[12px] text-graphite">
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="Report start date"
                  className="rounded-[2px] border border-hairline bg-surface px-2 py-1 text-ink focus:border-pine focus:outline-none"
                />
                <span aria-hidden="true">–</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="Report end date"
                  className="rounded-[2px] border border-hairline bg-surface px-2 py-1 text-ink focus:border-pine focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={openPdfReport}
                className="inline-flex items-center gap-1.5 rounded-[2px] bg-pine px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-pine-pressed"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={downloadWordReport}
                className="inline-flex items-center gap-1.5 rounded-[2px] border border-hairline bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-paper"
              >
                Download Word
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Exports the snapshot, caseload-by-phase, and navigator roster for the selected range. Benefit + error-rate figures are engine-computed.
          </p>
        </div>
      </section>

      {/* ── Caseload by phase — single proportional bar ── #5 */}
      {synthetic && totalPhaseCases > 0 && (
        <section aria-label="Caseload by phase">
          <p className="eyebrow mb-3">Caseload by phase</p>
          <div className="border border-hairline rounded-[2px] bg-surface p-4">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-secondary">
              {phaseDistribution
                .filter((p) => p.count > 0)
                .map((p) => (
                  <span
                    key={p.key}
                    className={p.accent}
                    style={{ width: `${(p.count / totalPhaseCases) * 100}%` }}
                    title={`${p.label}: ${p.count}`}
                  />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-3">
              {phaseDistribution.map((p) => (
                <div key={p.key} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-sm ${p.accent}`} aria-hidden="true" />
                  <span className="text-[12px] text-ink">{p.label}</span>
                  <span className="text-[12px] tabular-nums text-graphite font-medium">{p.count}</span>
                </div>
              ))}
            </div>
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
            {navigatorList.map(([nav, cases]) => (
              <NavigatorRow
                key={nav}
                name={nav}
                cases={cases}
                onFilter={(n) => setNavFilter((prev) => (prev === n ? null : n))}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Active caseload ── */}
      {synthetic && (
        <section id="active-caseload" aria-label="Active caseload">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-3">
              <p className="eyebrow">Active caseload</p>
              {navFilter && (
                <button
                  type="button"
                  onClick={() => setNavFilter(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-pine border border-pine/30 bg-pine/5 rounded-[2px] px-2 py-0.5 hover:bg-pine/10 transition-colors"
                >
                  {navFilter}
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-graphite">{displayCount} case{displayCount !== 1 ? "s" : ""}</span>
              <TableExport
                filename="cbo-caseload-all"
                title="CBO caseload — all active applications"
                columns={["Navigator", "Case ID", "Applicant", "County", "Stage", "Completion", "Est. benefit", "Flags", "Risk"]}
                rows={allExportRows}
                note="Benefit estimates are computed by Civica's rules engine."
              />
            </div>
          </div>

          <div className="border border-hairline rounded-[2px] bg-surface overflow-hidden">
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

            {tableGroups.map((group) => (
              <div key={group.navigator}>
                {/* Phase-group header row — click to toggle filter */}
                <button
                  type="button"
                  onClick={() => setNavFilter((prev) => (prev === group.navigator ? null : group.navigator))}
                  className={`flex items-center gap-2 w-full px-4 py-1 border-b border-hairline text-left transition-colors ${
                    navFilter === group.navigator ? "bg-pine/5" : "bg-paper hover:bg-surface-secondary"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-pine/40 shrink-0" aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-graphite">{group.navigator}</span>
                  <span className="text-[11px] text-graphite tabular-nums">{group.cases.length}</span>
                </button>
                {group.cases.map((app, i) => (
                  <CaseRow key={app.id} app={app} border={i > 0} />
                ))}
              </div>
            ))}

            {displayCount === 0 && (
              <p className="px-4 py-8 text-[13px] text-muted text-center">No active cases.</p>
            )}
          </div>
        </section>
      )}

    </div>
  );
}
