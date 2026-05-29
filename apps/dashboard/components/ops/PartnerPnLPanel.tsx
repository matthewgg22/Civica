import type { PartnerPnLData } from "../../lib/ops-fetchers";

function formatUSD(cents: number, opts?: { compact?: boolean }): string {
  const dollars = cents / 100;
  if (opts?.compact && dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}K`;
  }
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function PartnerPnLPanel({ data }: { data: PartnerPnLData }) {
  return (
    <section className="bg-surface border-2 border-pine/30 rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1 text-pine">Panel 6 · Partner monetization · Operator-gated</p>
          <h3 className="text-[18px] font-bold tracking-tight text-ink">Partner-offer P&amp;L</h3>
          <p className="text-[12px] text-graphite mt-1">
            Impressions, revenue, household savings · with redistribution framing
          </p>
        </div>
        <span className="text-[10px] font-mono text-graphite uppercase tracking-wider whitespace-nowrap">
          Past 30 days · impressions-only v1
        </span>
      </div>

      {!data.available ? (
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="partner_offer_events_aggregate (20260581) not present locally."
        />
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-8">
          {/* Left: funnel + value split */}
          <div className="space-y-5">
            <FunnelStrip
              impressions={data.impressions}
              clicks={data.clicks}
              conversions={data.conversions}
            />
            <ValueSplitBar revenueCents={data.revenue_cents} savedCents={data.saved_cents} />

            <div className="grid grid-cols-3 gap-5 pt-3 border-t border-hairline">
              <Metric
                label="Revenue / active tracker"
                value={data.active_trackers > 0 ? formatUSD(data.revenue_per_active_tracker_cents) : "—"}
                sublabel={data.active_trackers > 0 ? `n=${data.active_trackers.toLocaleString()} active` : "no active trackers"}
              />
              <Metric
                label="Impressions"
                value={data.impressions.toLocaleString()}
                sublabel={`${data.clicks > 0 ? ((data.clicks / data.impressions) * 100).toFixed(1) : "—"}% CTR`}
              />
              <Metric
                label="Conversions"
                value={data.conversions.toLocaleString()}
                sublabel={data.clicks > 0 ? `${((data.conversions / data.clicks) * 100).toFixed(1)}% of clicks` : "pending iOS"}
              />
            </div>
          </div>

          {/* Right: redistribution donut */}
          <div className="w-56 flex flex-col items-center justify-center">
            <RedistributionDonut pct={data.redistribution_pct} />
            <p className="text-[11px] text-graphite text-center mt-3 leading-relaxed">
              of total value returned to households via offers
            </p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-graphite mt-4 italic">
        Click + conversion data pending iOS instrumentation. v1 shows impression-derived estimates only.
        Events are county-bucketed (no user_id) by design — see D13.
      </p>
    </section>
  );
}

function FunnelStrip({ impressions, clicks, conversions }: { impressions: number; clicks: number; conversions: number }) {
  const max = Math.max(1, impressions);
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">Engagement funnel</p>
      <div className="space-y-2">
        {[
          { label: "Impressions", value: impressions, color: "bg-pine/85" },
          { label: "Clicks",      value: clicks,      color: "bg-pine/55" },
          { label: "Conversions", value: conversions, color: "bg-pine/30" },
        ].map((stage) => (
          <div key={stage.label} className="flex items-center gap-3">
            <span className="w-24 text-[12px] font-semibold text-ink shrink-0">{stage.label}</span>
            <div className="flex-1 h-6 bg-paper rounded-[3px] overflow-hidden relative">
              <div
                className={`h-full ${stage.color} flex items-center justify-end pr-2`}
                style={{ width: `${Math.max(8, (stage.value / max) * 100)}%` }}
              >
                <span className="text-[11px] font-mono font-bold text-white tabular-nums">
                  {stage.value.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueSplitBar({ revenueCents, savedCents }: { revenueCents: number; savedCents: number }) {
  const total = Math.max(1, revenueCents + savedCents);
  const revPct = (revenueCents / total) * 100;
  const savedPct = (savedCents / total) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite">
          Value created · 30d
        </p>
        <p className="text-[11px] font-mono text-graphite tabular-nums">
          total {formatUSD(revenueCents + savedCents, { compact: true })}
        </p>
      </div>
      <div className="h-8 rounded-[3px] overflow-hidden flex bg-paper">
        <div
          className="bg-pine flex items-center justify-end pr-3"
          style={{ width: `${revPct}%` }}
        >
          <span className="text-[11px] font-mono font-bold text-white tabular-nums">
            {formatUSD(revenueCents, { compact: true })}
          </span>
        </div>
        <div
          className="bg-amber/60 flex items-center justify-end pr-3"
          style={{ width: `${savedPct}%` }}
        >
          <span className="text-[11px] font-mono font-bold text-ink tabular-nums">
            {formatUSD(savedCents, { compact: true })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-graphite">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block w-2 h-2 rounded-sm bg-pine" /> Civica revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block w-2 h-2 rounded-sm bg-amber/60" /> HH savings (redistribution)
        </span>
      </div>
    </div>
  );
}

function RedistributionDonut({ pct }: { pct: number }) {
  const size = 156;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = c * (clamped / 100);
  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="#EEEAE0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="#1F5340"
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${c}`}
          strokeDashoffset={c / 4}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[36px] font-bold tabular-nums text-pine leading-none">
          {clamped.toFixed(0)}%
        </p>
        <p className="text-[10px] uppercase tracking-wider text-graphite mt-1 font-semibold">
          Redistribution
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">{label}</p>
      <p className="text-[20px] font-bold tabular-nums leading-none text-ink">{value}</p>
      <p className="text-[11px] text-graphite mt-1">{sublabel}</p>
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
