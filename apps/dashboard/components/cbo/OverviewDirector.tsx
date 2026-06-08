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
function barColor(r: Risk) { return r === "High risk" ? "bg-brick" : r === "Medium risk" ? "bg-warning" : "bg-pine"; }
function topRisk(cases: QueueApplication[]): Risk {
  if (cases.some((c) => c.risk === "High risk")) return "High risk";
  if (cases.some((c) => c.risk === "Medium risk")) return "Medium risk";
  return "Low risk";
}

// Synthetic 4-week trend data (most recent = last element).
// Up is good for apps and benefits; down is good for error rate and handoff days.
const TRENDS = {
  appsPerNav:  { values: [18, 19, 21, 23], goodWhenUp: true  },
  errorRate:   { values: [6.1, 5.2, 4.8, 4.2], goodWhenUp: false },
  daysHandoff: { values: [9, 8, 7, 6],     goodWhenUp: false },
};

function Sparkline({ values, goodWhenUp }: { values: number[]; goodWhenUp: boolean }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const W = 44, H = 16;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - ((v - min) / span) * (H - 4)}`)
    .join(" ");
  const isUp = values[values.length - 1] > values[0];
  const isGood = goodWhenUp ? isUp : !isUp;
  return (
    <svg width={W} height={H} aria-hidden="true" className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={isGood ? "#2D5A45" : "#B5511E"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

      <span className="shrink-0 w-16 text-right">
        <span className="text-[13px] tabular-nums text-ink">{cases.length}</span>
        <span className="text-[12px] text-graphite"> case{cases.length !== 1 ? "s" : ""}</span>
      </span>

      <span className={`shrink-0 w-16 text-right text-[13px] tabular-nums ${flags > 0 ? "text-brick font-semibold" : "text-muted"}`}>
        {flags > 0 ? `${flags} flag${flags !== 1 ? "s" : ""}` : "clean"}
      </span>

      <span className={`shrink-0 w-14 text-right text-[11px] uppercase tracking-wider ${riskText(risk)}`}>
        {riskLabel(risk)}
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
            note={`Progress report for navigator ${name}. Benefit estimate and verification needs are computed by Civica's rules engine; applicant records are synthetic.`}
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

      {/* ── Urgent alerts ── #2 #8 */}
      {synthetic && (overdueRecerts.length > 0 || unassignedCases.length > 0) && (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          {overdueRecerts.map((c) => (
            <Link
              key={c.id}
              href={`/packets/${c.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-brick/8 border border-brick/20 text-[12px] font-semibold text-brick hover:bg-brick/12 transition-colors"
            >
              <span aria-hidden="true">⚠</span>
              {c.name} — recert overdue
            </Link>
          ))}
          {upcomingRecerts.map((c) => {
            const days = c.stage.match(/(\d+)\s*day/)?.[1];
            return (
              <Link
                key={c.id}
                href={`/packets/${c.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-warning/8 border border-warning/20 text-[12px] font-semibold text-warning hover:bg-warning/12 transition-colors"
              >
                <span aria-hidden="true">⏱</span>
                {c.name} — recert due{days ? ` in ${days} days` : ""}
              </Link>
            );
          })}
          {unassignedCases.length > 0 && (
            <Link
              href="#active-caseload"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-ink/5 border border-hairline text-[12px] font-semibold text-graphite hover:bg-ink/8 transition-colors"
            >
              <span aria-hidden="true">·</span>
              {unassignedCases.length} unassigned case{unassignedCases.length !== 1 ? "s" : ""} — needs dispatch
            </Link>
          )}
        </div>
      )}

      {/* ── KPI strip — 4 stats + sparklines ── #1 #3 */}
      <section aria-label="Impact at a glance">
        <div className="flex items-stretch border border-hairline rounded-[2px] bg-surface overflow-hidden">
          {/* Apps per navigator */}
          <div className="flex-1 px-5 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Avg apps / navigator / mo</p>
            <div className="flex items-end justify-between gap-2 mt-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-semibold tabular-nums text-ink leading-none">23</span>
                <span className="text-[12px] text-pine font-medium">vs 7 manual</span>
              </div>
              <Sparkline {...TRENDS.appsPerNav} />
            </div>
          </div>
          {/* Error rate */}
          <div className="flex-1 px-5 py-3.5 border-l border-hairline">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Error rate (Civica cohort)</p>
            <div className="flex items-end justify-between gap-2 mt-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-semibold tabular-nums text-ink leading-none">4.2%</span>
                <span className="text-[12px] text-pine font-medium">vs ~10.8% manual</span>
              </div>
              <Sparkline {...TRENDS.errorRate} />
            </div>
          </div>
          {/* Avg handoff */}
          <div className="flex-1 px-5 py-3.5 border-l border-hairline">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Avg time to handoff</p>
            <div className="flex items-end justify-between gap-2 mt-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-semibold tabular-nums text-ink leading-none">6 days</span>
                <span className="text-[12px] text-pine font-medium">vs ~22 days manual</span>
              </div>
              <Sparkline {...TRENDS.daysHandoff} />
            </div>
          </div>
          {/* Benefits enrolled — live from engine */}
          <div className="flex-1 px-5 py-3.5 border-l border-hairline">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Benefits enrolled this month</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              {totalBenefitUsd > 0 ? (
                <>
                  <span className="text-[24px] font-semibold tabular-nums text-ink leading-none">
                    {formatUsd(totalBenefitUsd)}/mo
                  </span>
                  <span className="text-[12px] text-graphite font-medium">
                    {enrolledWithBenefit} household{enrolledWithBenefit !== 1 ? "s" : ""}
                  </span>
                </>
              ) : (
                <span className="text-[18px] font-semibold text-muted">—</span>
              )}
            </div>
          </div>
        </div>
      </section>

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
              <span className="w-16 text-right">Cases</span>
              <span className="w-16 text-right">Flags</span>
              <span className="w-14 text-right">Risk</span>
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
                note="Illustrative caseload. Benefit estimates are computed by Civica's rules engine; applicant records are synthetic."
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
