import { StatusPill, type PacketStatus } from "./StatusPill";
import type { components } from "@/lib/api/types";

type HistoryEntry = components["schemas"]["PacketHistoryEntry"];

type Props = { entries: HistoryEntry[] };

export function PacketTimeline({ entries }: Props) {
  if (entries.length === 0) return null;

  // Most recent first
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <ol
      aria-label="Application history"
      className="relative space-y-0 border-l border-slate-200 pl-6"
    >
      {sorted.map((entry, i) => (
        <li key={i} className="relative pb-6 last:pb-0">
          {/* Dot */}
          <span
            aria-hidden="true"
            className="absolute -left-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-slate-300 ring-2 ring-slate-200"
          />

          <div className="space-y-1">
            <StatusPill status={entry.status as PacketStatus} />
            <p className="text-xs text-slate-500">
              {new Date(entry.timestamp).toLocaleString()}
            </p>
            {entry.note && (
              <p className="text-sm text-slate-600">{entry.note}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
