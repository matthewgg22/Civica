import type { MedicareAdvantageData } from "../../lib/ops-fetchers";

function formatUSD(cents: number, opts?: { compact?: boolean }): string {
  const dollars = cents / 100;
  if (opts?.compact && dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}K`;
  }
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Panel 8 · Medicare Advantage referrals.
 *
 * Surfaces MA partner referral funnel + revenue for tracked SNAP recipients
 * aged 60+. Two political-defense surfaces sit above the funnel:
 *   1. CMS marketing-rule compliance indicator (Title 42 §422.2274)
 *   2. Medi-Cal-first prioritization callout — HHs dual-eligible for Medi-Cal
 *      are routed there first (zero fee to Civica) before MA referral.
 */
export default function MedicareAdvantagePanel({ data }: { data: MedicareAdvantageData }) {
  return (
    <section className="bg-surface border-2 border-pine/30 rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1 text-pine">Panel 8 · Senior monetization · Operator-gated</p>
          <h2 className="text-[18px] font-bold tracking-tight text-ink">Medicare Advantage referrals</h2>
          <p className="text-[12px] text-graphite mt-1">
            Tracked SNAP recipients aged 60+ · Medi-Cal-first routing · MA partner fee revenue
          </p>
        </div>
        <ComplianceBadge
          compliant={data.cms_compliant}
          lastAuditAt={data.last_cms_audit_at}
          disclosureVersion={data.disclosure_version}
        />
      </div>

      {!data.available ? (
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="medicare_advantage_referrals (pending migration) not present locally."
        />
      ) : (
        <div className="space-y-5">
          {/* Top row: cohort sizing + Medi-Cal callout */}
          <div className="grid grid-cols-[1fr_1.2fr] gap-5">
            <CohortBlock
              eligibleSeniors={data.eligible_seniors}
              activeTrackers={data.active_trackers}
            />
            <MediCalFirstCallout
              mediCalRoutedCount={data.medi_cal_routed_count}
              eligibleSeniors={data.eligible_seniors}
            />
          </div>

          {/* Funnel */}
          <ReferralFunnel
            eligibleNonMediCal={data.eligible_non_medi_cal}
            referred={data.referred_to_partners}
            enrolled={data.enrolled}
          />

          {/* Revenue stats grid */}
          <div className="grid grid-cols-3 gap-5 pt-3 border-t border-hairline">
            <Metric
              label="Total fee revenue"
              value={formatUSD(data.revenue_cents)}
              sublabel="past 30 days · MA partners"
            />
            <Metric
              label="Avg $ / enrollment"
              value={data.enrolled > 0 ? formatUSD(data.avg_fee_per_enrollment_cents) : "—"}
              sublabel={data.enrolled > 0 ? `n=${data.enrolled} enrollments` : "no enrollments"}
            />
            <Metric
              label="Conversion"
              value={data.referred_to_partners > 0
                ? `${((data.enrolled / data.referred_to_partners) * 100).toFixed(1)}%`
                : "—"}
              sublabel="referred → enrolled"
            />
          </div>
        </div>
      )}

      <p className="text-[11px] text-graphite mt-4 italic">
        Medi-Cal-eligible households are routed to Medi-Cal first with zero referral fee to Civica —
        political defense surface, not a revenue funnel. MA referrals occur only for HHs not eligible
        for Medi-Cal coverage.
        <span className="block mt-1 font-mono text-muted not-italic">
          ref · Title 42 CFR §422.2274 (CMS marketing rules)
        </span>
      </p>
    </section>
  );
}

function ComplianceBadge({
  compliant,
  lastAuditAt,
  disclosureVersion,
}: {
  compliant: boolean;
  lastAuditAt: string;
  disclosureVersion: string;
}) {
  if (!compliant) {
    return (
      <div className="text-right shrink-0">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] bg-warning/10 border border-warning/30">
          <span aria-hidden="true" className="block w-1.5 h-1.5 rounded-full bg-warning" />
          <span className="text-[11px] font-semibold text-warning uppercase tracking-wider">
            CMS audit required
          </span>
        </div>
        <p className="text-[10px] font-mono text-warning mt-1 tabular-nums">
          last audit · {formatDate(lastAuditAt)}
        </p>
        <p className="text-[10px] font-mono text-graphite mt-0.5 tabular-nums">
          {disclosureVersion}
        </p>
      </div>
    );
  }
  return (
    <div className="text-right shrink-0">
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] bg-pine/10 border border-pine/25">
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M2.5 6.2l2.4 2.4 4.6-4.8"
            fill="none"
            stroke="#1F5340"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[11px] font-semibold text-pine uppercase tracking-wider">
          CMS-compliant
        </span>
      </div>
      <p className="text-[10px] font-mono text-graphite mt-1 tabular-nums">
        last audit · {formatDate(lastAuditAt)}
      </p>
      <p className="text-[10px] font-mono text-graphite mt-0.5 tabular-nums">
        {disclosureVersion}
      </p>
    </div>
  );
}

function CohortBlock({
  eligibleSeniors,
  activeTrackers,
}: {
  eligibleSeniors: number;
  activeTrackers: number;
}) {
  const pct = activeTrackers > 0 ? (eligibleSeniors / activeTrackers) * 100 : 0;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">
        Eligible cohort
      </p>
      <p className="text-[28px] font-bold tabular-nums leading-none text-ink">
        {eligibleSeniors.toLocaleString()}
        <span className="text-[14px] font-normal text-graphite ml-2">tracked HHs aged 60+</span>
      </p>
      <p className="text-[12px] text-graphite mt-2">
        out of <span className="font-semibold text-ink tabular-nums">{activeTrackers.toLocaleString()}</span> active trackers
        <span className="text-muted"> · </span>
        <span className="font-mono tabular-nums">{pct.toFixed(0)}%</span>
      </p>
    </div>
  );
}

function MediCalFirstCallout({
  mediCalRoutedCount,
  eligibleSeniors,
}: {
  mediCalRoutedCount: number;
  eligibleSeniors: number;
}) {
  const pct = eligibleSeniors > 0 ? (mediCalRoutedCount / eligibleSeniors) * 100 : 0;
  return (
    <div className="rounded-[4px] bg-amber/15 border border-amber/40 p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <span aria-hidden="true" className="block w-2 h-2 rounded-full bg-amber" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/80">
            Medi-Cal first · political defense
          </p>
          <p className="text-[20px] font-bold tabular-nums leading-tight text-ink mt-1">
            {mediCalRoutedCount.toLocaleString()} HHs
            <span className="text-[13px] font-normal text-ink/70 ml-2">routed to Medi-Cal</span>
          </p>
          <p className="text-[11px] text-ink/70 mt-1.5 leading-relaxed">
            <span className="font-semibold tabular-nums">{pct.toFixed(0)}%</span> of eligible 60+ HHs · zero fee to Civica.
            Medi-Cal eligibility checked before any MA referral.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReferralFunnel({
  eligibleNonMediCal,
  referred,
  enrolled,
}: {
  eligibleNonMediCal: number;
  referred: number;
  enrolled: number;
}) {
  const max = Math.max(1, eligibleNonMediCal);
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-2">
        MA referral funnel · non-Medi-Cal cohort
      </p>
      <div className="space-y-2">
        {[
          { label: "Eligible (non-Medi-Cal)", value: eligibleNonMediCal, color: "bg-pine/85" },
          { label: "Referred to MA", value: referred, color: "bg-pine/55" },
          { label: "Enrolled", value: enrolled, color: "bg-pine/30" },
        ].map((stage) => (
          <div key={stage.label} className="flex items-center gap-3">
            <span className="w-44 text-[12px] font-semibold text-ink shrink-0">{stage.label}</span>
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
