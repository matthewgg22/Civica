// Cohort-vs-California PER gap — presentational (server component).
//
// Renders Civica's MEASURED served-cohort PER against California's PUBLISHED
// total PER (USDA FNS-380, per-history.ts) + the national average, as a
// shared-scale comparative bar chart with the CA bar drawn as a reference line.
// All three are real figures; the cohort value stays "pending" until QC reviews
// clear the n-gate. This is the honest published-data comparison — NOT a §10105
// cost-share / dollar claim (counsel-flagged, deferred, TODO-43).

import type { KpiTruthPoint } from "../../lib/analytics/kpi-snapshot";
import { perHistory } from "../../lib/analytics/per-history";
import { perGapSummary } from "../../lib/analytics/per-gap";

function pct(x: number | null, d = 2): string {
  return x == null ? "—" : `${x.toFixed(d)}%`;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

// One bar in the shared-scale chart. `refPct` draws the CA reference line
// inside every track so the segments align into one continuous dashed rule.
function GapBar({
  label,
  valuePct,
  domainMax,
  color,
  refPct,
  pending,
  emphasis,
}: {
  label: string;
  valuePct: number | null;
  domainMax: number;
  color: string;
  refPct: number;
  pending?: boolean;
  emphasis?: boolean;
}) {
  const fill = valuePct == null ? 0 : clamp((valuePct / domainMax) * 100, 0, 100);
  const refLeft = clamp((refPct / domainMax) * 100, 0, 100);

  return (
    <div className="grid grid-cols-[148px_1fr_auto] items-center gap-3">
      <p className={`text-xs ${emphasis ? "font-semibold text-ink" : "text-graphite"}`}>
        {label}
      </p>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-secondary">
        {/* CA reference line */}
        <div
          className="absolute top-0 z-10 h-full border-l border-dashed border-graphite/50"
          style={{ left: `${refLeft}%` }}
          aria-hidden="true"
        />
        {pending ? (
          <div
            className="h-full w-full opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(0,0,0,0.10) 0 6px, transparent 6px 12px)",
            }}
            aria-hidden="true"
          />
        ) : (
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${fill}%` }}
          />
        )}
      </div>
      <span
        className={`w-16 text-right text-sm tabular-nums ${emphasis ? "font-semibold text-ink" : "text-graphite"}`}
      >
        {pending ? "pending" : pct(valuePct)}
      </span>
    </div>
  );
}

export default function PerGapPanel({ truthPoint }: { truthPoint: KpiTruthPoint }) {
  // The page already renders a "pending" state when the snapshot is unpopulated.
  if (!truthPoint.available) return null;

  const history = perHistory();
  const latest = history[history.length - 1]!;
  const g = perGapSummary(truthPoint.measuredPer, latest.caTotalPER, latest.nationalTotalPER);

  // Shared scale across all three bars, with ~15% headroom.
  const domainMax = Math.ceil(
    Math.max(g.caBaselinePct, g.nationalPct, g.cohortPct ?? 0) * 1.15,
  );

  // Cohort bar color: pine when below the CA bar (better), warning when above.
  const cohortBelow = g.gapPp != null && g.gapPp >= 0;
  const cohortColor = cohortBelow ? "bg-pine/60" : "bg-warning/60";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">Our cohort vs California</h2>
        <p className="mt-1 text-xs text-graphite">
          Civica&rsquo;s measured served-cohort error rate against California&rsquo;s
          published rate (USDA FNS-380, FY{latest.fy}) and the national average. The
          dashed line is California&rsquo;s published rate — the bar to stay under.
        </p>
      </div>

      <div className="rounded-[4px] border border-hairline bg-surface p-5">
        <div className="space-y-3">
          <GapBar
            label="National average"
            valuePct={g.nationalPct}
            domainMax={domainMax}
            color="bg-graphite/40"
            refPct={g.caBaselinePct}
          />
          <GapBar
            label={`California (FY${latest.fy})`}
            valuePct={g.caBaselinePct}
            domainMax={domainMax}
            color="bg-graphite/55"
            refPct={g.caBaselinePct}
          />
          <GapBar
            label="Civica cohort"
            valuePct={g.cohortPct}
            domainMax={domainMax}
            color={cohortColor}
            refPct={g.caBaselinePct}
            pending={g.pending}
            emphasis
          />
        </div>

        <p className="mt-4 border-t border-hairline pt-4 text-sm leading-relaxed text-graphite">
          {g.pending ? (
            <>
              Once <span className="font-semibold text-ink">30+</span> served packets
              clear QC review, the measured cohort rate appears here next to
              California&rsquo;s <span className="font-semibold text-ink">{pct(g.caBaselinePct)}</span>{" "}
              — we show the gap only when it is real, never a projection.{" "}
              <span className="text-muted">({g.n} of 30 reviews collected.)</span>
            </>
          ) : cohortBelow ? (
            <>
              Our served cohort measures{" "}
              <span className="font-semibold text-ink">{pct(g.cohortPct)}</span> —{" "}
              <span className="font-semibold text-pine">{g.gapPp!.toFixed(1)} pp below</span>{" "}
              California&rsquo;s published {pct(g.caBaselinePct)}, on {g.n} authoritative
              outcomes.
            </>
          ) : (
            <>
              Our served cohort measures{" "}
              <span className="font-semibold text-ink">{pct(g.cohortPct)}</span> —{" "}
              <span className="font-semibold text-warning">
                {Math.abs(g.gapPp ?? 0).toFixed(1)} pp above
              </span>{" "}
              California&rsquo;s published {pct(g.caBaselinePct)}, on {g.n} authoritative
              outcomes.
            </>
          )}
        </p>
      </div>

      <p className="text-xs text-graphite">
        Note: this is the published-PER comparison only. The OBBBA §10105 cost-share /
        dollar-exposure view is deferred (TODO-43) until its grounded module merges and
        counsel confirms the statutory mechanism — no dollar claim is made here.
      </p>
    </section>
  );
}
