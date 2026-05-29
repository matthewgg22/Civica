const STAGES = [
  "Draft",
  "Submitted for Review",
  "In Navigator Review",
  "Ready for Handoff",
  "Handed Off",
  "Closed",
] as const;

// Shorter labels for the strip (full names live in the status pill above)
const SHORT_LABEL: Record<(typeof STAGES)[number], string> = {
  "Draft": "Draft",
  "Submitted for Review": "Submitted",
  "In Navigator Review": "In Review",
  "Ready for Handoff": "Ready",
  "Handed Off": "Handed Off",
  "Closed": "Closed",
};

const DETOUR_STATUSES = ["Needs Documents", "Needs Applicant Clarification"];

export default function LifecycleStrip({ status }: { status: string }) {
  const isDetour = DETOUR_STATUSES.includes(status);
  // When in a detour, the "main path" position is Submitted for Review or In Navigator Review
  const effective = isDetour ? "Submitted for Review" : status;
  const currentIdx = STAGES.indexOf(effective as (typeof STAGES)[number]);

  return (
    <div>
      <ol className="flex items-center w-full">
        {STAGES.map((stage, i) => {
          const isComplete = i < currentIdx;
          const isCurrent = i === currentIdx;
          const dotColor = isComplete
            ? "bg-teal"
            : isCurrent
              ? isDetour ? "bg-warning" : "bg-ink"
              : "bg-hairline";
          const lineColor = i < currentIdx ? "bg-teal" : "bg-hairline";
          // boxShadow rgbas derive from the dot color: ink (#1A1714 = 26,23,20)
          // for normal current; warning (#B5511E = 181,81,30) for detour-current.
          const currentShadow = isDetour
            ? "rgba(181,81,30,0.15)"
            : "rgba(26,23,20,0.15)";
          return (
            <li key={stage} className="flex-1 flex items-center first:flex-none last:flex-none">
              {i > 0 && <div className={`h-px flex-1 ${lineColor}`} />}
              <div className="flex flex-col items-center px-2">
                <div className={`w-3 h-3 rounded-full ${dotColor} ${isCurrent ? "ring-4 ring-offset-0" : ""}`} style={isCurrent ? { boxShadow: `0 0 0 4px ${currentShadow}` } : {}} />
                <span className={`text-[11px] font-medium uppercase tracking-wider mt-2 whitespace-nowrap ${isCurrent ? "text-ink font-semibold" : isComplete ? "text-teal" : "text-graphite"}`}>
                  {SHORT_LABEL[stage]}
                </span>
              </div>
              {i < STAGES.length - 1 && <div className={`h-px flex-1 ${i < currentIdx ? "bg-teal" : "bg-hairline"}`} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
