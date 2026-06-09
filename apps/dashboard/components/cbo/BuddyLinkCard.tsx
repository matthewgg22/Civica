// BuddyLinkCard — the applicant's PERSONAL helper (buddy system), distinct from
// the CBO caseworker. Presentational, prop-only; one column in the "Case team"
// section. Phase-1 synthetic; Phase-2 real adapter feeds the same BuddyLink.
import type { BuddyLink } from "../../lib/cbo/demo-pipeline";

const STATUS: Record<BuddyLink["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "text-graphite" },
  pending: { label: "Invite pending", cls: "text-warning" }, // process: not yet accepted
  completed: { label: "Completed", cls: "bg-pine-surface text-ink px-1.5 py-0.5 rounded-[3px]" },
  none: { label: "No helper linked", cls: "text-muted" },
};

export default function BuddyLinkCard({ buddy }: { buddy: BuddyLink }) {
  const s = STATUS[buddy.status];
  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-graphite border-b border-hairline pb-1 mb-2">
        Applicant&rsquo;s helper
      </h2>
      {buddy.status === "none" ? (
        <p className="text-[12px] text-muted">No helper linked — the applicant has not added one yet.</p>
      ) : (
        <>
          <p className="text-[13px] text-ink">
            <span className="font-semibold">{buddy.helperName}</span>
            <span className="text-[12px] text-graphite"> · {buddy.relationship}</span>
            {buddy.lastActive && (
              <span className="text-[12px] text-graphite"> · active {buddy.lastActive}</span>
            )}
          </p>
          <p className="mt-1.5">
            <span
              role="img"
              aria-label={`Helper status: ${s.label}`}
              className={`inline-block text-[12px] font-semibold uppercase tracking-wider ${s.cls}`}
            >
              {s.label}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
