import type { DistressOverlayData } from "../../lib/ops-fetchers";

/**
 * Panel 12 · Distress-flag honor commitment.
 *
 * Political-defense surface. For every monetization line (ads, MA referrals,
 * future WOTC/tax-prep), Civica excludes HHs in active distress states —
 * denials, appeals, OBBBA §10102 distress-prompt confirmations, recert lapses.
 *
 * Answers the journalist/CDSS question: "Do you push ads on people whose
 * SNAP got denied?" — with a table that proves the answer is "no."
 *
 * Privacy posture (D13): the recent-events strip surfaces county_fips only;
 * never user_id, name, or any other identifier.
 */
export default function DistressOverlayPanel({ data }: { data: DistressOverlayData }) {
  return (
    <section className="bg-surface border-2 border-pine/30 rounded-[4px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1 text-pine">Panel 12 · Compliance · Distress honor flag</p>
          <h3 className="text-[18px] font-bold tracking-tight text-ink">Withheld from monetization</h3>
          <p className="text-[12px] text-graphite mt-1">
            Distress-flagged HHs are excluded from every monetization line ·
            past {data.flag_window_days} days
          </p>
        </div>
        <span className="text-[10px] font-mono text-muted uppercase tracking-wider whitespace-nowrap">
          County-bucketed · no user IDs (D13)
        </span>
      </div>

      {!data.available ? (
        <EmptyState
          message="Apply migrations to populate this panel."
          detail="distress_flag_events (pending migration) not present locally."
        />
      ) : (
        <div className="space-y-5">
          <HonorCallout />

          <div className="grid grid-cols-[auto_1fr] gap-6 items-stretch">
            <ActiveFlagsBlock
              totalActiveFlags={data.total_active_flags}
              windowDays={data.flag_window_days}
            />
            <WithholdTable rows={data.withheld_by_line} />
          </div>

          <RecentEventsStrip events={data.recent_events} />
        </div>
      )}

      <p className="text-[11px] text-graphite mt-4 italic">
        Distress flags include SNAP denials, open appeals, OBBBA §10102 distress-prompt
        confirmations, and recert lapses &gt; 14 days. Flags clear automatically when the
        underlying condition resolves.
      </p>
    </section>
  );
}

function HonorCallout() {
  return (
    <div className="flex items-start gap-3 p-4 bg-pine/5 border border-pine/20 rounded-[4px]">
      <ShieldIcon />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-pine mb-1">
          Distress-flag honor commitment
        </p>
        <p className="text-[13px] text-ink leading-relaxed">
          Civica never monetizes HHs in active distress states — denials, appeals,
          OBBBA §10102 distress prompts, or recent recert lapses.
        </p>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="20" height="20" viewBox="0 0 20 20" fill="none"
      className="text-pine shrink-0 mt-0.5"
      aria-hidden="true"
    >
      <path
        d="M10 2 L17 5 V10 C17 14 13.5 17 10 18 C6.5 17 3 14 3 10 V5 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M7 10 L9 12 L13 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActiveFlagsBlock({
  totalActiveFlags,
  windowDays,
}: {
  totalActiveFlags: number;
  windowDays: number;
}) {
  return (
    <div className="flex flex-col justify-center px-5 py-4 border border-hairline rounded-[4px] bg-paper min-w-[180px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
        Active distress flags
      </p>
      <p className="text-[36px] font-bold tabular-nums leading-none text-ink">
        {totalActiveFlags.toLocaleString()}
      </p>
      <p className="text-[11px] text-graphite mt-2 leading-snug">
        last {windowDays}d · all excluded from monetization
      </p>
    </div>
  );
}

function WithholdTable({
  rows,
}: {
  rows: DistressOverlayData["withheld_by_line"];
}) {
  return (
    <div className="border border-hairline rounded-[4px] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-paper">
            <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted px-3 py-2">
              Monetization line
            </th>
            <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted px-3 py-2">
              Withheld
            </th>
            <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted px-3 py-2 w-28">
              Unit
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isPlaceholder = row.withheld_count === null;
            return (
              <tr
                key={row.line_key}
                className={i < rows.length - 1 ? "border-b border-hairline" : ""}
              >
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`block w-1.5 h-1.5 rounded-full ${
                        isPlaceholder ? "bg-muted/40" : "bg-warning"
                      }`}
                    />
                    <span className={`text-[13px] ${isPlaceholder ? "text-graphite" : "font-semibold text-ink"}`}>
                      {row.line_label}
                    </span>
                    {isPlaceholder && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
                        not live
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`text-[14px] font-mono tabular-nums ${isPlaceholder ? "text-muted" : "font-bold text-ink"}`}>
                    {isPlaceholder ? "—" : row.withheld_count!.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-graphite font-mono">
                  {row.unit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentEventsStrip({
  events,
}: {
  events: DistressOverlayData["recent_events"];
}) {
  return (
    <div className="pt-4 border-t border-hairline">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Recent distress flags raised
        </p>
        <p className="text-[10px] font-mono text-muted">
          last {events.length} · county only
        </p>
      </div>
      {events.length === 0 ? (
        <p className="text-[12px] text-graphite italic">No recent distress flags.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {events.map((ev, i) => (
            <li key={i} className="py-2 flex items-center gap-3 text-[12px]">
              <span className="font-mono text-graphite tabular-nums w-24 shrink-0">
                {formatRelativeTime(ev.ts)}
              </span>
              <span className="text-ink flex-1 truncate">
                {formatFlagType(ev.flag_type)}
              </span>
              <span className="font-mono text-muted tabular-nums shrink-0">
                FIPS {ev.county_fips}
              </span>
            </li>
          ))}
        </ul>
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

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const FLAG_TYPE_LABELS: Record<string, string> = {
  denial_appeal_opened: "Denial appeal opened",
  obbba_distress_prompt: "OBBBA §10102 distress prompt confirmed",
  recert_lapse_14d: "Recert lapse > 14d",
  recert_lapse: "Recert lapse",
  denial_received: "SNAP denial received",
};

function formatFlagType(flagType: string): string {
  return FLAG_TYPE_LABELS[flagType] ?? flagType.replace(/_/g, " ");
}
