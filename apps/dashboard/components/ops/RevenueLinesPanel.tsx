import type { RevenueLinesData, RevenueLine } from "../../lib/ops-fetchers";

function formatUSD(cents: number, opts?: { compact?: boolean; precise?: boolean }): string {
  const dollars = cents / 100;
  const abs = Math.abs(dollars);
  if (opts?.compact && abs >= 1000) {
    const sign = dollars < 0 ? "-" : "";
    return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 1 : 1)}K`;
  }
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts?.precise ? 2 : 0,
    minimumFractionDigits: opts?.precise ? 2 : 0,
  });
}

const STATUS_PILL: Record<RevenueLine["status"], { label: string; classes: string }> = {
  live:     { label: "Live",        classes: "bg-pine/15 text-pine border border-pine/30" },
  gated:    { label: "Gated",       classes: "bg-amber/20 text-ink border border-amber/50" },
  planned:  { label: "Planned",     classes: "bg-paper text-graphite border border-hairline" },
  no_fee:   { label: "No fee",      classes: "bg-paper text-graphite border border-hairline" },
  cost:     { label: "Live · cost", classes: "bg-warning/15 text-warning border border-warning/30" },
};

/**
 * Unified revenue rollup. Answers "how is Civica making money this month?" by
 * stacking every revenue line plus showing notification outlay as a negative.
 *
 * Left half: horizontal stacked bar of monetization sources (pine = revenue,
 * amber/60 = HH-savings redistribution, burnt-orange = outlay, drawn below
 * the bar as a negative).
 * Right half: net monetization callout with WoW delta.
 * Below: per-line table with status pills.
 */
export default function RevenueLinesPanel({ data }: { data: RevenueLinesData }) {
  if (!data.available) {
    return (
      <section className="bg-surface border-2 border-pine/30 rounded-[4px] p-6">
        <Header />
        <div className="pt-5 border-t border-hairline">
          <p className="text-[14px] font-semibold text-ink">Revenue rollup unavailable.</p>
          <p className="text-[12px] text-graphite mt-1 font-mono">
            Aggregator views (20260581+) not present locally.
          </p>
        </div>
      </section>
    );
  }

  const revenueLines = data.lines.filter((l) => l.status !== "cost" && l.gross_cents > 0);
  const costLines = data.lines.filter((l) => l.status === "cost");
  const totalRevenueCents = revenueLines.reduce((s, l) => s + l.gross_cents, 0);
  const totalCostCents = costLines.reduce((s, l) => s + l.gross_cents, 0);

  return (
    <section className="bg-surface border-2 border-pine/30 rounded-[4px] p-6">
      <Header />

      <div className="grid grid-cols-[1fr_auto] gap-8 items-start">
        {/* Left: stacked revenue bar + outlay underline */}
        <div className="space-y-5">
          <RevenueStackBar
            lines={revenueLines}
            totalRevenueCents={totalRevenueCents}
            costCents={totalCostCents}
          />

          <Legend lines={revenueLines} hasCost={costLines.length > 0} />
        </div>

        {/* Right: net callout */}
        <NetCallout
          netCents={data.net_cents}
          wowDeltaPct={data.wow_delta_pct}
          revenueCents={totalRevenueCents}
          costCents={totalCostCents}
        />
      </div>

      {/* Per-line table */}
      <div className="mt-6 pt-5 border-t border-hairline">
        <table className="w-full">
          <thead>
            <tr className="border-b border-hairline">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-graphite pb-2 pr-4">Line</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-graphite pb-2 pr-4 w-44">Status</th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-graphite pb-2 pr-4 w-28">30d $</th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-graphite pb-2 w-24">% of revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <LineRow key={line.key} line={line} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-graphite mt-4 italic">
        Net = monetized revenue minus notification outlay. Partner-offer revenue is impressions-only v1.
        WOTC unlocks if H.R. 1177 extension passes; tax-prep + LIHEAP routing kept here for completeness.
      </p>
    </section>
  );
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <p className="eyebrow mb-1 text-pine">Panel 10 · Revenue rollup</p>
        <h2 className="text-[18px] font-bold tracking-tight text-ink">Where the money comes from</h2>
        <p className="text-[12px] text-graphite mt-1">
          Every monetization line, stacked · past 30 days
        </p>
      </div>
      <span className="text-[10px] font-mono text-graphite uppercase tracking-wider whitespace-nowrap">
        Operator-gated · v1
      </span>
    </div>
  );
}

function RevenueStackBar({
  lines,
  totalRevenueCents,
  costCents,
}: {
  lines: RevenueLine[];
  totalRevenueCents: number;
  costCents: number;
}) {
  const total = Math.max(1, totalRevenueCents);
  // Cost bar width is proportional to revenue scale (capped at 100% of bar)
  const costWidthPct = Math.min(100, (costCents / total) * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">
          Revenue stack · 30d
        </p>
        <p className="text-[11px] font-mono text-graphite tabular-nums">
          total {formatUSD(totalRevenueCents, { compact: true })}
        </p>
      </div>

      {/* Revenue stack */}
      <div className="h-9 rounded-[3px] overflow-hidden flex bg-paper">
        {lines.map((line, idx) => {
          const pct = (line.gross_cents / total) * 100;
          // Pine saturation tapers across lines: first is full pine, then pine/70, pine/45
          const tones = ["bg-pine", "bg-pine/70", "bg-pine/45", "bg-pine/30"];
          const tone = tones[Math.min(idx, tones.length - 1)];
          const showLabel = pct >= 18;
          return (
            <div
              key={line.key}
              className={`${tone} flex items-center justify-end pr-3`}
              style={{ width: `${pct}%` }}
              title={`${line.label} — ${formatUSD(line.gross_cents)}`}
            >
              {showLabel && (
                <span className="text-[11px] font-mono font-bold text-white tabular-nums whitespace-nowrap">
                  {formatUSD(line.gross_cents, { compact: true })}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Cost bar (drawn below, smaller, burnt-orange) */}
      {costCents > 0 && (
        <div className="mt-1.5">
          <div className="h-3 rounded-[3px] overflow-hidden bg-paper relative">
            <div
              className="h-full bg-warning/40 flex items-center justify-end pr-2"
              style={{ width: `${Math.max(2, costWidthPct)}%` }}
              title={`Notification outlay — ${formatUSD(costCents, { precise: true })}`}
            />
          </div>
          <p className="text-[10px] text-warning mt-1 font-mono tabular-nums">
            − {formatUSD(costCents, { precise: true })} notification outlay
          </p>
        </div>
      )}
    </div>
  );
}

function Legend({ lines, hasCost }: { lines: RevenueLine[]; hasCost: boolean }) {
  const tones = ["bg-pine", "bg-pine/70", "bg-pine/45", "bg-pine/30"];
  return (
    <div className="flex items-center gap-4 flex-wrap text-[11px] text-graphite">
      {lines.map((line, idx) => (
        <span key={line.key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`block w-2 h-2 rounded-sm ${tones[Math.min(idx, tones.length - 1)]}`} />
          {line.label}
        </span>
      ))}
      {hasCost && (
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block w-2 h-2 rounded-sm bg-warning/40" />
          Outlay (cost)
        </span>
      )}
    </div>
  );
}

function NetCallout({
  netCents,
  wowDeltaPct,
  revenueCents,
  costCents,
}: {
  netCents: number;
  wowDeltaPct: number;
  revenueCents: number;
  costCents: number;
}) {
  const positive = wowDeltaPct >= 0;
  return (
    <div className="w-56 border-l border-hairline pl-6">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">
        Net monetization
      </p>
      <p className="text-[36px] font-bold tabular-nums leading-none text-pine">
        {formatUSD(netCents, { compact: true })}
      </p>
      <p className="text-[11px] text-graphite mt-1.5">
        net / 30d · revenue minus outlay
      </p>

      <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] bg-pine/10">
        <span aria-hidden="true" className="text-pine text-[12px] leading-none">
          {positive ? "▲" : "▼"}
        </span>
        <span className="text-[11px] font-mono font-bold text-pine tabular-nums">
          {positive ? "+" : ""}{wowDeltaPct.toFixed(1)}% WoW
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-hairline space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] uppercase tracking-wider text-graphite font-semibold">Revenue</span>
          <span className="text-[12px] font-mono tabular-nums text-ink">{formatUSD(revenueCents, { compact: true })}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] uppercase tracking-wider text-graphite font-semibold">Outlay</span>
          <span className="text-[12px] font-mono tabular-nums text-warning">− {formatUSD(costCents, { precise: true })}</span>
        </div>
      </div>
    </div>
  );
}

function LineRow({ line }: { line: RevenueLine }) {
  const pill = STATUS_PILL[line.status];
  const isCost = line.status === "cost";
  const valueLabel =
    line.gross_cents === 0 && line.status !== "cost"
      ? "—"
      : isCost
      ? `− ${formatUSD(line.gross_cents, { precise: true })}`
      : formatUSD(line.gross_cents);
  const shareLabel = line.share_pct === null ? "—" : `${line.share_pct.toFixed(1)}%`;

  return (
    <tr className="border-b border-hairline/60 last:border-0">
      <td className="py-2.5 pr-4">
        <p className="text-[13px] font-semibold text-ink">{line.label}</p>
        {line.note && <p className="text-[11px] text-graphite mt-0.5">{line.note}</p>}
      </td>
      <td className="py-2.5 pr-4">
        <span className={`inline-block px-2 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wider ${pill.classes}`}>
          {pill.label}
        </span>
      </td>
      <td className={`py-2.5 pr-4 text-right text-[13px] font-mono tabular-nums ${isCost ? "text-warning" : "text-ink"}`}>
        {valueLabel}
      </td>
      <td className="py-2.5 text-right text-[12px] font-mono tabular-nums text-graphite">
        {shareLabel}
      </td>
    </tr>
  );
}
