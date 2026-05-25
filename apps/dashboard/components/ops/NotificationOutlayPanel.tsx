import type { NotificationOutlayData } from "../../lib/ops-fetchers";

function formatUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

const CHANNELS = ["push", "sms", "email"] as const;

/**
 * Channel × category notification outlay as a 2D heatmap. Each cell:
 *   - background saturation = count (pine intensity)
 *   - foreground digit = count
 *   - cost subscript below
 * Rightmost column sums each row; bottom row sums each channel column.
 */
export default function NotificationOutlayPanel({ data }: { data: NotificationOutlayData }) {
  const lookup = new Map<string, { count: number; cost_cents: number }>();
  for (const c of data.cells) {
    lookup.set(`${c.channel}::${c.category}`, { count: c.count, cost_cents: c.cost_cents });
  }
  const categories = [...new Set(data.cells.map((c) => c.category))].sort();
  const max = data.cells.reduce((m, c) => Math.max(m, c.count), 1);

  // Column totals
  const channelTotals = new Map<string, { count: number; cost_cents: number }>();
  // Row totals
  const categoryTotals = new Map<string, { count: number; cost_cents: number }>();
  for (const c of data.cells) {
    const ch = channelTotals.get(c.channel) ?? { count: 0, cost_cents: 0 };
    ch.count += c.count; ch.cost_cents += c.cost_cents;
    channelTotals.set(c.channel, ch);
    const cat = categoryTotals.get(c.category) ?? { count: 0, cost_cents: 0 };
    cat.count += c.count; cat.cost_cents += c.cost_cents;
    categoryTotals.set(c.category, cat);
  }

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1">Panel 3 · Outbound</p>
          <h3 className="text-[18px] font-bold tracking-tight text-ink">Notification outlay heatmap</h3>
          <p className="text-[12px] text-graphite mt-1">
            <span className="font-semibold text-ink tabular-nums">{data.total_count.toLocaleString()}</span> sent · <span className="font-semibold text-ink tabular-nums">{formatUSD(data.total_cost_cents)}</span> total cost · past 30 days
          </p>
        </div>
        <Legend max={max} />
      </div>

      {!data.available ? (
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="notification_outlay_events (20260581) not present locally."
        />
      ) : data.cells.length === 0 ? (
        <EmptyState
          message="No notifications sent in the last 30 days."
          detail="Outlay events land here as the dispatcher writes them with NOTIFICATION_COST_CENTS."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: "4px" }}>
            <thead>
              <tr>
                <th className="w-44 text-left text-[10px] font-semibold uppercase tracking-wider text-muted pb-1">Category</th>
                {CHANNELS.map((ch) => (
                  <th key={ch} className="text-[10px] font-semibold uppercase tracking-wider text-muted pb-1 text-center">{ch}</th>
                ))}
                <th className="w-24 text-[10px] font-semibold uppercase tracking-wider text-muted pb-1 text-right pr-1">Row total</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const rowTotal = categoryTotals.get(cat)!;
                return (
                  <tr key={cat}>
                    <td className="py-1 pr-3 text-[12px] font-semibold text-ink capitalize">{cat.replace(/_/g, " ")}</td>
                    {CHANNELS.map((ch) => {
                      const cell = lookup.get(`${ch}::${cat}`);
                      return (
                        <td key={ch} className="p-0">
                          <HeatCell count={cell?.count ?? 0} costCents={cell?.cost_cents ?? 0} max={max} />
                        </td>
                      );
                    })}
                    <td className="py-1 pl-2 text-right">
                      <p className="text-[12px] font-mono tabular-nums text-ink">{rowTotal.count.toLocaleString()}</p>
                      <p className="text-[10px] font-mono tabular-nums text-graphite">{formatUSD(rowTotal.cost_cents)}</p>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Column total</td>
                {CHANNELS.map((ch) => {
                  const tot = channelTotals.get(ch);
                  return (
                    <td key={ch} className="pt-2 text-center">
                      <p className="text-[12px] font-mono tabular-nums text-ink">{(tot?.count ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] font-mono tabular-nums text-graphite">{formatUSD(tot?.cost_cents ?? 0)}</p>
                    </td>
                  );
                })}
                <td className="pt-2 pl-2 text-right">
                  <p className="text-[13px] font-bold tabular-nums text-ink">{data.total_count.toLocaleString()}</p>
                  <p className="text-[10px] font-mono tabular-nums text-graphite">{formatUSD(data.total_cost_cents)}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HeatCell({ count, costCents, max }: { count: number; costCents: number; max: number }) {
  if (count === 0) {
    return (
      <div className="rounded-[4px] bg-paper border border-hairline h-14 flex items-center justify-center">
        <span className="text-muted text-[12px] font-mono">—</span>
      </div>
    );
  }
  // Saturation 0.2..1.0 mapped to count/max
  const t = Math.min(1, count / max);
  const alpha = 0.18 + t * 0.82;
  const textWhite = t > 0.55;
  return (
    <div
      className="rounded-[4px] h-14 flex flex-col items-center justify-center px-2"
      style={{ backgroundColor: `rgba(15, 76, 58, ${alpha})` }}
    >
      <span className={`text-[15px] font-bold tabular-nums leading-none ${textWhite ? "text-white" : "text-ink"}`}>
        {count.toLocaleString()}
      </span>
      <span className={`text-[10px] font-mono tabular-nums mt-1 ${textWhite ? "text-white/75" : "text-graphite"}`}>
        {costCents > 0 ? formatUSD(costCents) : "free"}
      </span>
    </div>
  );
}

function Legend({ max }: { max: number }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-[10px] font-mono text-muted">0</span>
      <div className="flex">
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((a) => (
          <span
            key={a}
            className="block w-5 h-3"
            style={{ backgroundColor: `rgba(15, 76, 58, ${a})` }}
          />
        ))}
      </div>
      <span className="text-[10px] font-mono text-muted tabular-nums">{max.toLocaleString()}</span>
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
