import {
  bannedPhrases,
  pendingCopyRevisions,
} from "@civica/snap-compliance-copy";

// Proof-of-life: renders one banned phrase + one pending revision from the
// @civica/snap-compliance-copy package. Real integration into the state-
// facing audit surface will replace this in T5 (per the T6 task spec).
// Gated by ?devtools=1 on the packet detail page.
export default function ComplianceNarrative() {
  const banned = bannedPhrases[0];
  const revision = pendingCopyRevisions[0];

  return (
    <div className="space-y-4 text-[13px]">
      {banned ? (
        <div className="rounded border border-hairline bg-surface p-3">
          <div className="text-[11px] uppercase tracking-wider text-graphite">
            Banned phrase · {banned.audit_reference}
          </div>
          <div className="mt-1 font-semibold text-ink">"{banned.phrase}"</div>
          <p className="mt-1 text-muted">{banned.rationale}</p>
        </div>
      ) : null}

      {revision ? (
        <div className="rounded border border-hairline bg-surface p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-graphite">
              Pending revision · {revision.audit_reference}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                revision.status === "approved"
                  ? "bg-teal/15 text-teal"
                  : "bg-amber/15 text-amber"
              }`}
            >
              {revision.status === "approved" ? "Approved" : "Pending signoff"}
            </span>
          </div>
          <div className="mt-2">
            <div className="text-[11px] text-graphite">Current (EN)</div>
            <div className="font-mono text-[12px]">{revision.current_english}</div>
          </div>
          {revision.approved_english ? (
            <div className="mt-2">
              <div className="text-[11px] text-graphite">Proposed (EN)</div>
              <div className="font-mono text-[12px]">{revision.approved_english}</div>
            </div>
          ) : null}
          <p className="mt-2 text-muted">{revision.rationale}</p>
        </div>
      ) : null}
    </div>
  );
}
