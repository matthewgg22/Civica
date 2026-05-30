import type { Stage3Totals } from "../lib/demo-data";

export type Stage3Callouts = {
  topRMNEarner: { name: string; amount: number } | null;
  topWorkforceEarner: { name: string; amount: number } | null;
  dsnpTransferredNames: string[];
  dsnpEligibleNames: string[];      // cohort-eligible, not yet transferred
  abawdBehindPaceNames: string[];   // ABAWD scope, < 60 hrs logged this month
};

type Props = {
  totals: Stage3Totals;
  callouts: Stage3Callouts;
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

// Format a list of names with sensible truncation — names are person-identifiable
// and want to read like a quick scan, not a wall of text. "A, B, +3 more" style.
function fmtNameList(names: string[], cap = 3): string {
  if (names.length === 0) return "";
  if (names.length <= cap) return names.join(", ");
  return `${names.slice(0, cap).join(", ")}, +${names.length - cap} more`;
}

export default function Stage3YieldBand({ totals, callouts, enrolledHouseholdCount }: Props) {
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

  // Recurring streams only — D-SNP is one-time-per-lifetime and rendered below.
  const recurringSegments = [
    {
      key: "ads",
      label: "Ad attribution",
      value: adSavings,
      color: "var(--color-amber)",
      topEarner: callouts.topRMNEarner,
    },
    {
      key: "workforce",
      label: "Workforce referrals",
      value: workforceReferrals,
      color: "var(--color-pine)",
      topEarner: callouts.topWorkforceEarner,
    },
  ];
  const maxSegment = Math.max(...recurringSegments.map((s) => s.value), 1);

  const dsnpUntransferred = callouts.dsnpEligibleNames;

  return (
    <section className="bg-surface border border-hairline rounded-[4px] px-6 py-5">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow">Stage 3 yield · this month</p>
          <p className="text-[12px] text-graphite mt-1 leading-snug">
            Where the post-issuance moat shows up in this cohort: which households are redeeming Civica RMN offers, which logged ABAWD hours into the Marketplace, and which entered the D-SNP broker funnel.
          </p>
        </div>
        <span className="text-[11px] text-graphite tabular-nums shrink-0">
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
          <p className="text-[11px] text-graphite mt-1 tabular-nums">
            {fmtUSD(recurringYield, 2)} recurring · {fmtUSD(totalYieldIncludingOneTime, 2)} with D-SNP
          </p>
        </div>

        {/* Two recurring stream rows — each anchored to a named top earner so
            the band reads as cohort truth, not abstract finance. */}
        <div className="space-y-3">
          {recurringSegments.map((s) => {
            const pct = (s.value / maxSegment) * 100;
            return (
              <div key={s.key} className="grid grid-cols-[140px_1fr_82px] gap-3 items-center">
                <span className="text-[12px] font-semibold text-ink">{s.label}</span>
                <div>
                  <div className="relative rounded-full overflow-hidden" style={{ height: 10, background: "rgba(0,0,0,0.06)" }}>
                    <div
                      className="absolute inset-y-0 left-0 transition-[width] duration-300"
                      style={{ width: `${pct}%`, background: s.color }}
                    />
                  </div>
                  {s.topEarner && (
                    <p className="text-[11px] text-graphite mt-1 leading-snug">
                      Top: <span className="font-semibold text-ink">{s.topEarner.name}</span>{" "}
                      <span className="tabular-nums">({fmtUSD(s.topEarner.amount, 2)})</span>
                    </p>
                  )}
                </div>
                <span className="text-[13px] font-bold tabular-nums text-ink text-right">{fmtUSD(s.value, 2)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* D-SNP — named events, not abstract count.
          One-time-per-lifetime (premise P5); separated from the recurring composite. */}
      <div className="mt-4 pt-3 border-t border-hairline/60 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[11px] font-bold tabular-nums bg-indigo/10 text-indigo">
              D-SNP
            </span>
            <span className="text-[12px] text-ink">
              <span className="font-bold tabular-nums">{dsnpTransferCount}</span> warm transfer{dsnpTransferCount === 1 ? "" : "s"} this month
              {dsnpTransferCount > 0 && (
                <span className="text-graphite"> × $250/lead = <span className="tabular-nums font-bold text-ink">{fmtUSD(dsnpTransfers, 0)}</span></span>
              )}
            </span>
          </div>
          {callouts.dsnpTransferredNames.length > 0 && (
            <p className="text-[11px] text-graphite leading-snug pl-12">
              Transferred this month: <span className="font-semibold text-ink">{fmtNameList(callouts.dsnpTransferredNames, 4)}</span>
            </p>
          )}
          {dsnpUntransferred.length > 0 && (
            <p className="text-[11px] text-graphite leading-snug pl-12">
              Cohort-eligible, not yet fired: <span className="font-medium text-graphite">{fmtNameList(dsnpUntransferred, 4)}</span>
              <span className="ml-1 italic">— iOS prompt pending</span>
            </p>
          )}
        </div>
        <span className="text-[10px] text-graphite uppercase tracking-wider font-semibold shrink-0">one-time per household</span>
      </div>

      {/* ABAWD compliance callout — ties Stage 3 workforce stream back to the
          OBBBA §10102 mandate. Households below 60/80 hrs are at risk of losing
          benefits AND of skipping the Marketplace referral payout the band relies on. */}
      {callouts.abawdBehindPaceNames.length > 0 && (
        <div className="mt-3 pt-3 border-t border-hairline/60 flex items-baseline gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[11px] font-bold bg-warning/15 text-warning">
            ABAWD pace
          </span>
          <span className="text-[12px] text-ink">
            <span className="font-bold tabular-nums">{callouts.abawdBehindPaceNames.length}</span> household{callouts.abawdBehindPaceNames.length === 1 ? "" : "s"} behind the 80-hr/mo pace:{" "}
            <span className="font-semibold">{fmtNameList(callouts.abawdBehindPaceNames, 4)}</span>
            <span className="text-graphite"> · push outreach before the §10102 clock closes</span>
          </span>
        </div>
      )}

      {/* WOTC static comparison line — premise P7. */}
      <div className="mt-3 pt-3 border-t border-hairline/60 flex items-baseline gap-2 flex-wrap">
        <span className="text-[11px] text-graphite font-semibold uppercase tracking-wider">If H.R. 1177 reauthorizes WOTC:</span>
        <span className="text-[12px] text-ink">
          workforce row jumps from <span className="font-bold tabular-nums">$5–50/placement</span> to <span className="font-bold tabular-nums text-amber">$200–500/hire</span>
          {workforceReferrals > 0 && (
            <span className="text-graphite"> · est. +{fmtUSD(workforceReferrals * 9, 0)} this month at current pace</span>
          )}
        </span>
      </div>
    </section>
  );
}
