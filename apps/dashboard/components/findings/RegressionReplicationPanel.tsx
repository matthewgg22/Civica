// External replication panel — rendered below the pre-registered analysis on
// /findings/regression. Presentational only: takes a PolicyRegressionReport
// (built by lib/analytics/policy-regression.ts from the harness artifact) and
// renders the R² ladder by policy family, the parsimonious coefficients across
// outcomes, the state-trend robustness, and the BBCE event study.
//
// Every number here is REAL published public data — 51 states × 1996-2020 — so
// the banner is a confident "public data". It is the external proof that the
// mechanism Civica sells (lower administrative burden → more eligible people
// enrolled and retained) holds before Civica has shipped a case.

import type {
  PolicyRegressionReport,
  RenderedEventPoint,
  RenderedLever,
} from "../../lib/analytics/policy-regression";

const GITHUB_BLOB =
  "https://github.com/matthewgg22/Civica/blob/codex/rebuild-feb18";

function r2Cell(v: number): string {
  return v <= 0.005 ? "≈0" : v.toFixed(2);
}

export default function RegressionReplicationPanel({
  report,
}: {
  report: PolicyRegressionReport;
}) {
  const { provenance, r2Ladder, parsimonious, robustness, eventStudy } = report;
  const participation = parsimonious.outcomes.find((o) => o.key === "participation");
  const households = parsimonious.outcomes.find((o) => o.key === "households");
  const hhByKey = new Map(households?.levers.map((l) => [l.key, l]) ?? []);
  const maxAbs = Math.max(...eventStudy.points.map((p) => Math.abs(p.estimate_pct)), 5);

  return (
    <section className="space-y-8">
      {/* Banner. */}
      <div className="rounded-lg border border-pine/30 bg-pine/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-pine">
          <span className="rounded bg-pine/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
            Public data
          </span>
          {report.panel.states} states × {report.panel.period.replace("..", "–")} ·{" "}
          {report.panel.n_levers} policy levers
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite">
          Civica&rsquo;s own causal estimate awaits production traffic (above).
          This is the <span className="font-medium text-ink">external</span> test:
          on a quarter-century of published state data, does cutting
          administrative burden move the outcome? {report.design}.
        </p>
      </div>

      {/* R² ladder — the "what's captured" centerpiece. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-graphite">
          What each policy family explains (within-R² ladder)
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          Policy levers added in families; each cell is the cumulative
          within-R² — the share of within-state, within-month variation the
          levers explain once state and calendar-month fixed effects absorb the
          fixed differences and the national cycle.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-graphite/20 text-left">
                <th className="w-[34%] pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  Outcome
                </th>
                {r2Ladder.cumulative.map((c) => (
                  <th
                    key={c}
                    className="pb-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-wider text-graphite"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r2Ladder.outcomes.map((o) => (
                <tr key={o.key} className="border-b border-graphite/10">
                  <td className="py-2.5 pr-3 font-medium text-ink">{o.label}</td>
                  {o.within_r2.map((v, i) => (
                    <td
                      key={i}
                      className={`py-2.5 pr-3 text-right font-mono tabular-nums ${
                        i === o.within_r2.length - 1 ? "text-ink" : "text-graphite"
                      }`}
                    >
                      {r2Cell(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 border-l-2 border-pine/30 pl-3 text-sm leading-relaxed text-graphite">
          <span className="font-semibold text-ink">What this means. </span>
          Transaction-cost modernization (call centers, online apps, simplified
          reporting) captures the biggest jump in participation and caseload —
          but <span className="text-ink">no family explains average benefit per
          person</span> (≈0), because the benefit <em>level</em> is set by federal
          formula. State policy moves <em>who is enrolled</em>, not how much they
          get — exactly the retention margin Civica targets.
        </p>
      </div>

      {/* Parsimonious coefficients across outcomes. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-graphite">
          Effect per lever (parsimonious spec — interpretable coefficients)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-graphite/20 text-left">
                <th className="w-[42%] pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  Policy lever
                </th>
                <th className="pb-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  Participation
                </th>
                <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-graphite">
                  Caseload
                </th>
              </tr>
            </thead>
            <tbody>
              {participation?.levers.map((l) => (
                <CoefRow key={l.key} part={l} hh={hhByKey.get(l.key)} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-graphite">
          % change in the outcome when the lever is on; stars *** p&lt;0.001, **
          p&lt;0.01, * p&lt;0.05. Average benefit omitted — every lever is &lt;1%
          and non-significant there.
        </p>
      </div>

      {/* Robustness. */}
      <div className="rounded-md border border-graphite/15 bg-surface-secondary p-4 text-sm">
        <p className="font-semibold text-ink">Robustness — state-specific trends</p>
        <p className="mt-1 leading-relaxed text-graphite">
          Adding a separate linear time trend per state (the smooth part of
          state-specific economic divergence the national time effects
          don&rsquo;t absorb):{" "}
          {robustness.levers
            .filter((l) => l.significant)
            .map((l) => `${l.label.split(" ").slice(0, 2).join(" ")} ${l.estimatePct}`)
            .join(", ")}{" "}
          stay significant; the rest attenuate. The two strongest levers survive
          the toughest control available without external data.
        </p>
      </div>

      {/* BBCE event study. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-graphite">
          Event study — {eventStudy.treatment}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          Participation around BBCE adoption vs the year before
          ({eventStudy.neverAdopterStates} never-adopters as controls). Flat,
          insignificant pre-trends (the parallel-trend check), then a rising
          post-path — the signature of a causal effect.
        </p>
        <div className="mt-4 space-y-1.5">
          {eventStudy.points.map((p) => (
            <EventBar key={p.year_label} p={p} maxAbs={maxAbs} />
          ))}
        </div>
      </div>

      {/* Honest limits + collinearity. */}
      <div className="rounded-md border border-graphite/15 bg-surface-secondary p-4 text-sm">
        <p className="font-semibold text-ink">How to read this honestly</p>
        <p className="mt-1 leading-relaxed text-graphite">{report.benchmark}</p>
        <p className="mt-2 leading-relaxed text-graphite">
          <span className="font-medium text-ink">Why two views. </span>
          {report.collinearityNote}
        </p>
        <p className="mt-2 leading-relaxed text-graphite">
          <span className="font-medium text-ink">Limits. </span>
          TWFE with staggered adoption can be biased under heterogeneity — the
          event study is the more credible read. {provenance.cycle_control}{" "}
          Participation is the retention margin, not payment error directly.
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
          <span className="font-mono">{provenance.environment.linearmodels}</span> · n={" "}
          <span className="font-mono tabular-nums">{parsimonious.n.toLocaleString()}</span>{" "}
          state-months.
        </p>
        <p className="mt-2">
          Outcome: FNS monthly participation · Treatment: USDA ERS SNAP Policy
          Database · Harness:{" "}
          <a
            href={`${GITHUB_BLOB}/tools/snap-policy-regression/src/build_policy_regression.py`}
            className="text-pine underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            tools/snap-policy-regression
          </a>{" "}
          · Panel: <span className="font-mono">{provenance.panel_file}</span>.
        </p>
      </footer>
    </section>
  );
}

function CoefRow({ part, hh }: { part: RenderedLever; hh?: RenderedLever }) {
  return (
    <tr className="border-b border-graphite/10 align-top">
      <td className="py-2.5 pr-3">
        <span className="font-medium text-ink">{part.label}</span>
        <KindTag kind={part.kind} />
      </td>
      <CoefCell l={part} />
      {hh ? <CoefCell l={hh} /> : <td className="py-2.5 text-right text-graphite">—</td>}
    </tr>
  );
}

function CoefCell({ l }: { l: RenderedLever }) {
  return (
    <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
      <span className={l.significant ? "text-ink" : "text-graphite"}>{l.estimatePct}</span>{" "}
      <span className="text-pine">{l.stars === "ns" ? "" : l.stars}</span>
    </td>
  );
}

function KindTag({ kind }: { kind: RenderedLever["kind"] }) {
  const m = {
    reduces_burden: { label: "burden ↓", cls: "bg-pine/10 text-pine" },
    expands_eligibility: { label: "eligibility ↑", cls: "bg-pine/10 text-pine" },
    increases_burden: { label: "burden ↑", cls: "bg-graphite/10 text-graphite" },
  }[kind];
  return (
    <span
      className={`ml-2 inline-block rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${m.cls}`}
    >
      {m.label}
    </span>
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
      <div className="w-28 shrink-0 font-mono text-[11px] tabular-nums text-graphite">
        <span className={p.significant && !p.isPre ? "text-ink" : ""}>{p.estimatePct}</span>{" "}
        {p.significant && !p.isPre ? <span className="text-pine">*</span> : null}
      </div>
    </div>
  );
}
