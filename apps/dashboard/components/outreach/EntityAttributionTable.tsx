import type { OutreachEntity } from "../../lib/demo-outreach-entities";
import { ENTITY_TYPE_LABEL } from "../../lib/demo-outreach-entities";

/**
 * Main attribution table for /outreach/network.
 *
 * Lists approved + suspended entities sorted by this-month enrollment volume.
 * Each row shows attribution counts, type, county focus, last activity, and
 * a status pill. Suspended entities render with a muted treatment + the
 * suspension note inline.
 */
export default function EntityAttributionTable({
  entities,
}: {
  entities: OutreachEntity[];
}) {
  // Sort: active first by this-month volume desc; suspended last.
  const sorted = [...entities].sort((a, b) => {
    if (a.status === "suspended" && b.status !== "suspended") return 1;
    if (b.status === "suspended" && a.status !== "suspended") return -1;
    return b.enrollments_this_month - a.enrollments_this_month;
  });

  const maxMonthly = Math.max(1, ...sorted.map((e) => e.enrollments_this_month));

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1">Active attribution · last 30 days</p>
          <h2 className="text-[18px] font-bold tracking-tight text-ink">Who&apos;s enrolling individuals through Civica</h2>
          <p className="text-[12px] text-graphite mt-1">
            {sorted.filter((e) => e.status === "approved").length} approved entities ·
            sorted by this-month volume · attribution recorded at packet-submit time
          </p>
        </div>
        <button
          type="button"
          className="text-[12px] font-semibold px-3 py-1.5 rounded-[3px] border border-ink/30 text-ink hover:border-ink/60 transition-colors whitespace-nowrap"
        >
          + Add new entity
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left">
              <th className="font-semibold text-graphite uppercase tracking-wider text-[10px] pb-2 pr-3">Entity</th>
              <th className="font-semibold text-graphite uppercase tracking-wider text-[10px] pb-2 px-3">Type</th>
              <th className="font-semibold text-graphite uppercase tracking-wider text-[10px] pb-2 px-3">Focus</th>
              <th className="font-semibold text-graphite uppercase tracking-wider text-[10px] pb-2 px-3 text-right">This month</th>
              <th className="font-semibold text-graphite uppercase tracking-wider text-[10px] pb-2 px-3">Volume</th>
              <th className="font-semibold text-graphite uppercase tracking-wider text-[10px] pb-2 px-3 text-right">Cumulative</th>
              <th className="font-semibold text-graphite uppercase tracking-wider text-[10px] pb-2 px-3">Last activity</th>
              <th className="font-semibold text-graphite uppercase tracking-wider text-[10px] pb-2 pl-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {sorted.map((e) => {
              const isSuspended = e.status === "suspended";
              const barWidth = maxMonthly > 0 ? Math.max(2, (e.enrollments_this_month / maxMonthly) * 100) : 0;
              return (
                <tr key={e.entity_id} className={isSuspended ? "opacity-60" : ""}>
                  <td className="py-3 pr-3 max-w-[280px]">
                    <p className="text-[13px] font-semibold text-ink leading-snug">{e.name}</p>
                    <p className="text-[11px] text-graphite mt-0.5">
                      <span className="font-mono">{e.contact_email}</span>
                      {e.flags_count > 0 && (
                        <span className="ml-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded-[3px] bg-warning/15 text-warning border border-warning/30">
                          {e.flags_count} QC flag{e.flags_count === 1 ? "" : "s"}
                        </span>
                      )}
                    </p>
                    {isSuspended && e.notes && (
                      <p className="text-[11px] text-warning italic mt-1">{e.notes}</p>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] bg-paper text-graphite border border-hairline whitespace-nowrap">
                      {ENTITY_TYPE_LABEL[e.type]}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-graphite whitespace-nowrap">
                    {e.county_focus ?? "Statewide"}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-ink font-semibold">
                    {e.enrollments_this_month.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 w-32">
                    <div className="h-1.5 bg-paper rounded-full overflow-hidden">
                      <div className="h-full bg-pine" style={{ width: `${barWidth}%` }} />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-graphite">
                    {e.enrollments_cumulative.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-graphite whitespace-nowrap">
                    {formatRelative(e.last_enrollment_at)}
                  </td>
                  <td className="py-3 pl-3">
                    <StatusPill status={e.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-graphite mt-4 italic">
        Attribution is recorded at packet-submit time via the entity_id field. QC flags surface here
        when an entity&apos;s packets fail navigator review at &gt;2σ above population baseline.
      </p>
    </section>
  );
}

function StatusPill({ status }: { status: OutreachEntity["status"] }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-[3px] bg-pine/10 text-pine border border-pine/30 whitespace-nowrap">
        Approved
      </span>
    );
  }
  if (status === "suspended") {
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-[3px] bg-warning/15 text-warning border border-warning/30 whitespace-nowrap">
        Suspended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-[3px] bg-paper text-graphite border border-hairline whitespace-nowrap">
      Pending
    </span>
  );
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  const ageMs = Date.now() - ts;
  const ageMin = Math.floor(ageMs / 60_000);
  if (ageMin < 1) return "just now";
  if (ageMin < 60) return `${ageMin} min ago`;
  const ageHr = Math.floor(ageMin / 60);
  if (ageHr < 24) return `${ageHr}h ago`;
  const ageDays = Math.floor(ageHr / 24);
  if (ageDays < 30) return `${ageDays}d ago`;
  return new Date(iso).toLocaleDateString();
}
