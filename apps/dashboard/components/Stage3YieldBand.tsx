import type { Stage3Totals } from "../lib/demo-data";

type Props = {
  totals: Stage3Totals;
  enrolledHouseholdCount: number;
};

function fmtUSD(n: number, fractionDigits = 0): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export default function Stage3YieldBand({ totals, enrolledHouseholdCount }: Props) {
  const {
    adSavings,
    workforceReferrals,
    dsnpTransfers,
    dsnpTransferCount,
    dsnpEligibleCount,
    monetizedHouseholdCount,
    recurringYield,
    totalYieldIncludingOneTime,
    recurringYieldPerMonetizedHousehold,
  } = totals;

  const monetizedPctOfEnrolled = enrolledHouseholdCount > 0
    ? Math.round((monetizedHouseholdCount / enrolledHouseholdCount) * 100)
    : 0;

  // Recurring streams only — D-SNP is a one-time-per-lifetime lead payout
  // (premise P5) and rendered separately below as an event tally, not a bar.
  const recurringSegments = [
    { key: "ads",       label: "Ad attribution",      value: adSavings,          color: "var(--color-amber)" },
    { key: "workforce", label: "Workforce referrals", value: workforceReferrals, color: "var(--color-pine)" },
  ];
  const maxSegment = Math.max(...recurringSegments.map((s) => s.value), 1);

  return (
    <section className="bg-surface border border-hairline rounded-[4px] px-6 py-5">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow">Stage 3 yield · this month</p>
          <p className="text-[12px] text-graphite mt-1 leading-snug">
            Post-issuance monetization across enrolled households — recurring streams (ads + workforce) plus one-time D-SNP warm transfers.
          </p>
        </div>
        <span className="text-[11px] text-muted tabular-nums shrink-0">
          {monetizedHouseholdCount} of {enrolledHouseholdCount} monetized ({monetizedPctOfEnrolled}%)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-end">
        {/* Hero: recurring $/monetized-household/month */}
        <div className="shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[40px] font-bold tabular-nums leading-none text-ink">
              {fmtUSD(recurringYieldPerMonetizedHousehold, 2)}
            </span>
          </div>
          <p className="text-[12px] text-graphite mt-2 leading-snug max-w-[210px]">
            recurring yield per <span className="font-semibold text-ink">monetized</span> household / month
          </p>
          <p className="text-[11px] text-muted mt-1 tabular-nums">
            {fmtUSD(recurringYield, 2)} recurring · {fmtUSD(totalYieldIncludingOneTime, 2)} with D-SNP
          </p>
        </div>

        {/* Two recurring stream rows */}
        <div className="space-y-2">
          {recurringSegments.map((s) => {
            const pct = (s.value / maxSegment) * 100;
            return (
              <div key={s.key} className="grid grid-cols-[140px_1fr_70px] gap-3 items-center">
                <span className="text-[12px] font-semibold text-ink">{s.label}</span>
                <div className="relative rounded-full overflow-hidden" style={{ height: 10, background: "rgba(0,0,0,0.06)" }}>
                  <div
                    className="absolute inset-y-0 left-0 transition-[width] duration-300"
                    style={{ width: `${pct}%`, background: s.color }}
                  />
                </div>
                <span className="text-[13px] font-bold tabular-nums text-ink text-right">{fmtUSD(s.value, 2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* D-SNP — separate row, framed as one-time-per-lifetime events.
          Per premise P5, D-SNP is not a monthly recurring stream; it's a
          triggered ambush that fires once per household when the Medicare
          enrollment window opens. Showing it inline with recurring streams
          would inflate the hero composite ($250 lead × N transfers averages
          across all monetized households as if recurring — wrong shape). */}
      <div className="mt-4 pt-3 border-t border-hairline/60 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[11px] font-bold tabular-nums bg-indigo/10 text-indigo">
            D-SNP
          </span>
          <span className="text-[12px] text-ink">
            <span className="font-bold tabular-nums">{dsnpTransferCount}</span> warm transfer{dsnpTransferCount === 1 ? "" : "s"} this month
            {dsnpTransferCount > 0 && <span className="text-graphite"> × $250/lead = <span className="tabular-nums font-bold text-ink">{fmtUSD(dsnpTransfers, 0)}</span></span>}
            {dsnpEligibleCount > dsnpTransferCount && (
              <span className="text-muted"> · {dsnpEligibleCount - dsnpTransferCount} cohort-eligible, not yet fired</span>
            )}
          </span>
        </div>
        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">one-time per household</span>
      </div>

      {/* WOTC static comparison line — premise P7. */}
      <div className="mt-3 pt-3 border-t border-hairline/60 flex items-baseline gap-2 flex-wrap">
        <span className="text-[11px] text-graphite font-semibold uppercase tracking-wider">If H.R. 1177 reauthorizes WOTC:</span>
        <span className="text-[12px] text-ink">
          workforce row jumps from <span className="font-bold tabular-nums">$5–50/placement</span> to <span className="font-bold tabular-nums text-pine">$200–500/hire</span>
          {workforceReferrals > 0 && (
            <span className="text-graphite"> · est. +{fmtUSD(workforceReferrals * 9, 0)} this month at current pace</span>
          )}
        </span>
      </div>
    </section>
  );
}
