type QCStats = {
  totalOutcomes: number;
  sampledCount: number;
  errorCount: number;
  errorRate: number | null;
  packetsCovered: number;
  totalPackets: number;
  byErrorType: [string, number][];
};

const ERROR_TYPE_LABELS: Record<string, string> = {
  utility_sua:                "Shelter / Utility (SUA)",
  gig_income:                 "Gig / Earned Income",
  shared_lease:               "Shared Lease / Shelter Cost",
  assets:                     "Asset Test",
  benefit_impact_projection:  "Benefit Calculation",
  unknown:                    "Other / Unclassified",
};

function fmt(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export default function QCOutcomesPanel({ stats }: { stats: QCStats }) {
  const coveragePct = stats.totalPackets > 0
    ? Math.round((stats.packetsCovered / stats.totalPackets) * 100)
    : 0;

  const hasData = stats.totalOutcomes > 0;

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="mb-5 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="section-title">QC Outcome Tracker</h2>
          <p className="section-sub mt-1 leading-snug">
            Navigator-logged quality control sampling results — ground truth for error rate tracking.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-pine uppercase tracking-wider bg-pine/10 px-2.5 py-1 rounded-full">
          ◆ Error Risk
        </span>
      </div>

      {!hasData ? (
        <div className="text-center py-8 border border-dashed border-hairline rounded-[4px]">
          <p className="text-[14px] font-semibold text-graphite">No QC outcomes logged yet.</p>
          <p className="text-[12px] text-muted mt-1">
            Navigators log QC results via <code className="font-mono text-[11px]">POST /navigator/packets/:id/qc-outcome</code> after USDA sampling.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top-line metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Packets sampled"
              value={stats.sampledCount.toString()}
              sub={`of ${stats.totalPackets.toLocaleString()} total`}
              accent="text-ink"
            />
            <StatCard
              label="Coverage"
              value={`${coveragePct}%`}
              sub={`${stats.packetsCovered} packets touched`}
              accent={coveragePct >= 5 ? "text-teal" : "text-warning"}
            />
            <StatCard
              label="Errors found"
              value={stats.errorCount.toString()}
              sub={`of ${stats.sampledCount} sampled`}
              accent={stats.errorCount > 0 ? "text-brick" : "text-teal"}
            />
            <StatCard
              label="Error rate"
              value={fmt(stats.errorRate)}
              sub="sampled cases only"
              accent={
                stats.errorRate === null ? "text-graphite"
                  : stats.errorRate >= 0.15 ? "text-brick"
                  : stats.errorRate >= 0.08 ? "text-warning"
                  : "text-teal"
              }
            />
          </div>

          {/* Error rate bar vs USDA CA baseline */}
          {stats.errorRate !== null && (
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-[12px] font-semibold text-ink">Civica error rate vs CA baseline (10.98%)</p>
                <span className={`text-[12px] font-bold tabular-nums ${stats.errorRate >= 0.1098 ? "text-brick" : "text-teal"}`}>
                  {fmt(stats.errorRate)}
                </span>
              </div>
              <div className="relative h-4 bg-paper border border-hairline rounded-full overflow-hidden">
                {/* CA baseline marker */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-graphite/40 z-10"
                  style={{ left: "10.98%" }}
                />
                {/* Civica rate bar */}
                <div
                  className={`h-full rounded-full transition-all ${stats.errorRate >= 0.1098 ? "bg-brick/60" : "bg-teal/60"}`}
                  style={{ width: `${Math.min(stats.errorRate * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-graphite">0%</span>
                <span className="text-[10px] text-graphite/60">↑ CA baseline 10.98%</span>
                <span className="text-[10px] text-graphite">100%</span>
              </div>
            </div>
          )}

          {/* Error type breakdown */}
          {stats.byErrorType.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-graphite mb-3">Errors by Type</p>
              <ul className="space-y-2">
                {stats.byErrorType.map(([type, count]) => {
                  const label = ERROR_TYPE_LABELS[type] ?? type;
                  const pct = stats.errorCount > 0 ? (count / stats.errorCount) * 100 : 0;
                  return (
                    <li key={type} className="flex items-center gap-3">
                      <span className="text-[12px] text-ink font-medium w-44 truncate shrink-0">{label}</span>
                      <div className="flex-1 h-2 bg-paper border border-hairline rounded-full overflow-hidden">
                        <div className="h-full bg-brick/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-graphite tabular-nums w-10 text-right shrink-0">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Context note */}
          <p className="text-[11px] text-graphite border-t border-hairline pt-3">
            USDA CA FY2024 baseline: 10.98% PER · sampled cases only (unsampled ≠ clean) ·
            error rate becomes meaningful above ~30 sampled cases.
          </p>
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-paper rounded-[4px] px-4 py-4 border border-hairline">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-graphite mb-2">{label}</p>
      <p className={`text-[26px] font-bold tabular-nums leading-none ${accent}`}>{value}</p>
      <p className="text-[11px] text-graphite mt-1.5">{sub}</p>
    </div>
  );
}
