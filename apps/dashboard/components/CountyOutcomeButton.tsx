"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Outcome = "approved" | "denied" | "pending_decision";

export default function CountyOutcomeButton({
  packetId,
  currentOutcome,
}: {
  packetId: string;
  currentOutcome: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (!outcome) return;
    setSaving(true);
    try {
      await fetch("/api/packets/county-outcome", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packet_id: packetId, county_outcome: outcome }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const displayLabel = currentOutcome
    ? currentOutcome === "approved" ? "County: Approved"
    : currentOutcome === "denied" ? "County: Denied"
    : "County: Pending"
    : "Record county decision";

  const displayColor = currentOutcome === "approved"
    ? "text-teal border-teal bg-teal/10"
    : currentOutcome === "denied"
    ? "text-brick border-brick bg-brick/10"
    : "text-graphite border-hairline";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`text-[12px] font-semibold border rounded px-2.5 py-1 transition-colors ${displayColor}`}
      >
        {displayLabel}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20" onClick={() => setOpen(false)}>
      <div
        className="bg-surface border border-hairline rounded-[4px] p-6 shadow-lg w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-semibold text-ink mb-1">County decision</h3>
        <p className="text-[12px] text-graphite mb-5">
          Record what the county decided. This feeds the QC denial-rate comparison
          against the CDSS statewide CalFresh baseline.
        </p>

        <div className="flex flex-col gap-2">
          <OutcomeChoice
            value="approved"
            label="Approved"
            sub="County issued CalFresh approval"
            selected={outcome === "approved"}
            onSelect={() => setOutcome("approved")}
            color="#C9922A"
          />
          <OutcomeChoice
            value="denied"
            label="Denied"
            sub="County issued denial — record reason in notes"
            selected={outcome === "denied"}
            onSelect={() => setOutcome("denied")}
            color="#9C3A24"
          />
          <OutcomeChoice
            value="pending_decision"
            label="Pending"
            sub="Handed off — county decision not yet received"
            selected={outcome === "pending_decision"}
            onSelect={() => setOutcome("pending_decision")}
            color="#5A544D"
          />
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 py-2 border border-hairline rounded text-[13px] font-semibold text-graphite hover:bg-paper transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!outcome || saving}
            className="flex-1 py-2 bg-ink text-white rounded text-[13px] font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OutcomeChoice({
  label,
  sub,
  selected,
  onSelect,
  color,
}: {
  value: Outcome;
  label: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-4 py-3 rounded border transition-all"
      style={{
        borderColor: selected ? color : "var(--color-hairline)",
        background: selected ? `${color}10` : "transparent",
      }}
    >
      <p className="text-[13px] font-semibold" style={{ color: selected ? color : "var(--color-ink)" }}>
        {label}
      </p>
      <p className="text-[11px] text-graphite mt-0.5">{sub}</p>
    </button>
  );
}
