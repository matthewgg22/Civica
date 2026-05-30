import type { OutreachEntity } from "../../lib/demo-outreach-entities";
import { ENTITY_TYPE_LABEL } from "../../lib/demo-outreach-entities";

/**
 * Pending-approval queue. Sits above the main entity table so the operator
 * sees who needs vetting before browsing live attribution.
 *
 * Each row shows entity name, type, county focus, contact, notes, and
 * Approve / Reject action chips. Demo wires the chips as styled spans
 * (no click handlers); real implementation would POST to an approval
 * endpoint and refresh the row out.
 */
export default function PendingApprovalQueue({ entities }: { entities: OutreachEntity[] }) {
  if (entities.length === 0) return null;

  return (
    <section className="bg-surface border border-warning/30 rounded-[4px] p-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1 text-warning">Pending approval · {entities.length}</p>
          <h2 className="text-[18px] font-bold tracking-tight text-ink">Entities awaiting operator review</h2>
          <p className="text-[12px] text-graphite mt-1">
            New CBOs, employees, and partners must be approved before they can attribute enrollments.
            Review references, BCP/W-9, and MOU countersign before approving.
          </p>
        </div>
        <button
          type="button"
          className="text-[12px] font-semibold px-3 py-1.5 rounded-[3px] border border-ink/30 text-ink hover:border-ink/60 transition-colors whitespace-nowrap"
        >
          + Add new entity
        </button>
      </div>

      <ul className="divide-y divide-hairline border-y border-hairline">
        {entities.map((e) => (
          <li key={e.entity_id} className="py-3 grid grid-cols-[2fr_1fr_1.5fr_auto] items-center gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-semibold text-ink leading-snug">{e.name}</p>
                <EntityTypePill type={e.type} />
              </div>
              <p className="text-[11px] text-graphite mt-1">
                {e.county_focus ? `${e.county_focus} County · ` : "Statewide · "}
                {e.contact_name} · <span className="font-mono">{e.contact_email}</span>
              </p>
            </div>
            <div className="text-[11px] text-graphite">
              <p className="font-mono uppercase tracking-wider text-graphite text-[10px]">Submitted</p>
              <p className="mt-0.5">{formatRelative(e.notes ? extractAppDate(e.notes) : null)}</p>
            </div>
            <div className="text-[11px] text-graphite italic">
              {e.notes ?? "—"}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="text-[11px] font-semibold px-3 py-1.5 rounded-[3px] border border-pine/40 text-pine hover:border-pine hover:bg-pine/5 transition-colors whitespace-nowrap"
              >
                Approve
              </button>
              <button
                type="button"
                className="text-[11px] font-semibold px-3 py-1.5 rounded-[3px] border border-hairline text-graphite hover:text-warning hover:border-warning/40 transition-colors whitespace-nowrap"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EntityTypePill({ type }: { type: OutreachEntity["type"] }) {
  return (
    <span className="inline-flex items-center text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] bg-paper text-graphite border border-hairline whitespace-nowrap">
      {ENTITY_TYPE_LABEL[type]}
    </span>
  );
}

// Extract "Application YYYY-MM-DD" from the notes blob if present; otherwise null.
function extractAppDate(notes: string): string | null {
  const m = notes.match(/Application (\d{4}-\d{2}-\d{2})/);
  return m ? m[1] ?? null : null;
}

function formatRelative(date: string | null): string {
  if (!date) return "—";
  const ts = new Date(date).getTime();
  const ageDays = Math.floor((Date.now() - ts) / 86_400_000);
  if (ageDays < 1) return "today";
  if (ageDays === 1) return "1d ago";
  if (ageDays < 7) return `${ageDays}d ago`;
  if (ageDays < 30) return `${Math.floor(ageDays / 7)}w ago`;
  return new Date(date).toLocaleDateString();
}
