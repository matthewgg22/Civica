/**
 * StatusBadge — small circular badge with status-specific background
 * color and unicode glyph. Used in the navigator queue (/packets) and
 * the CBO sample queue (/cbo-preview).
 *
 * A11y: role="img" + aria-label so screen readers announce the status
 * string ("Needs Documents") instead of the glyph's character name
 * ("exclamation mark"). Glyph wrapped in aria-hidden so it isn't
 * read literally.
 *
 * Status color tokens map to DESIGN.md §2.2:
 *   teal     — positive milestone (submitted, ready)
 *   warning  — needs attention (needs docs, needs clarification)
 *   indigo   — in-progress info accent
 *   pine     — terminal positive (handed off)
 *   graphite — neutral (draft, closed)
 */

const STATUS_BADGE: Record<string, { bg: string; icon: string }> = {
  "Draft":                          { bg: "bg-graphite", icon: "✎" },
  "Submitted for Review":           { bg: "bg-teal",     icon: "↑" },
  "Needs Documents":                { bg: "bg-warning",  icon: "!" },
  "Needs Applicant Clarification":  { bg: "bg-warning",  icon: "?" },
  "In Navigator Review":            { bg: "bg-indigo",   icon: "◉" },
  "Ready for Handoff":              { bg: "bg-teal",     icon: "✓" },
  "Handed Off":                     { bg: "bg-pine",     icon: "→" },
  "Closed":                         { bg: "bg-graphite", icon: "•" },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE["Draft"];
  return (
    <div
      role="img"
      aria-label={`Status: ${status}`}
      title={status}
      className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center text-white text-[15px] font-semibold shrink-0`}
    >
      <span aria-hidden="true">{cfg.icon}</span>
    </div>
  );
}
