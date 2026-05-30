import type { EligibilityQueueData } from "../../lib/ops-fetchers";

function formatUSD(cents: number, opts?: { compact?: boolean }): string {
  const dollars = cents / 100;
  if (opts?.compact) {
    if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(dollars >= 10_000_000 ? 1 : 2)}M`;
    if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(dollars >= 10_000 ? 0 : 1)}K`;
  }
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Eligibility queue. Each row = one monetization (or referral) program with
 *   - eligible HH count
 *   - already contacted/referred
 *   - in queue (eligible − contacted)
 *   - projected revenue if X% convert at $Y avg
 *   - right-aligned action chip
 *
 * Sorted by projected revenue descending so the biggest opportunity is first.
 * Non-monetized rows (LIHEAP-style "right thing" referrals) get a subtle pine
 * tag and sort to the bottom (their projected = 0).
 *
 * Headline = total projected revenue across all queued programs.
 */
export default function EligibilityQueuePanel({ data }: { data: EligibilityQueueData }) {
  // Sort descending by projected_revenue_cents so monetized opportunities lead.
  const rows = [...data.rows].sort((a, b) => b.projected_revenue_cents - a.projected_revenue_cents);
  const totalProjected = rows.reduce((sum, r) => sum + r.projected_revenue_cents, 0);
  const totalInQueue = rows.reduce((sum, r) => sum + r.in_queue, 0);
  const monetizedQueueCount = rows.filter((r) => r.monetized).reduce((s, r) => s + r.in_queue, 0);

  return (
    <section className="bg-surface border-2 border-pine/30 rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="eyebrow mb-1">Panel 9 · Opportunity queue</p>
          <h2 className="text-[18px] font-bold tracking-tight text-ink">
            What&apos;s next: eligible but not yet referred
          </h2>
          <p className="text-[12px] text-graphite mt-1">
            <span className="font-semibold text-ink tabular-nums">{totalInQueue.toLocaleString()}</span> HHs in queue across {rows.length} programs · {monetizedQueueCount.toLocaleString()} monetized · sorted by projected revenue
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[36px] font-bold tabular-nums leading-none text-ink">
            {formatUSD(totalProjected, { compact: true })}
          </p>
          <p className="text-[11px] text-graphite mt-1 uppercase tracking-wider font-semibold">
            projected · locked behind outreach
          </p>
        </div>
      </div>

      {!data.available ? (
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="program_eligibility_v + referral_events not present locally."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          message="No queued opportunities."
          detail="Every eligible HH has been contacted for every active program."
        />
      ) : (
        <ul className="divide-y divide-hairline border-y border-hairline">
          {rows.map((row) => (
            <ProgramRow key={row.program_id} row={row} maxProjected={rows[0]?.projected_revenue_cents ?? 0} />
          ))}
        </ul>
      )}

      <p className="text-[11px] text-graphite mt-4 italic">
        Eligibility derived from snap_packets + applicants demographics. Referrals tracked via outreach_events (per program).
        Non-monetized rows (no fee) are referral-only — value accrues to the recipient.
      </p>
    </section>
  );
}

function ProgramRow({
  row,
  maxProjected,
}: {
  row: EligibilityQueueData["rows"][number];
  maxProjected: number;
}) {
  const refPct = row.eligible > 0 ? Math.round((row.contacted / row.eligible) * 100) : 0;
  // Intensity for the in-queue badge: more queue = darker pine background.
  const queueIntensity = row.eligible > 0 ? Math.min(1, row.in_queue / row.eligible) : 0;
  // Bar width for projected revenue — scaled against the panel's biggest row.
  const projWidth = maxProjected > 0 ? Math.max(2, (row.projected_revenue_cents / maxProjected) * 100) : 0;

  return (
    <li className="grid grid-cols-[2fr_3fr_2fr_auto] items-center gap-5 py-4">
      {/* Program name + tag */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-semibold text-ink leading-snug">{row.program_name}</p>
          {!row.monetized && (
            <span className="inline-flex items-center text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] bg-pine/10 text-pine border border-pine/20 whitespace-nowrap">
              no fee · recipient benefit
            </span>
          )}
        </div>
        <p className="text-[11px] text-graphite mt-1 font-mono tabular-nums">
          {row.conv_pct.toFixed(0)}% conv · {row.dollars_per_conversion_cents > 0 ? `${formatUSD(row.dollars_per_conversion_cents)}/conv` : "no fee"}
        </p>
      </div>

      {/* Numbers: eligible / contacted / in queue */}
      <div className="grid grid-cols-3 gap-3">
        <NumberCell label="Eligible" value={row.eligible} muted />
        <NumberCell
          label="Contacted"
          value={row.contacted}
          muted
          subtle={row.eligible > 0 ? `${refPct}%` : undefined}
        />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">In queue</p>
          <div
            className="inline-flex items-baseline gap-1.5 px-2 py-0.5 rounded-[3px]"
            style={{ backgroundColor: `rgba(50, 46, 39, ${0.05 + queueIntensity * 0.12})` }}
          >
            <span className="text-[15px] font-bold tabular-nums text-ink leading-none">
              {row.in_queue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Projected revenue + bar */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">Projected</p>
        {row.monetized ? (
          <>
            <p className="text-[16px] font-bold tabular-nums text-ink leading-none">
              {formatUSD(row.projected_revenue_cents, { compact: true })}
            </p>
            <div className="h-1.5 bg-paper rounded-full overflow-hidden mt-2">
              <div className="h-full bg-pine" style={{ width: `${projWidth}%` }} />
            </div>
          </>
        ) : (
          <>
            <p className="text-[16px] font-bold tabular-nums text-graphite leading-none">—</p>
            <p className="text-[10px] text-graphite mt-1 italic">non-monetized</p>
          </>
        )}
      </div>

      {/* Action chip */}
      <div className="shrink-0">
        <span
          className={`inline-flex items-center text-[11px] font-semibold px-3 py-1.5 rounded-[3px] border whitespace-nowrap ${
            row.monetized
              ? "bg-surface text-ink border-ink/30 hover:border-ink/60"
              : "bg-surface text-graphite border-hairline"
          }`}
        >
          {row.suggested_action}
        </span>
      </div>
    </li>
  );
}

function NumberCell({
  label,
  value,
  subtle,
  muted,
}: {
  label: string;
  value: number;
  subtle?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">{label}</p>
      <p className={`text-[15px] font-bold tabular-nums leading-none ${muted ? "text-graphite" : "text-ink"}`}>
        {value.toLocaleString()}
      </p>
      {subtle && (
        <p className="text-[10px] text-graphite mt-1 font-mono tabular-nums">{subtle}</p>
      )}
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
