import {
  APPLICATION_MONTHS,
  rankedByExposure,
  type CountyExposureData,
} from "../lib/countyExposure";

// CountyLeaderboard — server component.
//
// Renders all 58 CA counties ranked by estimated cumulative §10105 penalty
// exposure (descending). Each row shows: rank, county name, caseload share %,
// estimated exposure $, and an 8-month application-volume sparkline.
//
// Anchor for the B2G pitch: a state deputy looking at this list sees their
// county's relative rank (and the dollar number that follows it). County
// directors who later see /county will compare against this same ordering.
//
// No client interactivity — pure server component. The data is static
// (compiled in JS, no DB round-trip). When a row links to /county-demo
// (which lives on the unmerged compliance branch), the slug is already
// the right shape — the link becomes live the moment that route lands.

interface Props {
  /** Optional cap on how many rows to render. Useful for "Top 10" embeds
   *  elsewhere. Defaults to all 58 counties. */
  limit?: number;
  /** Title rendered above the table. Defaults to the CDSS framing. */
  title?: string;
  /** Optional subtitle / methodology line. */
  subtitle?: string;
}

export default function CountyLeaderboard({
  limit,
  title = "California county leaderboard",
  subtitle = "Estimated cumulative §10105 federal admin-match exposure FY2026–FY2028, ranked by county. Caseload share derived from CDSS CF 296 application volume (Jul 2025 – Feb 2026, 8-month rolling). Real per-county PER is FOIA-only; swap when it lands.",
}: Props) {
  const ranked = rankedByExposure();
  const rows = typeof limit === "number" ? ranked.slice(0, limit) : ranked;

  return (
    <div className="border border-hairline rounded-[4px] bg-surface p-5 md:p-6">
      <p className="eyebrow mb-2">{title}</p>
      <p className="text-[12px] text-muted mb-5 leading-relaxed max-w-3xl">
        {subtitle}
      </p>

      <div className="overflow-x-auto -mx-1">
        <table
          className="w-full text-sm border-collapse"
          aria-label="California counties ranked by estimated §10105 penalty exposure"
        >
          <thead>
            <tr className="border-b border-hairline">
              <th className="text-left text-[11px] text-graphite uppercase tracking-wider font-semibold pb-2 pr-3 pl-1 w-12">
                Rank
              </th>
              <th className="text-left text-[11px] text-graphite uppercase tracking-wider font-semibold pb-2 pr-4">
                County
              </th>
              <th className="text-right text-[11px] text-graphite uppercase tracking-wider font-semibold pb-2 pr-4">
                Caseload share
              </th>
              <th className="text-right text-[11px] text-graphite uppercase tracking-wider font-semibold pb-2 pr-4">
                Est. §10105 exposure
              </th>
              <th className="text-left text-[11px] text-graphite uppercase tracking-wider font-semibold pb-2 pr-1 w-32">
                Application volume (8-mo)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((county, i) => (
              <LeaderboardRow key={county.slug} county={county} rank={i + 1} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-graphite mt-4 leading-relaxed">
        Methodology: §10105 imposes a proportional loss of federal admin
        match on states whose PER ≥ 105% of the national average. County-level
        exposure here = county&apos;s % of CA CalFresh application volume ×
        CA&apos;s cumulative FY2026–FY2028 exposure ($510M, per
        section10105.ts). Treats county PER as tracking state PER
        proportionally pending county-level FNS QC data (FOIA).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function LeaderboardRow({
  county,
  rank,
}: {
  county: CountyExposureData;
  rank: number;
}) {
  const isTop3 = rank <= 3;
  return (
    <tr className="border-b border-hairline last:border-0 hover:bg-paper transition-colors">
      <td className="py-2.5 pr-3 pl-1 text-graphite tabular-nums">
        <span className={isTop3 ? "font-semibold text-ink" : ""}>{rank}</span>
      </td>
      <td className="py-2.5 pr-4">
        <span className="font-medium text-ink">{county.displayName}</span>
        {county.notableContext && (
          <span
            className="ml-1 text-[10px] text-graphite"
            title={county.notableContext}
            aria-label={`Note: ${county.notableContext}`}
          >
            ⓘ
          </span>
        )}
      </td>
      <td className="py-2.5 pr-4 text-right text-graphite tabular-nums">
        {county.caseloadSharePctLabel}
      </td>
      <td
        className="py-2.5 pr-4 text-right tabular-nums font-semibold"
        style={{
          color: isTop3 ? "var(--color-amber)" : "var(--color-ink)",
        }}
      >
        {county.estimatedExposureLabel}
      </td>
      <td className="py-2.5 pr-1">
        <Sparkline
          values={county.monthlyApplications}
          monthLabels={APPLICATION_MONTHS}
          countyName={county.displayName}
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG sparkline. Avoids pulling in d3-* for an 8-point line.
// ---------------------------------------------------------------------------

interface SparklineProps {
  values: readonly number[];
  monthLabels: readonly string[];
  countyName: string;
}

function Sparkline({ values, monthLabels, countyName }: SparklineProps) {
  // Filter trailing zeros (missing-data placeholders). Don't filter
  // mid-series — a real zero application month is unusual but real.
  const meaningful = values.filter((v, i) => !(v === 0 && i === values.length - 1));
  if (meaningful.length < 2) {
    return (
      <span className="text-[10px] text-graphite italic">insufficient data</span>
    );
  }

  const width = 96;
  const height = 22;
  const padX = 2;
  const padY = 3;

  const max = Math.max(...meaningful);
  const min = Math.min(...meaningful);
  const span = Math.max(1, max - min);

  const step = (width - 2 * padX) / Math.max(1, meaningful.length - 1);
  const points = meaningful.map((v, i) => {
    const x = padX + i * step;
    const y = padY + (height - 2 * padY) * (1 - (v - min) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // First → last as a one-line summary for screen readers.
  const first = meaningful[0]!;
  const last = meaningful[meaningful.length - 1]!;
  const slope =
    last > first ? "increasing" : last < first ? "decreasing" : "flat";
  const startLabel = monthLabels[0] ?? "start";
  const endLabel =
    monthLabels[meaningful.length - 1] ??
    monthLabels[monthLabels.length - 1] ??
    "end";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${countyName} application volume, ${slope} from ${first.toLocaleString()} in ${startLabel} to ${last.toLocaleString()} in ${endLabel}`}
      className="block"
    >
      <polyline
        fill="none"
        stroke="var(--color-pine)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(" ")}
      />
    </svg>
  );
}
