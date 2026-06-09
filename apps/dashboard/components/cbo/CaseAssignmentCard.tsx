// CaseAssignmentCard — "who at the CBO owns this case" (navigator/assignment).
// Presentational, prop-only; renders one column inside the print-draft "Case team"
// section. Phase-1 synthetic; Phase-2 real adapter feeds the same CaseAssignment.
import type { CaseAssignment } from "../../lib/cbo/demo-pipeline";

// amber = positive outcome (approved); warning = process/needs-attention (in review).
const STATUS: Record<CaseAssignment["status"], { label: string; cls: string; glyph: string }> = {
  unassigned: { label: "Unassigned", cls: "text-muted", glyph: "○" },
  assigned: { label: "Assigned", cls: "text-graphite", glyph: "●" },
  reviewing: { label: "In review", cls: "text-warning", glyph: "◐" },
  approved: { label: "Approved", cls: "text-amber", glyph: "✓" },
};

export default function CaseAssignmentCard({ assignment }: { assignment: CaseAssignment }) {
  const s = STATUS[assignment.status];
  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-graphite border-b border-hairline pb-1 mb-2">
        Caseworker
      </h2>
      {assignment.status === "unassigned" ? (
        <p className="text-[12px] text-muted">Not yet assigned to a CBO caseworker.</p>
      ) : (
        <p className="text-[13px] text-ink">
          <span className="font-semibold">{assignment.caseworker}</span>
          {assignment.assignedAt && (
            <span className="text-[12px] text-graphite"> · since {assignment.assignedAt}</span>
          )}
        </p>
      )}
      <p className="mt-1.5">
        <span
          role="img"
          aria-label={`Assignment status: ${s.label}`}
          className={`inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider ${s.cls}`}
        >
          <span aria-hidden="true">{s.glyph}</span>
          {s.label}
        </span>
      </p>
    </div>
  );
}
