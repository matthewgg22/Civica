// Status colors mirror StatusBadge so the icon + pill on a packet row
// read as ONE color per status (not two). Previously "Needs Documents"
// / "Needs Applicant Clarification" used amber (gold — positive
// outcomes) here but warning (burnt orange — process warnings) in the
// badge, so each row shouted in two different shades of warm for the
// same logical state.
const STATUS_STYLES: Record<string, string> = {
  "Draft": "bg-paper text-graphite border border-hairline",
  "Submitted for Review": "bg-teal/10 text-teal",
  "Needs Documents": "bg-warning/15 text-warning",
  "Needs Applicant Clarification": "bg-warning/15 text-warning",
  "In Navigator Review": "bg-indigo/10 text-indigo",
  "Ready for Handoff": "bg-teal/15 text-teal font-semibold",
  "Handed Off": "bg-pine-surface text-ink font-semibold",
  "Closed": "bg-paper text-muted border border-hairline",
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap ${STATUS_STYLES[status] ?? STATUS_STYLES["Draft"]}`}
    >
      {status}
    </span>
  );
}
