"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShelterAllocation {
  allocation_id: string;
  packet_id: string;
  total_lease_rent_usd: number;
  household_share_pct: number;
  allocated_rent_usd: number;
  allocation_method: AllocationMethod;
  evidence_document_id: string | null;
  navigator_staff_id: string;
  allocated_at: string;
  notes: string | null;
}

type AllocationMethod =
  | "bedroom_split"
  | "equal_split"
  | "dollar_amount"
  | "documented_roommate_agreement";

export interface UploadedDocument {
  document_id: string;
  document_kind: string;
  original_filename: string | null;
  processing_status: string;
}

interface Props {
  packetId: string;
  statedMonthlyRent: number | null;
  existing: ShelterAllocation | null;
  leaseDocs: UploadedDocument[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const METHOD_LABELS: Record<AllocationMethod, string> = {
  bedroom_split: "Bedroom split",
  equal_split: "Equal split (# of tenants)",
  dollar_amount: "Dollar amount (documented)",
  documented_roommate_agreement: "Roommate agreement on file",
};

const METHOD_DESCRIPTIONS: Record<AllocationMethod, string> = {
  bedroom_split: "Allocate based on number of bedrooms each household occupies",
  equal_split: "Divide equally among all named tenants on the lease",
  dollar_amount: "Set a specific dollar amount the household actually pays",
  documented_roommate_agreement: "A signed side agreement documents this household's share",
};

function fmt(usd: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(usd);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShelterAllocationPanel({
  packetId,
  statedMonthlyRent,
  existing,
  leaseDocs,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [editing, setEditing] = useState(!existing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalRent, setTotalRent] = useState(
    existing?.total_lease_rent_usd ?? statedMonthlyRent ?? 0,
  );
  const [allocatedRent, setAllocatedRent] = useState(
    existing?.allocated_rent_usd ?? statedMonthlyRent ?? 0,
  );
  const [method, setMethod] = useState<AllocationMethod>(
    existing?.allocation_method ?? "dollar_amount",
  );
  const [evidenceDocId, setEvidenceDocId] = useState<string>(
    existing?.evidence_document_id ?? "",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const sharePct = totalRent > 0 ? Math.round((allocatedRent / totalRent) * 100) : 0;

  async function handleSave() {
    if (allocatedRent <= 0 || totalRent <= 0) {
      setError("Both rent amounts must be greater than zero.");
      return;
    }
    if (allocatedRent > totalRent) {
      setError("Household allocation cannot exceed total lease rent.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      await api.shelterAllocation.upsert(session.access_token, packetId, {
        total_lease_rent_usd: totalRent,
        allocated_rent_usd: allocatedRent,
        allocation_method: method,
        evidence_document_id: evidenceDocId || null,
        notes: notes || null,
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save allocation");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove this allocation? The shelter cost will revert to unresolved.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await api.shelterAllocation.remove(session.access_token, packetId);
    router.refresh();
  }

  // ── Resolved state ────────────────────────────────────────────────────────
  if (existing && !editing) {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-teal-700 font-semibold text-sm">Rent allocation resolved</span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
              Moderate defensibility
            </span>
            {existing.evidence_document_id && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-200 text-teal-900">
                + agreement on file → Strong
              </span>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-teal-600 underline hover:text-teal-800"
          >
            Edit
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wide">Total lease rent</div>
            <div className="font-semibold">{fmt(existing.total_lease_rent_usd)}/mo</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wide">Household share</div>
            <div className="font-semibold text-teal-700">
              {fmt(existing.allocated_rent_usd)}/mo
              <span className="ml-1 text-gray-400 font-normal">({Math.round(existing.household_share_pct * 100)}%)</span>
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase tracking-wide">Method</div>
            <div className="font-semibold">{METHOD_LABELS[existing.allocation_method]}</div>
          </div>
        </div>

        {existing.notes && (
          <p className="text-xs text-gray-600 border-t border-teal-100 pt-2">{existing.notes}</p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 border-t border-teal-100 pt-2">
          <span>
            Set {new Date(existing.allocated_at).toLocaleDateString()} by navigator
          </span>
          <button
            onClick={handleRemove}
            className="text-red-400 hover:text-red-600 underline"
          >
            Remove allocation
          </button>
        </div>
      </div>
    );
  }

  // ── Edit / create form ────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-amber-700 font-semibold text-sm">
          {existing ? "Edit rent allocation" : "Resolve shared lease — set rent allocation"}
        </span>
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
          Pending · Weak defensibility
        </span>
      </div>

      <p className="text-xs text-amber-800">
        The lease lists more tenants than this household. Set the household's actual share of the
        rent so the shelter deduction is calculated correctly. This navigator decision is logged for
        QC audit.
      </p>

      {/* Method */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Allocation method</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(METHOD_LABELS) as AllocationMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`text-left rounded border p-2 text-xs transition-colors ${
                method === m
                  ? "border-teal-500 bg-teal-50 text-teal-800"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">{METHOD_LABELS[m]}</div>
              <div className="text-gray-500 mt-0.5">{METHOD_DESCRIPTIONS[m]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Rent amounts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Total lease rent ($/mo)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={totalRent || ""}
            onChange={(e) => setTotalRent(parseFloat(e.target.value) || 0)}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="e.g. 2400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            This household pays ($/mo)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={allocatedRent || ""}
            onChange={(e) => setAllocatedRent(parseFloat(e.target.value) || 0)}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="e.g. 1200"
          />
          {totalRent > 0 && allocatedRent > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              = {sharePct}% of total lease
            </p>
          )}
        </div>
      </div>

      {/* Evidence document (optional) */}
      {leaseDocs.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Supporting document <span className="font-normal text-gray-400">(optional — upgrades defensibility)</span>
          </label>
          <select
            value={evidenceDocId}
            onChange={(e) => setEvidenceDocId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="">None</option>
            {leaseDocs.map((doc) => (
              <option key={doc.document_id} value={doc.document_id}>
                {doc.original_filename ?? doc.document_kind} ({doc.processing_status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Navigator notes <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          placeholder="e.g. Confirmed 2 of 3 bedrooms per applicant statement"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-4 py-1.5 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save allocation"}
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-4 py-1.5 rounded border border-gray-300 text-gray-600 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
