// Cohort-vs-California PER gap — presentational (server component).
//
// Renders Civica's MEASURED served-cohort PER against California's PUBLISHED
// total PER (USDA FNS-380, per-history.ts) + the national average. All three are
// real figures; the cohort value stays "pending" until QC reviews clear the
// n-gate (Lane A sources it from internal QC). This is the honest published-data
// comparison — NOT a §10105 cost-share/dollar claim (that mechanism is
// counsel-flagged and its grounded module is unmerged; deferred, TODO-43).

import type { KpiTruthPoint } from "../../lib/analytics/kpi-snapshot";
import { perHistory } from "../../lib/analytics/per-history";
import { perGapSummary } from "../../lib/analytics/per-gap";

function pct(x: number | null): string {
  return x == null ? "—" : `${x.toFixed(2)}%`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-graphite/15 bg-surface-secondary p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-graphite">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {sub ? <p className="mt-1 text-xs text-graphite">{sub}</p> : null}
    </div>
  );
}

export default function PerGapPanel({ truthPoint }: { truthPoint: KpiTruthPoint }) {
  // The page already renders a "pending" state when the snapshot is unpopulated.
  if (!truthPoint.available) return null;

  const history = perHistory();
  const latest = history[history.length - 1]!;
  const g = perGapSummary(truthPoint.measuredPer, latest.caTotalPER, latest.nationalTotalPER);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">Our cohort vs California</h2>
        <p className="mt-1 text-xs text-graphite">
          Civica&rsquo;s measured served-cohort error rate against California&rsquo;s
          published rate (USDA FNS-380, FY{latest.fy}) and the national average.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label={`CA published (FY${latest.fy})`} value={pct(g.caBaselinePct)} sub="USDA FNS-380" />
        <Stat label="National avg" value={pct(g.nationalPct)} sub={`FY${latest.fy}`} />
        <Stat
          label="Civica cohort (measured)"
          value={g.pending ? "pending" : pct(g.cohortPct)}
          sub={g.pending ? `n=${g.n} of 30 QC reviews` : `n=${g.n} authoritative`}
        />
      </div>

      <p className="text-sm leading-relaxed text-graphite">
        {g.pending ? (
          <>
            Once <span className="text-ink">30+</span> served packets clear QC review, the
            measured cohort rate appears here next to California&rsquo;s{" "}
            <span className="text-ink">{pct(g.caBaselinePct)}</span> — we show the gap only
            when it is real, never a projection.
          </>
        ) : g.gapPp != null && g.gapPp >= 0 ? (
          <>
            Our served cohort measures <span className="text-ink">{pct(g.cohortPct)}</span> —{" "}
            <span className="font-semibold text-pine">{g.gapPp.toFixed(1)} pp below</span>{" "}
            California&rsquo;s published {pct(g.caBaselinePct)}.
          </>
        ) : (
          <>
            Our served cohort measures <span className="text-ink">{pct(g.cohortPct)}</span> —{" "}
            <span className="font-semibold text-warning">
              {Math.abs(g.gapPp ?? 0).toFixed(1)} pp above
            </span>{" "}
            California&rsquo;s published {pct(g.caBaselinePct)}.
          </>
        )}
      </p>

      <p className="text-xs text-graphite">
        Note: this is the published-PER comparison only. The OBBBA §10105 cost-share /
        dollar-exposure view is deferred (TODO-43) until its grounded module merges and
        counsel confirms the statutory mechanism — no dollar claim is made here.
      </p>
    </section>
  );
}
