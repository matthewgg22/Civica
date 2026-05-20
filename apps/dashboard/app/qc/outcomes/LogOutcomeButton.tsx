"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ERROR_TYPES = [
  { value: "income_mismatch",   label: "Income mismatch" },
  { value: "sua_overclaim",     label: "SUA overclaim" },
  { value: "address_invalid",   label: "Address invalid" },
  { value: "missing_doc",       label: "Missing document" },
  { value: "heap_sua_conflict", label: "HEAP/SUA conflict" },
  { value: "other",             label: "Other" },
];

export function LogOutcomeButton({ packetId }: { packetId: string }) {
  const [open, setOpen] = useState(false);
  const [errorFound, setErrorFound] = useState<boolean | null>(null);
  const [errorType, setErrorType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (errorFound === null) return;
    setSaving(true);
    try {
      await fetch("/api/qc/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packet_id: packetId,
          error_found: errorFound,
          error_type: errorFound && errorType ? errorType : null,
          notes: notes.trim() || null,
        }),
      });
      setOpen(false);
      setErrorFound(null);
      setErrorType("");
      setNotes("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[12px] font-semibold text-muted hover:text-ink border border-hairline rounded px-2.5 py-1 transition-colors"
      >
        Log QC
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20" onClick={() => setOpen(false)}>
      <div
        className="bg-surface border border-hairline rounded-[4px] p-6 shadow-lg w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-semibold text-ink mb-4">Log QC Outcome</h3>

        <div className="space-y-4">
          <div>
            <p className="text-[12px] uppercase tracking-wider font-semibold text-muted mb-2">Error found?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setErrorFound(false)}
                className={`flex-1 py-2 rounded border text-[13px] font-semibold transition-colors ${
                  errorFound === false
                    ? "bg-teal/10 border-teal text-teal"
                    : "border-hairline text-graphite hover:border-graphite"
                }`}
              >
                No error
              </button>
              <button
                onClick={() => setErrorFound(true)}
                className={`flex-1 py-2 rounded border text-[13px] font-semibold transition-colors ${
                  errorFound === true
                    ? "bg-brick/10 border-brick text-brick"
                    : "border-hairline text-graphite hover:border-graphite"
                }`}
              >
                Error found
              </button>
            </div>
          </div>

          {errorFound === true && (
            <div>
              <label className="text-[12px] uppercase tracking-wider font-semibold text-muted block mb-1.5">
                Error type
              </label>
              <select
                value={errorType}
                onChange={(e) => setErrorType(e.target.value)}
                className="w-full border border-hairline rounded px-3 py-2 text-[13px] text-ink bg-paper"
              >
                <option value="">Select type…</option>
                {ERROR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[12px] uppercase tracking-wider font-semibold text-muted block mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any context for this outcome…"
              className="w-full border border-hairline rounded px-3 py-2 text-[13px] text-ink bg-paper resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 py-2 border border-hairline rounded text-[13px] font-semibold text-graphite hover:bg-paper transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={errorFound === null || saving}
            className="flex-1 py-2 bg-pine text-white rounded text-[13px] font-semibold hover:bg-pine/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save outcome"}
          </button>
        </div>
      </div>
    </div>
  );
}
