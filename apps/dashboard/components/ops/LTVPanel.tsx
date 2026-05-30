import type { LTVData } from "../../lib/ops-fetchers";
import { CountUp } from "./CountUp";

/**
 * Panel 11 · LTV per active tracker.
 *
 * The headline composite metric: every Civica-tracked household is worth
 * $X/yr to the company. Left column carries the BIG number (annualized
 * from current 30d revenue run-rate). Right column decomposes that number
 * by revenue line — live lines in solid pine, projected/roadmap lines
 * dashed to show the ceiling LTV becomes when planned monetization ships.
 *
 * This is the fundability metric — the one a demo viewer remembers and
 * the one that anchors the company's valuation story.
 */
export default function LTVPanel({ data }: { data: LTVData }) {
  if (!data.available) {
    return (
      <section className="bg-surface border-2 border-pine/30 rounded-[4px] p-6">
        <div className="mb-4">
          <p className="eyebrow mb-1 text-pine">Panel 11 · LTV</p>
          <h2 className="text-[18px] font-bold tracking-tight text-ink">Lifetime value per active tracker</h2>
        </div>
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="LTV rollup view is not present locally."
        />
      </section>
    );
  }

  const liveTotal = data.live_lines.reduce((s, l) => s + l.dollars_per_tracker_year, 0);
  const projectedTotal = liveTotal + data.projected_lines.reduce((s, l) => s + l.dollars_per_tracker_year, 0);
  // CountUp's "usd-full" formatter expects cents — pass dollars × 100 so the
  // animated readout renders "$116" without fractional pennies. The "/ yr"
  // suffix sits outside the animated span.
  const headlineCents = Math.round(data.headline_dollars_per_tracker_year * 100);
  // Bar chart scale: use the projected total as the ceiling so live bars
  // visibly show "how much headroom is left".
  const chartMax = Math.max(projectedTotal, 1);

  return (
    <section className="bg-surface border-2 border-pine/30 rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1 text-pine">Panel 11 · LTV</p>
          <h2 className="text-[18px] font-bold tracking-tight text-ink">Lifetime value per active tracker</h2>
          <p className="text-[12px] text-graphite mt-1">
            Annualized from current 30d run-rate · decomposed by revenue line · projected ceiling shows roadmap potential
          </p>
        </div>
        <span className="text-[10px] font-mono text-graphite uppercase tracking-wider whitespace-nowrap">
          Annualized · ×12 from 30d revenue
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-8 pt-5 border-t border-hairline">
        {/* Left: big headline number */}
        <div className="flex flex-col justify-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">
            Current LTV · per active tracker · per year
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-[64px] font-bold tracking-tight text-pine leading-none tabular-nums">
              <CountUp target={headlineCents} format="usd-full" durationMs={1800} />
            </p>
            <p className="text-[20px] font-semibold text-graphite leading-none">/ yr</p>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-pine/10 text-pine text-[11px] font-mono font-semibold tabular-nums">
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
                <path d="M5 1 L9 7 L1 7 Z" fill="currentColor" />
              </svg>
              {data.trajectory_mom_pct > 0 ? "+" : ""}{data.trajectory_mom_pct}% MoM
            </span>
            <span className="text-[11px] text-graphite tabular-nums">
              vs prior 30d
            </span>
          </div>

          <p className="text-[12px] text-graphite mt-4 leading-relaxed">
            Annualized from current 30d monetization run-rate ·{" "}
            <span className="font-semibold text-ink tabular-nums">
              {data.active_trackers.toLocaleString()}
            </span>{" "}
            active trackers
          </p>

          <div className="mt-5 pt-4 border-t border-hairline">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">
              Projected post-roadmap ceiling
            </p>
            <p className="text-[24px] font-bold tabular-nums text-ink leading-none">
              ${Math.round(projectedTotal).toLocaleString()}<span className="text-[14px] text-graphite font-semibold"> / yr</span>
            </p>
            <p className="text-[11px] text-graphite mt-1">
              when WOTC + tax prep + other verticals ship
            </p>
          </div>
        </div>

        {/* Right: decomposition bar chart */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">
              Revenue decomposition · $ / tracker / yr
            </p>
            <p className="text-[11px] font-mono text-graphite tabular-nums">
              live ${liveTotal.toFixed(2)} · ceiling ${projectedTotal.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            {data.live_lines.map((line) => (
              <BarRow
                key={line.key}
                label={line.label}
                dollars={line.dollars_per_tracker_year}
                sharePct={line.share_pct}
                widthPct={(line.dollars_per_tracker_year / chartMax) * 100}
                projected={false}
              />
            ))}

            <div className="pt-2 mt-2 border-t border-dashed border-hairline">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite/80 mb-2">
                Projected · roadmap monetization
              </p>
              {data.projected_lines.map((line) => (
                <BarRow
                  key={line.key}
                  label={line.label}
                  dollars={line.dollars_per_tracker_year}
                  sharePct={line.share_pct}
                  widthPct={(line.dollars_per_tracker_year / chartMax) * 100}
                  projected
                />
              ))}
            </div>
          </div>

          {/* Ceiling marker legend */}
          <div className="flex items-center gap-4 mt-4 text-[11px] text-graphite">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="block w-3 h-2 rounded-sm bg-pine" /> Live revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="block w-3 h-2 rounded-sm border border-pine/60"
                style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(31,83,64,0.25) 0 2px, transparent 2px 4px)" }}
              />{" "}
              Projected (roadmap)
            </span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-graphite mt-4 italic">
        Live LTV reflects Medicare Advantage referrals + partner-offer revenue only.
        Projected lines assume H.R. 1177 WOTC extension passes + tax prep partnerships sign in FY26.
      </p>
    </section>
  );
}

function BarRow({
  label,
  dollars,
  sharePct,
  widthPct,
  projected,
}: {
  label: string;
  dollars: number;
  sharePct: number;
  widthPct: number;
  projected: boolean;
}) {
  // Solid pine for live; semi-transparent diagonal-stripe pine for projected.
  // SVG + Tailwind only — no chart library.
  const safeWidth = Math.max(2, Math.min(100, widthPct));
  return (
    <div className="flex items-center gap-3">
      <span
        className={`w-40 text-[12px] shrink-0 ${projected ? "text-graphite italic" : "font-semibold text-ink"}`}
        title={label}
      >
        {label}
      </span>
      <div className="flex-1 h-6 bg-paper rounded-[3px] overflow-hidden relative">
        <div
          className={`h-full flex items-center justify-end pr-2 ${projected ? "border border-pine/40" : "bg-pine"}`}
          style={{
            width: `${safeWidth}%`,
            ...(projected
              ? {
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(31,83,64,0.28) 0 4px, rgba(31,83,64,0.05) 4px 8px)",
                }
              : {}),
          }}
        >
          <span
            className={`text-[11px] font-mono font-bold tabular-nums ${projected ? "text-pine" : "text-white"}`}
          >
            ${dollars.toFixed(2)}
          </span>
        </div>
      </div>
      <span className="w-12 text-right text-[11px] font-mono text-graphite tabular-nums shrink-0">
        {sharePct.toFixed(1)}%
      </span>
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
