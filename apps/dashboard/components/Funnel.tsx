import Link from "next/link";

type Stage = {
  label: string;
  count: number;
  avgDays?: number | null;
};

// Progression palette: faded gray → graphite → pine ramp. Single accent
// (pine) carries the "moving toward success" story. Avoids the prior
// gray/indigo/teal carnival that read as 4 distinct colors per page.
const STAGE_COLORS = ["bg-[#C8C2B6]", "bg-graphite", "bg-[#A8C7B3]", "bg-pine/70", "bg-pine"];

// Maps a funnel stage to the queue filter that shows those packets.
// "Submitted for Review" + "In Navigator Review" both fall under in-progress.
const STAGE_FILTER: Record<string, string> = {
  "Draft": "draft",
  "Submitted for Review": "in-progress",
  "In Navigator Review": "in-progress",
  "Ready for Handoff": "ready",
  "Handed Off": "complete",
};

export default function Funnel({ stages }: { stages: Stage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const widthPct = Math.max(8, (s.count / max) * 100);
        const prev = i > 0 ? stages[i - 1] : null;
        const conversion = prev && prev.count > 0 ? (s.count / prev.count) * 100 : null;
        const color = STAGE_COLORS[i] ?? "bg-brick";
        const filter = STAGE_FILTER[s.label];
        const href = filter ? `/packets?filter=${filter}` : null;
        const body = (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[14px] font-bold text-ink">{s.label}</span>
                <span className="text-[13px] text-graphite tabular-nums font-semibold">{s.count.toLocaleString()}</span>
              </div>
              <div className="flex items-baseline gap-3 tabular-nums">
                {conversion !== null && (
                  <span className={`text-[14px] font-bold ${
                    conversion >= 80 ? "text-pine" : conversion >= 50 ? "text-graphite" : "text-warning"
                  }`}>
                    {conversion.toFixed(0)}% advanced
                  </span>
                )}
                {s.avgDays != null && <span className="text-[12px] text-graphite font-medium">avg {s.avgDays.toFixed(1)}d</span>}
              </div>
            </div>
            <div className="h-7 bg-paper rounded-[3px] overflow-hidden relative">
              <div
                className={`h-full ${color} transition-all ${href ? "group-hover:brightness-110" : ""}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </>
        );
        return href ? (
          <Link
            key={s.label}
            href={href}
            className="block group cursor-pointer rounded-[3px] -mx-1 px-1 py-1 hover:bg-paper transition-colors"
          >
            {body}
          </Link>
        ) : (
          <div key={s.label}>{body}</div>
        );
      })}
    </div>
  );
}
