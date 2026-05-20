const STATUS_STYLES: Record<string, string> = {
  "Draft": "bg-paper text-graphite border border-hairline",
  "Submitted for Review": "bg-teal/10 text-teal",
  "Needs Documents": "bg-amber/15 text-amber",
  "Needs Applicant Clarification": "bg-amber/15 text-amber",
  "In Navigator Review": "bg-indigo/10 text-indigo",
  "Ready for Handoff": "bg-teal/15 text-teal font-semibold",
  "Handed Off": "bg-pine text-white",
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
