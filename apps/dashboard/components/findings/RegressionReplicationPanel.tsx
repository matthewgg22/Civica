// External replication panel — rendered below the pre-registered analysis on
// /findings/regression. Presentational only: takes a PolicyRegressionReport
// (built by lib/analytics/policy-regression.ts from the harness artifact) and
// renders the burden-lever coefficient table + the BBCE event-study path.
//
// Unlike the sibling pre-registered panel (synthetic, awaiting Civica's own
// data), every number here is REAL published public data — 51 states ×
// 1996-2020 — so the banner is a confident "public data", not a watermark.
// It is the external proof that the mechanism Civica sells (lower
// administrative burden → more eligible people enrolled and retained) holds
// before Civica has shipped a case.

import type {
  PolicyRegressionReport,
  RenderedEventPoint,
  RenderedLever,
} from "../../lib/analytics/policy-regression";

const GITHUB_BLOB =
  "https://github.com/matthewgg22/Civica/blob/codex/rebuild-feb18";

function kindBadge(kind: RenderedLever["kind"]): { label: string; cls: string } {
  switch (kind) {
    case "reduces_burden":
      return { label: "burden ↓", cls: "bg-pine/10 text-pine" };
    case "expands_eligibility":
      return { label: "eligibility ↑", cls: "bg-pine/10 text-pine" };
    case "increases_burden":
      return { label: "burden ↑", cls: "bg-graphite/10 text-graphite" };
  }
}

export default function RegressionReplicationPanel({
  report,
}: {
  report: PolicyRegressionReport;
}) {
  const { provenance } = report;
  // Event-study bar scale — symmetric around zero, padded past the max |effect|.
  const maxAbs = Math.max(
    ...report.eventStudy.points.map((p) => Math.abs(p.estimate_pct)),
    5,
  );
  return (
    <section className="space-y-8">
      {/* Banner — real public data, not synthetic. */}
      <div className="rounded-lg border border-pine/30 bg-pine/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-pine">
          <span className="rounded bg-pine/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
            Public data
          </span>
          Measured on {report.states} states × {report.panel.period.replace("..", "–")}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite">
          Civica&rsquo;s own causal estimate awaits production traffic (above).
          This is the <span className="font-medium text-ink">external</span>{" "}
          test: on a quarter-century of published state data, does the mechanism
          Civica sells actually move the outcome? It replicates the
          administrative-burden literature on{" "}
          <span className="font-mono text-ink tabular-nums">
            {report.n.toLocaleString()}
          </span>{" "}
          state-months.
        </p>
      </div>

      {/* The question + design. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-graphite">
          The question
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          Do burden-reducing policies raise SNAP participation? Outcome:{" "}
          <span className="font-mono text-ink">{report.outcome}</span>. Design:{" "}
          {report.spec}. The state fixed effects net out every fixed difference
          between states; the calendar-month fixed effects net out the business
          cycle and federal rule changes — so each estimate is the within-state
          participation change when that lever switches on.
        </p>
      </div>

      {/* Lever coefficient table. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-graphite">
          Effect on participation, per policy lever
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-graphite/20 text-left">
                <th className="w-[40%] pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  Policy lever
                </th>
                <th className="pb-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  Effect
                </th>
                <th className="pb-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  95% CI
                </th>
                <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  p
                </th>
              </tr>
            </thead>
            <tbody>
              {report.levers.map((l) => (
                <LeverRow key={l.key} l={l} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-graphite">
          Effect = the % change in SNAP persons when the lever is on, controls
          held by the fixed effects. Stars: *** p&lt;0.001, ** p&lt;0.01, *
          p&lt;0.05. Within-R²{" "}
          <span className="font-mono">{report.withinR2.toFixed(2)}</span>.
        </p>
      </div>

      {/* BBCE event study. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-graphite">
          Event study — {report.eventStudy.treatment}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          Participation around the year a state adopts BBCE, vs the year before
          ({report.eventStudy.neverAdopterStates} never-adopters as controls).
          The pre-adoption bars are flat and not significant — the parallel-trend
          check — then participation ramps up after adoption.
        </p>
        <div className="mt-4 space-y-1.5">
          {report.eventStudy.points.map((p) => (
            <EventBar key={p.year_label} p={p} maxAbs={maxAbs} />
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-graphite">
          Reference: {report.eventStudy.reference}. Bars are the point estimate;
          the muted leads (pre-adoption) being near-zero is what licenses a
          causal read of the lags.
        </p>
      </div>

      {/* Benchmark + honest limits. */}
      <div className="rounded-md border border-graphite/15 bg-surface-secondary p-4 text-sm">
        <p className="font-semibold text-ink">What it does and doesn&rsquo;t prove</p>
        <p className="mt-1 leading-relaxed text-graphite">{report.benchmark}</p>
        <p className="mt-2 leading-relaxed text-graphite">
          <span className="font-medium text-ink">Honest limits.</span> Two-way
          fixed effects with staggered adoption can be biased under
          heterogeneous effects — the event study is the more credible read.
          State-specific economic shocks are not fully absorbed by the national
          time effects (a state-unemployment control is the next robustness).
          And participation is the retention margin, not payment error directly —
          it is the door the thesis is about (fewer eligible people lost), not a
          measure of dollars-in-error.
        </p>
      </div>

      {/* Provenance. */}
      <footer className="border-t border-graphite/15 pt-5 text-xs leading-relaxed text-graphite">
        <p>
          Computed <span className="font-mono">{provenance.generated_at}</span>
          {provenance.git_sha && (
            <> · <span className="font-mono">{provenance.git_sha}</span></>
          )}{" "}
          · Python <span className="font-mono">{provenance.environment.python}</span>,
          linearmodels{" "}
          <span className="font-mono">{provenance.environment.linearmodels}</span>.
        </p>
        <p className="mt-2">
          Outcome: FNS monthly SNAP participation · Treatment: USDA ERS SNAP
          Policy Database · Harness:{" "}
          <a
            href={`${GITHUB_BLOB}/tools/snap-policy-regression/src/build_policy_regression.py`}
            className="text-pine underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            tools/snap-policy-regression
          </a>{" "}
          · Panel:{" "}
          <span className="font-mono">{provenance.panel_file}</span>.
        </p>
      </footer>
    </section>
  );
}

function LeverRow({ l }: { l: RenderedLever }) {
  const badge = kindBadge(l.kind);
  return (
    <tr className="border-b border-graphite/10 align-top">
      <td className="py-3 pr-3">
        <div className="font-medium text-ink">{l.label}</div>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${badge.cls}`}
        >
          {badge.label}
        </span>
      </td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums">
        <span className={l.significant ? "text-ink" : "text-graphite"}>
          {l.estimatePct}
        </span>
      </td>
      <td className="py-3 pr-3 text-right font-mono tabular-nums text-graphite">
        {l.ciPct}
      </td>
      <td className="py-3 text-right">
        <span className="font-mono tabular-nums text-ink">{l.pFormatted}</span>{" "}
        <span className={l.significant ? "font-mono text-pine" : "font-mono text-graphite"}>
          {l.stars}
        </span>
      </td>
    </tr>
  );
}

function EventBar({ p, maxAbs }: { p: RenderedEventPoint; maxAbs: number }) {
  const widthPct = Math.min(100, (Math.abs(p.estimate_pct) / maxAbs) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-right font-mono text-[11px] text-graphite">
        yr {p.year_label}
      </div>
      <div className="relative h-5 flex-1 rounded-sm bg-ink/[0.04]">
        <div
          className={`absolute left-0 top-0 h-full rounded-sm ${
            p.isPre ? "bg-graphite/25" : "bg-pine/60"
          }`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div className="w-32 shrink-0 font-mono text-[11px] tabular-nums text-graphite">
        <span className={p.significant && !p.isPre ? "text-ink" : ""}>
          {p.estimatePct}
        </span>{" "}
        {p.significant ? <span className="text-pine">{p.year_label.startsWith("-") ? "" : "*"}</span> : null}
      </div>
    </div>
  );
}
