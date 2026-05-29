// /pilot — Pilot cohort measurement console (TODO-12).
//
// Operator-bookmarkable view of the pilot cohort funnel. Cohort is defined
// by URL params (?since&until on snap_packets.created_at). Defaults to the
// last 30 days. Renders funnel, stage-transition medians, stalled packets,
// and aggregate risk. Pairs with the human half of TODO-12: the cohort
// definition + "pilot success" criteria document.
//
// Cohort membership is intentionally time-window-based — no new DB schema.
// When a proper `pilot_cohorts` table lands, swap the fetcher.

import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import { fetchPilotCohort, resolveCohortWindow, PACKET_STATUSES } from "../../lib/pilot-fetcher";

export const dynamic = "force-dynamic";

interface SearchParams {
  since?: string;
  until?: string;
}

export default async function PilotPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const params = await searchParams;
  const { since, until } = resolveCohortWindow(params);
  const report = await fetchPilotCohort(since, until);

  const windowDays = Math.max(
    1,
    Math.round((new Date(until).getTime() - new Date(since).getTime()) / 86_400_000),
  );
  const formatDate = (iso: string) => iso.slice(0, 10);
  const formatHours = (h: number | null) =>
    h == null ? "—" : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;

  const exportHref = `/pilot/export.json?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`;

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active={"dashboard" as const} />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">
        {/* Page header */}
        <div className="flex items-end justify-between gap-6 pb-3">
          <div>
            <p className="eyebrow mb-1">Pilot cohort console</p>
            <h2 className="text-[26px] font-bold tracking-tight leading-none text-ink">
              Cohort measurement
            </h2>
            <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
              Funnel, stage-transition timing, stalled packets, and aggregate
              risk for the pilot cohort — defined by the packet creation window
              below. Change the dates to retarget the cohort; bookmark the URL
              once the pilot starts.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={exportHref}
              className="text-[12px] font-semibold text-pine hover:underline"
            >
              Export JSON ↗
            </Link>
          </div>
        </div>

        {/* Cohort window strip */}
        <section className="bg-surface border border-hairline rounded-[4px] px-6 py-4">
          <form method="get" className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-graphite">
                Since
              </span>
              <input
                type="date"
                name="since"
                defaultValue={formatDate(since)}
                className="text-[13px] tabular-nums border border-hairline rounded-[3px] px-2 py-1 bg-paper"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-graphite">
                Until
              </span>
              <input
                type="date"
                name="until"
                defaultValue={formatDate(until)}
                className="text-[13px] tabular-nums border border-hairline rounded-[3px] px-2 py-1 bg-paper"
              />
            </label>
            <button
              type="submit"
              className="text-[12px] font-semibold text-white bg-pine hover:opacity-90 px-3 py-[7px] rounded-[3px]"
            >
              Update window
            </button>
            <div className="ml-auto text-right">
              <p className="text-[28px] font-semibold text-ink tabular-nums leading-none">
                {report.cohort_size}
              </p>
              <p className="text-[12px] text-muted mt-1">
                packets · {windowDays}-day window
                {report.source === "demo" && (
                  <span className="ml-2 text-warning font-semibold">demo data</span>
                )}
              </p>
            </div>
          </form>
        </section>

        {/* Funnel */}
        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <div className="mb-4">
            <p className="eyebrow mb-1">Funnel</p>
            <h3 className="text-[18px] font-semibold tracking-tight text-ink leading-tight">
              Where the cohort is right now
            </h3>
            <p className="text-[12px] text-graphite mt-1">
              Current status counts. Use this to find the drop-off stage — the
              one packets enter but few leave.
            </p>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-graphite">
                <th className="text-left font-semibold pb-2">Status</th>
                <th className="text-right font-semibold pb-2 tabular-nums">Count</th>
                <th className="text-right font-semibold pb-2 tabular-nums">% of cohort</th>
                <th className="text-left font-semibold pb-2 pl-6">Bar</th>
              </tr>
            </thead>
            <tbody>
              {report.funnel.map((row) => (
                <tr key={row.status} className="border-t border-hairline">
                  <td className="py-2 text-ink">{row.status}</td>
                  <td className="py-2 text-right tabular-nums text-ink font-medium">{row.count}</td>
                  <td className="py-2 text-right tabular-nums text-graphite">
                    {(row.pct * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 pl-6">
                    <div className="h-1.5 bg-paper rounded-full overflow-hidden max-w-[240px]">
                      <div
                        className="h-full bg-pine"
                        style={{ width: `${Math.min(100, row.pct * 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Stage durations */}
        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <div className="mb-4">
            <p className="eyebrow mb-1">Time to complete</p>
            <h3 className="text-[18px] font-semibold tracking-tight text-ink leading-tight">
              Stage-transition durations
            </h3>
            <p className="text-[12px] text-graphite mt-1">
              Median and 75th-percentile time across packets that completed each
              transition. Small n means the median moves with each new packet —
              read directionally until n ≥ 5.
            </p>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-graphite">
                <th className="text-left font-semibold pb-2">Transition</th>
                <th className="text-right font-semibold pb-2 tabular-nums">n</th>
                <th className="text-right font-semibold pb-2 tabular-nums">Median</th>
                <th className="text-right font-semibold pb-2 tabular-nums">P75</th>
              </tr>
            </thead>
            <tbody>
              {report.stage_durations.map((row) => (
                <tr key={row.key} className="border-t border-hairline">
                  <td className="py-2 text-ink">{row.label}</td>
                  <td className="py-2 text-right tabular-nums text-graphite">{row.n}</td>
                  <td className="py-2 text-right tabular-nums text-ink font-medium">
                    {formatHours(row.median_hours)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-graphite">
                    {formatHours(row.p75_hours)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Stalled */}
        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <div className="mb-4">
            <p className="eyebrow mb-1">Stalled packets</p>
            <h3 className="text-[18px] font-semibold tracking-tight text-ink leading-tight">
              No status change in &gt;72h ({report.stalled.length} of {report.cohort_size})
            </h3>
            <p className="text-[12px] text-graphite mt-1">
              Non-terminal packets where the last transition is older than 72h.
              These are your drop-off candidates — chase them before they age out.
            </p>
          </div>
          {report.stalled.length === 0 ? (
            <p className="text-[13px] text-muted py-3">No stalled packets in this window.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-graphite">
                  <th className="text-left font-semibold pb-2">Packet</th>
                  <th className="text-left font-semibold pb-2">Status</th>
                  <th className="text-left font-semibold pb-2">County</th>
                  <th className="text-right font-semibold pb-2 tabular-nums">Stalled for</th>
                </tr>
              </thead>
              <tbody>
                {report.stalled.map((row) => (
                  <tr key={row.packet_id} className="border-t border-hairline">
                    <td className="py-2">
                      <Link
                        href={`/packets/${row.packet_id}`}
                        className="text-pine font-semibold hover:underline tabular-nums"
                      >
                        {row.packet_id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="py-2 text-ink">{row.status}</td>
                    <td className="py-2 text-graphite">{row.county ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums text-warning font-medium">
                      {formatHours(row.hours_in_status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Risk */}
        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <div className="mb-4">
            <p className="eyebrow mb-1">Error frequency</p>
            <h3 className="text-[18px] font-semibold tracking-tight text-ink leading-tight">
              Aggregate engine risk across the cohort
            </h3>
            <p className="text-[12px] text-graphite mt-1">
              Latest scoreErrorRisk per packet. High-tier count is the headline:
              that's how many cohort packets would fail the &quot;error-risk
              acceptable&quot; sign-off gate today.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat
              label="Avg risk score"
              value={report.risk.avg_score == null ? "—" : report.risk.avg_score.toFixed(1)}
              sublabel={`n=${report.risk.n_with_score} scored`}
            />
            <Stat
              label="High tier"
              value={report.risk.high_tier_count.toString()}
              sublabel="needs review"
              tone="warning"
            />
            <Stat
              label="Medium tier"
              value={report.risk.medium_tier_count.toString()}
              sublabel="acceptable"
            />
            <Stat
              label="Low tier"
              value={report.risk.low_tier_count.toString()}
              sublabel="green"
              tone="teal"
            />
          </div>
        </section>

        {/* Method footnote */}
        <p className="text-[11px] text-graphite leading-relaxed">
          Cohort = packets whose <span className="font-mono">created_at</span>{" "}
          falls in <span className="font-mono">[{since}, {until})</span>.
          Stage durations use the trigger-populated columns on{" "}
          <span className="font-mono">snap_packets</span>; stall detection joins{" "}
          <span className="font-mono">packet_status_history</span>. When the
          live query returns zero in the window, demo fixtures fill in (set{" "}
          <span className="font-mono">DEMO_FALLBACK=false</span> to disable).
          Statuses tracked:{" "}
          {PACKET_STATUSES.join(" · ")}.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel: string;
  tone?: "teal" | "warning";
}) {
  const valueColor =
    tone === "warning" ? "text-warning" : tone === "teal" ? "text-teal" : "text-ink";
  return (
    <div className="border-l-2 border-hairline pl-3">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-graphite">{label}</p>
      <p className={`text-[24px] font-semibold tabular-nums leading-tight mt-1 ${valueColor}`}>
        {value}
      </p>
      <p className="text-[11px] text-graphite mt-0.5">{sublabel}</p>
    </div>
  );
}
