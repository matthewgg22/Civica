// ---------------------------------------------------------------------------
// DenialRatePanel — Civica cohort approval/denial rate vs. CDSS statewide
//
// CDSS public CalFresh baseline (CF 296 Statistical Report, FY2023):
//   Approved:   ~62%   (county issued approval)
//   Denied:     ~23%   (county issued denial)
//   Withdrawn:  ~15%   (applicant withdrew or incomplete — not a county denial)
//
// This comparison is the interim §10106 proof mechanism: Civica-assisted
// applicants vs. the statewide BenefitsCal-submitted baseline, available
// monthly from the CDSS CalFresh Data Dashboard before USDA QC audit data
// arrives (which lags 12–18 months).
//
// Source: cdss.ca.gov CalFresh Data Dashboard, updated monthly.
// ---------------------------------------------------------------------------

const SAMPLE_THRESHOLD = 30;

// CDSS public CalFresh statewide rates (FY2023, CF 296 Statistical Report)
const CDSS_BASELINE = {
  approved: 62,
  denied: 23,
  withdrawn: 15,
} as const;

export type OutcomeSummary = {
  approved: number;
  denied: number;
  pending: number;
  total: number; // packets with any county_outcome recorded
};

export default function DenialRatePanel({
  outcomes,
}: {
  outcomes: OutcomeSummary;
}) {
  const decided = outcomes.approved + outcomes.denied;
  const sufficient = decided >= SAMPLE_THRESHOLD;

  const civicaApprovalPct = decided > 0 ? (outcomes.approved / decided) * 100 : null;
  const civicaDenialPct   = decided > 0 ? (outcomes.denied   / decided) * 100 : null;

  const approvalLift =
    civicaApprovalPct !== null
      ? +(civicaApprovalPct - CDSS_BASELINE.approved).toFixed(1)
      : null;

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-7">
      <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">
            Denial rate · Civica cohort vs. CDSS CalFresh statewide baseline
          </p>
          <h3 className="text-[20px] font-semibold tracking-tight text-ink leading-tight">
            Do Civica-assisted applicants enroll at a higher rate than the state average?
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            County-issued approvals and denials from packets recorded after handoff. Compares
            against the CDSS CalFresh statewide baseline (CF 296, FY2023 — updated monthly at
            cdss.ca.gov). This is the §10106 proof mechanism: pre-verified packets reduce
            county correction cycles, which reduces denials.
          </p>
        </div>
        <div className="text-right shrink-0">
          <SampleChip n={decided} sufficient={sufficient} />
          <p className="text-[11px] text-graphite font-mono tracking-wide mt-1.5">
            source: snap_packets.county_outcome
          </p>
        </div>
      </div>

      {decided === 0 ? (
        <EmptyState pending={outcomes.pending} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <OutcomeBar
              label="Civica-assisted applicants"
              approvedPct={civicaApprovalPct!}
              deniedPct={civicaDenialPct!}
              n={decided}
              isLive
            />
            <OutcomeBar
              label="CDSS statewide CalFresh (FY2023)"
              approvedPct={CDSS_BASELINE.approved}
              deniedPct={CDSS_BASELINE.denied}
              withdrawnPct={CDSS_BASELINE.withdrawn}
              n={null}
              isLive={false}
            />
          </div>

          {approvalLift !== null && (
            <LiftCallout lift={approvalLift} decided={decided} />
          )}
        </>
      )}

      {/* How to read */}
      <div className="flex gap-4 items-start bg-paper border border-hairline/50 rounded-[3px] p-4 mt-5">
        <InfoIcon />
        <p className="text-[12px] text-graphite leading-relaxed">
          <strong className="text-ink font-semibold">Recording outcomes.</strong>{" "}
          When a county issues a decision, open the packet and set the county outcome field to
          "Approved" or "Denied." Withdrawn applications are not county denials — record those
          separately. Above {SAMPLE_THRESHOLD} decided cases the panel becomes statistically
          meaningful for the §10106 pitch.
        </p>
      </div>
    </section>
  );
}

function OutcomeBar({
  label,
  approvedPct,
  deniedPct,
  withdrawnPct,
  n,
  isLive,
}: {
  label: string;
  approvedPct: number;
  deniedPct: number;
  withdrawnPct?: number;
  n: number | null;
  isLive: boolean;
}) {
  const restPct = 100 - approvedPct - deniedPct - (withdrawnPct ?? 0);

  return (
    <div className="bg-paper border border-hairline rounded-[3px] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        {n !== null && (
          <p className="text-[11px] text-graphite font-mono">n = {n}</p>
        )}
        {n === null && (
          <p className="text-[11px] text-graphite font-mono">CF 296 · FY2023</p>
        )}
      </div>

      {/* Stacked bar */}
      <div className="flex h-4 rounded-sm overflow-hidden mb-3">
        <div
          className="flex items-center justify-center"
          style={{ width: `${approvedPct}%`, background: "var(--color-amber)" }}
        />
        <div
          className="flex items-center justify-center"
          style={{ width: `${deniedPct}%`, background: "#9C3A24" }}
        />
        {withdrawnPct && (
          <div
            className="flex items-center justify-center"
            style={{ width: `${withdrawnPct}%`, background: "#C4B89A" }}
          />
        )}
        {restPct > 0 && !isLive && (
          <div
            className="flex items-center justify-center"
            style={{ width: `${restPct}%`, background: "#EDE8DD" }}
          />
        )}
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <RateChip color="var(--color-amber)" label="Approved" pct={approvedPct} />
        <RateChip color="#9C3A24" label="Denied" pct={deniedPct} />
        {withdrawnPct !== undefined && (
          <RateChip color="#C4B89A" label="Withdrawn" pct={withdrawnPct} />
        )}
      </div>
    </div>
  );
}

function RateChip({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-sm shrink-0"
        style={{ background: color }}
      />
      <span className="text-[12px] text-graphite">{label}</span>
      <span className="text-[12px] font-semibold tabular-nums text-ink">{pct.toFixed(1)}%</span>
    </div>
  );
}

function LiftCallout({ lift, decided }: { lift: number; decided: number }) {
  const isPositive = lift > 0;
  const isNoise = Math.abs(lift) < 2;
  const color = isNoise ? "#5A544D" : isPositive ? "var(--color-amber)" : "#9C3A24";
  const arrow = isNoise ? "≈" : isPositive ? "▲" : "▼";

  return (
    <div
      className="rounded-[3px] border p-4 flex items-center gap-4"
      style={{ borderColor: `${color}33`, background: `${color}08` }}
    >
      <span className="text-[28px] font-bold tabular-nums" style={{ color }}>
        {arrow} {Math.abs(lift).toFixed(1)} pp
      </span>
      <div>
        <p className="text-[13px] font-semibold text-ink">
          {isNoise
            ? "Within noise range of the statewide baseline."
            : isPositive
            ? `Civica-assisted applicants approved at ${lift.toFixed(1)} pp above the statewide baseline.`
            : `Civica-assisted applicants approved at ${Math.abs(lift).toFixed(1)} pp below the statewide baseline — investigate denial reasons.`}
        </p>
        <p className="text-[12px] text-graphite mt-0.5">
          Based on {decided} decided cases. Above {SAMPLE_THRESHOLD} cases with known outcomes before using in the §10106 pitch deck.
        </p>
      </div>
    </div>
  );
}

function EmptyState({ pending }: { pending: number }) {
  return (
    <div className="border border-dashed border-hairline rounded-[3px] p-8 text-center">
      <p className="text-[14px] font-semibold text-graphite">No county decisions recorded yet.</p>
      <p className="text-[12px] text-muted mt-1 max-w-sm mx-auto">
        When the county issues a decision on a handed-off packet, open the packet
        and set the county outcome.
        {pending > 0 && (
          <> {pending} packet{pending !== 1 ? "s are" : " is"} awaiting a county decision.</>
        )}
      </p>
    </div>
  );
}

function SampleChip({ n, sufficient }: { n: number; sufficient: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold ${
        sufficient ? "bg-teal/10 text-teal" : "bg-amber/10 text-amber"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      n = {n} · {sufficient ? "above" : "below"} {SAMPLE_THRESHOLD}-case threshold
    </span>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0">
      <circle cx="8" cy="8" r="7" fill="none" stroke="#5A544D" strokeWidth="1.5" />
      <path d="M8 5 V 9" stroke="#5A544D" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.8" fill="#5A544D" />
    </svg>
  );
}
