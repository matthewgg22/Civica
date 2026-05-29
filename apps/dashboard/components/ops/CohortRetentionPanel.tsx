import type { CohortData } from "../../lib/ops-fetchers";
import { DEMO_COHORT_CURVE, isDemoOpsFallbackEnabled } from "../../lib/demo-ops-data";

/**
 * Cohort retention curve. Each enrollment month is its own line, plotted across
 * 30/60/90/180 day buckets. Sparser cohorts (most recent months) only have
 * earlier-bucket points; the line terminates where data runs out.
 *
 * v1 only has "currently active" per cohort underneath, but in demo mode the
 * curve uses DEMO_COHORT_CURVE to show the v1.1-shaped retention waterfall
 * that the panel is heading toward.
 */
export default function CohortRetentionPanel({ data }: { data: CohortData }) {
  const useDemoCurve = isDemoOpsFallbackEnabled();

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1">Panel 4 · Retention</p>
          <h3 className="text-[18px] font-bold tracking-tight text-ink">Cohort retention curve</h3>
          <p className="text-[12px] text-graphite mt-1">
            % of HHs still tracking at 30 / 60 / 90 / 180 days · by enrollment month
          </p>
        </div>
        <span className="text-[10px] font-mono text-graphite uppercase tracking-wider whitespace-nowrap">
          {useDemoCurve ? "v1.1 preview shape" : "v1 · single-bucket"}
        </span>
      </div>

      {!data.available ? (
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="snap_packets / ebt_cards / applicants required."
        />
      ) : data.cohorts.length === 0 ? (
        <EmptyState
          message="Need 30+ days of enrollment data to compute first cohort."
          detail="Cohorts populate as packets submit and cards link."
        />
      ) : useDemoCurve ? (
        <RetentionCurve />
      ) : (
        <SimpleCohortBars data={data} />
      )}
    </section>
  );
}

const BUCKET_LABELS = ["d30", "d60", "d90", "d180"] as const;
const BUCKET_X = [0, 0.333, 0.667, 1] as const;

function RetentionCurve() {
  const cohorts = DEMO_COHORT_CURVE;
  const W = 720;
  const H = 280;
  const PAD_T = 20;
  const PAD_B = 40;
  const PAD_L = 50;
  const PAD_R = 20;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  // y: 0..100 (percent). x: bucket index 0..3 mapped to plotW.
  const xAt = (idx: number) => PAD_L + BUCKET_X[idx]! * plotW;
  const yAt = (pct: number) => PAD_T + (1 - pct / 100) * plotH;

  // Pine gradient: oldest cohort = darkest pine, newest = lightest. Mirrors
  // the choropleth's pine intensity language across the page.
  const cohortColor = (idx: number, total: number): string => {
    const t = total > 1 ? idx / (total - 1) : 0;
    // dark pine → light pine
    if (t < 0.2) return "#224636";
    if (t < 0.4) return "#3F7559";
    if (t < 0.6) return "#6B9B7E";
    if (t < 0.8) return "#A8C7B3";
    return "#D8E6DE";
  };

  return (
    <div className="pt-4">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {/* Y gridlines + labels (0 / 25 / 50 / 75 / 100) */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line
              x1={PAD_L} x2={W - PAD_R}
              y1={yAt(pct)} y2={yAt(pct)}
              stroke="#E5E0D3"
              strokeWidth={pct === 0 ? 1.5 : 1}
              strokeDasharray={pct === 0 || pct === 100 ? "none" : "2 4"}
            />
            <text
              x={PAD_L - 8}
              y={yAt(pct) + 4}
              fontSize="10"
              fontFamily="ui-monospace, monospace"
              fill="#6B6256"
              textAnchor="end"
            >
              {pct}%
            </text>
          </g>
        ))}

        {/* X labels */}
        {BUCKET_LABELS.map((lbl, i) => (
          <text
            key={lbl}
            x={xAt(i)}
            y={H - PAD_B + 18}
            fontSize="11"
            fontFamily="ui-monospace, monospace"
            fill="#322E27"
            textAnchor="middle"
            fontWeight="600"
          >
            {lbl}
          </text>
        ))}

        {/* Cohort lines */}
        {cohorts.map((c, idx) => {
          const pts: Array<{ x: number; y: number }> = [];
          if (c.d30 != null) pts.push({ x: xAt(0), y: yAt(c.d30) });
          if (c.d60 != null) pts.push({ x: xAt(1), y: yAt(c.d60) });
          if (c.d90 != null) pts.push({ x: xAt(2), y: yAt(c.d90) });
          if (c.d180 != null) pts.push({ x: xAt(3), y: yAt(c.d180) });

          const color = cohortColor(idx, cohorts.length);
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

          return (
            <g key={c.enrollment_month}>
              <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 px-2">
        {cohorts.map((c, idx) => (
          <div key={c.enrollment_month} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="block w-3 h-3 rounded-sm"
              style={{ backgroundColor: cohortColor(idx, cohorts.length) }}
            />
            <span className="text-[11px] font-mono text-graphite tabular-nums">{c.enrollment_month}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-graphite mt-4 italic">
        Older cohorts have full 180d data; newest cohorts terminate at the latest available bucket.
        Pine intensity tracks cohort age (dark = oldest, light = newest).
      </p>
    </div>
  );
}

function SimpleCohortBars({ data }: { data: CohortData }) {
  return (
    <div className="pt-4">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left">
            <th className="font-semibold text-graphite pb-2 uppercase tracking-wider text-[10px]">Enrollment month</th>
            <th className="font-semibold text-graphite pb-2 px-3 uppercase tracking-wider text-[10px] text-right">Packets</th>
            <th className="font-semibold text-graphite pb-2 px-3 uppercase tracking-wider text-[10px] text-right">Active now</th>
            <th className="font-semibold text-graphite pb-2 px-3 uppercase tracking-wider text-[10px] text-right">% Active</th>
            <th className="font-semibold text-graphite pb-2 pl-3 uppercase tracking-wider text-[10px]">Visual</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {data.cohorts.map((c) => (
            <tr key={c.enrollment_month}>
              <td className="py-2 font-semibold text-ink font-mono tabular-nums">{c.enrollment_month}</td>
              <td className="py-2 px-3 text-right tabular-nums">{c.packet_count}</td>
              <td className="py-2 px-3 text-right tabular-nums">{c.currently_active}</td>
              <td className="py-2 px-3 text-right tabular-nums font-semibold">{c.active_pct}%</td>
              <td className="py-2 pl-3 w-32">
                <div className="h-2 bg-paper rounded-full overflow-hidden">
                  <div className="h-full bg-pine" style={{ width: `${Math.min(100, c.active_pct)}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-graphite mt-4 italic">
        v1 shows a single &ldquo;currently active&rdquo; bucket per cohort. v1.1 adds 30/60/90/180-day buckets once balance snapshot history exists.
      </p>
    </div>
  );
}

function EmptyState({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="pt-5 border-t border-hairline">
      <p className="text-[14px] font-semibold text-ink">{message}</p>
      <p className="text-[12px] text-graphite mt-1 font-mono">{detail}</p>
    </div>
  );
}
