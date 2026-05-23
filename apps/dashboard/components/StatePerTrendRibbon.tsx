import { perHistory } from "../lib/analytics/per-history";

// StatePerTrendRibbon — server component.
//
// Visible reuse of LB2's per-history.ts data work, rendered above the CDSS
// county leaderboard. Tells a procurement-evaluating state deputy:
// "Here's where you were, here's where you are, here's the §10105 line."
//
// Reading order on /cdss becomes:
//   statewide PER number → error categories → penalty exposure $
//   → PER trend (this ribbon) → county leaderboard → measurement window
//
// Pure server component — no client interactivity. Inline SVG sparklines
// match the pattern used by CountyLeaderboard. No d3 / no chart libraries.

export default function StatePerTrendRibbon() {
  const points = perHistory();
  const earliest = points[0]!;
  const latest = points[points.length - 1]!;

  const caSeries = points.map((p) => ({ fy: p.fy, value: p.caTotalPER }));
  const nationalSeries = points.map((p) => ({ fy: p.fy, value: p.nationalTotalPER }));
  const thresholdValues = points.map((p) => p.thresholdPER);

  // Threshold line uses the latest fiscal year's threshold for the callout copy.
  const latestThreshold = latest.thresholdPER;

  return (
    <div className="border border-hairline rounded-[4px] bg-surface p-5 md:p-6">
      <p className="eyebrow mb-2">
        Statewide PER trend (FY{earliest.fy} → present)
      </p>
      <p className="text-[12px] text-muted mb-5 leading-relaxed max-w-3xl">
        California total Payment Error Rate vs national average over the most
        recent measured fiscal years. The amber reference line marks the
        §10105 threshold (105% × national average) — states with a PER at or
        above the line face proportional admin-match exposure.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <TrendColumn
          label="California"
          sublabel={`FY${latest.fy} total PER`}
          series={caSeries}
          thresholds={thresholdValues}
          strokeVar="var(--color-amber)"
          showThresholdLine
          accentVar="var(--color-amber)"
        />
        <TrendColumn
          label="National average"
          sublabel={`FY${latest.fy} total PER`}
          series={nationalSeries}
          thresholds={thresholdValues}
          strokeVar="var(--color-graphite)"
          showThresholdLine
          accentVar="var(--color-ink)"
        />
      </div>

      {/* §10105 threshold callout */}
      <div
        className="mt-5 p-3 rounded-[4px] flex items-start gap-3"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-amber) 6%, transparent)",
        }}
      >
        <div
          className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: "var(--color-amber)" }}
          aria-hidden="true"
        />
        <p className="text-[12px] text-graphite leading-relaxed">
          <span className="font-semibold text-ink">
            §10105 threshold = 105% × national avg = {latestThreshold}%
          </span>{" "}
          (FY{latest.fy}). California&apos;s FY{latest.fy} total PER of{" "}
          <span className="tabular-nums font-semibold text-ink">
            {latest.caTotalPER}%
          </span>{" "}
          sits {latest.caTotalPER >= latestThreshold ? "above" : "below"} the
          line — driving the cumulative federal admin-match exposure shown in
          the county leaderboard below.
        </p>
      </div>

      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Source: USDA FNS official QC payment error rate publications.
        FY2020–FY2021 excluded (FNS suspended measurement during COVID-19).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-series column: large number + tiny SVG line
// ---------------------------------------------------------------------------

interface TrendColumnProps {
  label: string;
  sublabel: string;
  series: ReadonlyArray<{ fy: number; value: number }>;
  thresholds: ReadonlyArray<number>;
  strokeVar: string;
  showThresholdLine: boolean;
  accentVar: string;
}

function TrendColumn({
  label,
  sublabel,
  series,
  thresholds,
  strokeVar,
  showThresholdLine,
  accentVar,
}: TrendColumnProps) {
  const first = series[0]!;
  const last = series[series.length - 1]!;

  return (
    <div className="flex flex-col">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className="text-3xl font-semibold tabular-nums mt-2 leading-none"
        style={{ color: accentVar }}
      >
        {last.value}%
      </p>
      <p className="text-[12px] text-graphite mt-1.5 leading-relaxed">
        {sublabel} (was {first.value}% in FY{first.fy})
      </p>
      <div className="mt-3">
        <TrendLine
          label={label}
          series={series}
          thresholds={thresholds}
          strokeVar={strokeVar}
          showThresholdLine={showThresholdLine}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG line. Matches the CountyLeaderboard sparkline pattern.
// ---------------------------------------------------------------------------

interface TrendLineProps {
  label: string;
  series: ReadonlyArray<{ fy: number; value: number }>;
  thresholds: ReadonlyArray<number>;
  strokeVar: string;
  showThresholdLine: boolean;
}

function TrendLine({
  label,
  series,
  thresholds,
  strokeVar,
  showThresholdLine,
}: TrendLineProps) {
  const width = 240;
  const height = 60;
  const padX = 6;
  const padY = 6;

  // Use a shared y-domain across the series + the threshold band so the
  // threshold line is visually meaningful relative to the data.
  const seriesValues = series.map((p) => p.value);
  const allValues = [...seriesValues, ...thresholds];
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  // Add some headroom so the line isn't pinned to the top/bottom edge.
  const headroom = Math.max(0.5, (max - min) * 0.2);
  const yMax = max + headroom;
  const yMin = Math.max(0, min - headroom);
  const span = Math.max(0.1, yMax - yMin);

  const innerW = width - 2 * padX;
  const innerH = height - 2 * padY;

  const step = innerW / Math.max(1, series.length - 1);
  const points = series.map((p, i) => {
    const x = padX + i * step;
    const y = padY + innerH * (1 - (p.value - yMin) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Threshold reference: draw a horizontal dashed line at the latest
  // threshold value (the cumulative measure that matters for §10105
  // is the multi-year window, but the visual reference uses the most
  // recently published threshold).
  const latestThreshold = thresholds[thresholds.length - 1]!;
  const thresholdY = padY + innerH * (1 - (latestThreshold - yMin) / span);

  // Screen-reader summary: start → end + slope direction.
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const slope =
    last.value > first.value
      ? "increasing"
      : last.value < first.value
      ? "decreasing"
      : "flat";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label} total Payment Error Rate, ${slope} from ${first.value}% in FY${first.fy} to ${last.value}% in FY${last.fy}`}
      className="block max-w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {showThresholdLine && (
        <line
          x1={padX}
          x2={width - padX}
          y1={thresholdY.toFixed(1)}
          y2={thresholdY.toFixed(1)}
          stroke="var(--color-amber)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.7"
          aria-hidden="true"
        />
      )}
      <polyline
        fill="none"
        stroke={strokeVar}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(" ")}
      />
      {/* Endpoint dot — emphasizes the latest value */}
      {(() => {
        const lastIdx = series.length - 1;
        const cx = padX + lastIdx * step;
        const cy = padY + innerH * (1 - (last.value - yMin) / span);
        return (
          <circle
            cx={cx.toFixed(1)}
            cy={cy.toFixed(1)}
            r="2.5"
            fill={strokeVar}
            aria-hidden="true"
          />
        );
      })()}
    </svg>
  );
}
