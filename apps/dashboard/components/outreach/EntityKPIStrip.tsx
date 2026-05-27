import type { OutreachNetworkKPIs } from "../../lib/demo-outreach-entities";

/**
 * Top-of-page KPI strip for /outreach/network.
 * Matches the warm-gray hero treatment used on /dashboard and /ops.
 */
export default function EntityKPIStrip({ kpis }: { kpis: OutreachNetworkKPIs }) {
  return (
    <section
      className="text-ink rounded-[6px] overflow-hidden mb-4 border border-hairline"
      style={{ backgroundColor: "#E7E5E2" }}
    >
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex items-center justify-center w-2.5 h-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-pine opacity-70 animate-ping"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pine"></span>
          </span>
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-graphite">
            Outreach network · attribution + governance
          </p>
        </div>
        <p className="text-[10px] font-mono text-muted">
          Demo data · live system writes attribution at packet-submit time
        </p>
      </div>

      <div className="px-6 pb-6 grid grid-cols-4 gap-6">
        <Stat
          label="Approved entities"
          value={kpis.approved_count.toLocaleString()}
          sublabel={`${kpis.suspended_count} suspended`}
        />
        <Stat
          label="Pending approval"
          value={kpis.pending_count.toLocaleString()}
          sublabel={kpis.pending_count > 0 ? "awaiting operator review" : "queue clear"}
          accentWarning={kpis.pending_count > 0}
        />
        <Stat
          label="Enrollments · this month"
          value={kpis.enrollments_this_month_total.toLocaleString()}
          sublabel="attributed to entities below"
        />
        <Stat
          label="Cumulative enrollments"
          value={kpis.enrollments_cumulative_total.toLocaleString()}
          sublabel={kpis.flags_open > 0 ? `${kpis.flags_open} open QC flag${kpis.flags_open === 1 ? "" : "s"}` : "no open QC flags"}
        />
      </div>

      <div
        className="px-6 py-2 border-t border-hairline text-[10px] uppercase tracking-[0.16em] font-mono text-muted"
        style={{ backgroundColor: "#DCD9D2" }}
      >
        {kpis.projection_label}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sublabel,
  accentWarning,
}: {
  label: string;
  value: string;
  sublabel: string;
  accentWarning?: boolean;
}) {
  return (
    <div className="pr-2 border-r border-hairline last:border-r-0">
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted mb-2">
        {label}
      </p>
      <p className={`text-[28px] font-bold tracking-tight leading-none tabular-nums ${accentWarning ? "text-warning" : "text-ink"}`}>
        {value}
      </p>
      <p className="text-[11px] text-graphite mt-2">{sublabel}</p>
    </div>
  );
}
