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

      {/* ── KPI strip ── */}
      <section aria-label="Impact at a glance">
        <div className="flex items-stretch border border-hairline rounded-[2px] bg-surface overflow-hidden">
          {[
            { label: "Avg apps / navigator / mo", value: "23",     sub: "vs 7 manual"     },
            { label: "Error rate (Civica cohort)", value: "4.2%",   sub: "vs ~10.8% manual" },
            { label: "Avg time to handoff",        value: "6 days", sub: "vs ~22 days manual" },
          ].map((kpi, i) => (
            <div key={kpi.label} className={`flex-1 px-5 py-3.5 ${i > 0 ? "border-l border-hairline" : ""}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">{kpi.label}</p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-[24px] font-semibold tabular-nums text-ink leading-none">{kpi.value}</span>
                <span className="text-[12px] text-pine font-medium">{kpi.sub}</span>
              </div>
            </div>
          ))}
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
        <section aria-label="Active caseload">
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

      {/* ── Value props ── */}
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
