import { CountUp } from "./CountUp";
import type { EbtAggregateData, PartnerPnLData, NotificationOutlayData, TTFDData } from "../../lib/ops-fetchers";
import { DEMO_MARKETSHARE_LABEL } from "../../lib/demo-profile";
import { isDemoOpsFallbackEnabled } from "../../lib/demo-ops-data";

/**
 * Pinned-feeling stats bar that sits above the panel stack.
 *
 * Five hero KPIs across the top: total $ tracked (the big one), active trackers,
 * outbound notifications, revenue, TTFD median. Each animates in with a
 * count-up. Visual anchor for the /ops page — the thing a demo viewer sees
 * first and remembers.
 *
 * Color treatment: light warm-gray surface with dark ink text. Pine stays
 * only as the LIVE pulse so the brand color still touches the strip.
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
    <section
      className="text-ink rounded-[6px] overflow-hidden mb-4 border border-hairline"
      style={{ backgroundColor: "#E7E5E2" }}
    >
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* LIVE pulse stays pine — the brand color touchpoint on the strip. */}
          <span className="relative flex items-center justify-center w-2.5 h-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-pine opacity-70 animate-ping"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pine"></span>
          </span>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-graphite">
            Live · scraper freshness ≤30 min · operator console
          </p>
        </div>
        <span className="text-[10px] font-mono text-muted tabular-nums">
          {ebt.latest_balance_at ? `last refresh ${formatRelative(ebt.latest_balance_at)}` : "no refresh yet"}
        </span>
      </div>

      <div
        className="px-6 pb-6 grid grid-cols-5 gap-6"
        style={{ ["--tw-divide-opacity" as string]: 1 }}
      >
        {/* Hero — total balance */}
        <div className="col-span-2 pr-2 border-r border-hairline">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted mb-2">
            SNAP balance under app
          </p>
          <p className="text-[56px] font-bold tracking-tight text-ink leading-none tabular-nums">
            <CountUp target={ebt.total_balance_cents} format="usd-compact" />
          </p>
          <p className="text-[12px] text-graphite mt-2">
            Total $ across <span className="font-semibold text-ink">{ebt.active_tracker_count.toLocaleString()}</span> active Civica-tracked EBT cards
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

      {/* Bottom strip — partner P&L summary as accent. Slightly darker tint
          than the main slab to create subtle separation without a hard line. */}
      <div
        className="px-6 py-3 flex items-center justify-between text-[11px] text-graphite border-t border-hairline"
        style={{ backgroundColor: "#DCD9D2" }}
      >
        <div className="flex items-center gap-6">
          <span><span className="font-mono text-ink font-semibold">{pnl.impressions.toLocaleString()}</span> partner impressions</span>
          <span><span className="font-mono text-ink font-semibold">${(pnl.revenue_cents / 100).toFixed(0)}</span> revenue</span>
          <span><span className="font-mono text-ink font-semibold">${(pnl.saved_cents / 100).toFixed(0)}</span> HH savings</span>
        </div>
        <span className="font-mono uppercase tracking-wider text-muted">
          {pnl.redistribution_pct}% redistribution
        </span>
      </div>

      {/* Projection-framing footer — when demo fallback is on, surface the
          "5% CA CalFresh marketshare" assumption so demo viewers see the
          numbers as projected steady-state, not current run rate. */}
      {isDemoOpsFallbackEnabled() && (
        <div
          className="px-6 py-2 border-t border-hairline text-[10px] uppercase tracking-[0.16em] font-mono text-muted"
          style={{ backgroundColor: "#DCD9D2" }}
        >
          {DEMO_MARKETSHARE_LABEL}
        </div>
      )}
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
    <div className="pl-6 pr-2 border-r border-hairline last:border-r-0">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted mb-2">
        {label}
      </p>
      <p className="text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
        <CountUp target={value} format={format} />
      </p>
      <p className="text-[11px] text-graphite mt-2">{sublabel}</p>
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
