import type { EbtAggregateData } from "../../lib/ops-fetchers";
import { CountUp } from "./CountUp";

/**
 * Panel 1 — EBT balance aggregate. The hero strip at the top of the page
 * carries the headline-number duty; this panel adds detail: full $ figure
 * (not compact), per-user average, and coverage ratio bar.
 */
export default function EBTBalancePanel({ data }: { data: EbtAggregateData }) {
  const coveragePct = data.total_card_count > 0
    ? Math.round((data.active_tracker_count / data.total_card_count) * 100)
    : 0;
  const avgPerActive = data.active_tracker_count > 0
    ? data.total_balance_cents / data.active_tracker_count
    : 0;

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1">Panel 1 · EBT Tracker · Detail</p>
          <h2 className="text-[18px] font-bold tracking-tight text-ink">SNAP balance breakdown</h2>
          <p className="text-[12px] text-graphite mt-1">
            Full-precision balance figure · per-tracker average · linked-vs-active coverage
          </p>
        </div>
        <span className="text-[10px] font-mono text-graphite uppercase tracking-wider whitespace-nowrap">
          Updated every 30s · scraper freshness ≤30 min
        </span>
      </div>

      {!data.available ? (
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="The ebt_card_aggregates_v view from 20260581_ops_dashboard_schema.sql is missing locally."
        />
      ) : (
        <div className="grid grid-cols-3 gap-6 pt-5 border-t border-hairline">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">Total balance</p>
            <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
              <CountUp target={data.total_balance_cents} format="usd-full" durationMs={1800} />
            </p>
            <p className="text-[11px] text-graphite mt-1">
              {data.latest_balance_at ? `as of ${new Date(data.latest_balance_at).toLocaleString()}` : "no data yet"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">Avg / active tracker</p>
            <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
              <CountUp target={avgPerActive} format="usd-compact" durationMs={1400} />
            </p>
            <p className="text-[11px] text-graphite mt-1">
              avg cents per active card right now
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">Coverage</p>
            <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
              <CountUp target={coveragePct} format="percent" durationMs={1100} />
            </p>
            <div className="h-2 bg-paper rounded-full overflow-hidden mt-2">
              <div className="h-full bg-pine" style={{ width: `${coveragePct}%` }} />
            </div>
            <p className="text-[11px] text-graphite mt-1 tabular-nums">
              {data.active_tracker_count.toLocaleString()} active / {data.total_card_count.toLocaleString()} linked
            </p>
          </div>
        </div>
      )}
    </section>
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
