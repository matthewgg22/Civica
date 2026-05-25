import { CountUp } from "./CountUp";
import type { EbtAggregateData, PartnerPnLData, NotificationOutlayData, TTFDData } from "../../lib/ops-fetchers";

/**
 * Pinned-feeling stats bar that sits above the panel stack.
 *
 * Five hero KPIs across the top: total $ tracked (the big one), active trackers,
 * outbound notifications, revenue, TTFD median. Each animates in with a
 * count-up. Visual anchor for the /ops page — the thing a demo viewer sees
 * first and remembers.
 */
export default function OpsHeroStrip({
  ebt,
  pnl,
  notifications,
  ttfd,
}: {
  ebt: EbtAggregateData;
  pnl: PartnerPnLData;
  notifications: NotificationOutlayData;
  ttfd: TTFDData;
}) {
  return (
    <section className="bg-pine text-white rounded-[6px] overflow-hidden mb-4">
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex items-center justify-center w-2.5 h-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-paper opacity-60 animate-ping"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-paper"></span>
          </span>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/70">
            Live · scraper freshness ≤30 min · operator console
          </p>
        </div>
        <span className="text-[10px] font-mono text-white/50 tabular-nums">
          {ebt.latest_balance_at ? `last refresh ${formatRelative(ebt.latest_balance_at)}` : "no refresh yet"}
        </span>
      </div>

      <div className="px-6 pb-6 grid grid-cols-5 gap-6 divide-x divide-white/10">
        {/* Hero — total balance */}
        <div className="col-span-2 pr-2">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/60 mb-2">
            SNAP balance under app
          </p>
          <p className="text-[56px] font-bold tracking-tight text-white leading-none tabular-nums">
            <CountUp target={ebt.total_balance_cents} format="usd-compact" />
          </p>
          <p className="text-[12px] text-white/65 mt-2">
            Total $ across <span className="font-semibold text-white">{ebt.active_tracker_count.toLocaleString()}</span> active Civica-tracked EBT cards
          </p>
        </div>

        <HeroStat
          label="Active trackers"
          value={ebt.active_tracker_count}
          format="count-compact"
          sublabel={`${ebt.total_card_count.toLocaleString()} total linked`}
        />
        <HeroStat
          label="Outbound sent · 30d"
          value={notifications.total_count}
          format="count-compact"
          sublabel={`$${(notifications.total_cost_cents / 100).toFixed(2)} ops cost`}
        />
        <HeroStat
          label="TTFD median"
          value={Math.round((ttfd.median_days ?? 0) * 10)}
          format="tenths-day"
          sublabel={ttfd.n > 0 ? `n=${ttfd.n.toLocaleString()} journeys` : "no journeys yet"}
        />
      </div>

      {/* Bottom strip — partner P&L summary as accent */}
      <div className="bg-pine-pressed/40 px-6 py-3 flex items-center justify-between text-[11px] text-white/75">
        <div className="flex items-center gap-6">
          <span><span className="font-mono text-white">{pnl.impressions.toLocaleString()}</span> partner impressions</span>
          <span><span className="font-mono text-white">${(pnl.revenue_cents / 100).toFixed(0)}</span> revenue</span>
          <span><span className="font-mono text-white">${(pnl.saved_cents / 100).toFixed(0)}</span> HH savings</span>
        </div>
        <span className="font-mono uppercase tracking-wider text-white/55">
          {pnl.redistribution_pct}% redistribution
        </span>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  format,
  sublabel,
}: {
  label: string;
  value: number;
  format: "usd-compact" | "usd-full" | "count-compact" | "count-full" | "percent" | "tenths-day";
  sublabel: string;
}) {
  return (
    <div className="pl-6 pr-2">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/60 mb-2">
        {label}
      </p>
      <p className="text-[28px] font-bold tracking-tight text-white leading-none tabular-nums">
        <CountUp target={value} format={format} />
      </p>
      <p className="text-[11px] text-white/60 mt-2">{sublabel}</p>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ageMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}
