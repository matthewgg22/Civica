"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";
import { loadRules } from "@civica/snap-rules";

interface DocItem {
  item_id: string;
  document_kind: string;
  label: string;
  is_required: boolean;
  resolved_at: string | null;
  resolved_document_id: string | null;
  waived_at: string | null;
  waive_reason: string | null;
}

interface UploadedDoc {
  document_id: string;
  document_kind: string | null;
  original_filename: string | null;
}

interface Props {
  packetId: string;
  stateCode: "CA" | "MA";
  items: DocItem[];
  uploadedDocs: UploadedDoc[];
}

export default function DocumentChecklist({ packetId: _packetId, stateCode, items, uploadedDocs }: Props) {
  const router = useRouter();
  const [waiving, setWaiving] = useState<string | null>(null);

  const kindLabels = useMemo<Record<string, string>>(() => {
    try {
      const rules = loadRules(stateCode);
      return Object.fromEntries(rules.document_requirements.map((r) => [r.document_kind, r.label_en]));
    } catch {
      return {};
    }
  }, [stateCode]);
  const [waiveReason, setWaiveReason] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function resolve(itemId: string) {
    setLoading(itemId);
    setErrors((e) => ({ ...e, [itemId]: "" }));
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await api.documentItems.resolve(session.access_token, itemId, {
        resolved_document_id: selectedDocId[itemId] || undefined,
      });
      setResolving(null);
      router.refresh();
    } catch (e) {
      setErrors((prev) => ({ ...prev, [itemId]: e instanceof Error ? e.message : "Failed" }));
    } finally {
      setLoading(null);
    }
  }

  async function waive(itemId: string) {
    if (!waiveReason.trim()) return;
    setLoading(itemId);
    setErrors((e) => ({ ...e, [itemId]: "" }));
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await api.documentItems.waive(session.access_token, itemId, { waive_reason: waiveReason });
      setWaiving(null);
      setWaiveReason("");
      router.refresh();
    } catch (e) {
      setErrors((prev) => ({ ...prev, [itemId]: e instanceof Error ? e.message : "Failed" }));
    } finally {
      setLoading(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-3 px-4 bg-paper border border-dashed border-hairline rounded-[4px] flex items-center gap-3">
        <span className="text-muted text-[16px] shrink-0">○</span>
        <p className="text-[13px] text-graphite">
          <span className="font-semibold">No required documents configured</span>
          <span className="text-muted"> · items are seeded when a packet moves to &ldquo;Needs Documents&rdquo;</span>
        </p>
      </div>
    );
  }

  const pending = items.filter((i) => !i.resolved_at && !i.waived_at);
  const cleared = items.filter((i) => i.resolved_at || i.waived_at);

  return (
    <div>
      {pending.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-amber mb-2">
            Outstanding ({pending.length})
          </p>
          {pending.map((item, idx) => (
            <ItemRow
              key={item.item_id}
              item={item}
              isFirst={idx === 0}
              kindLabel={kindLabels[item.document_kind] ?? item.document_kind}
              uploadedDocs={uploadedDocs}
              resolving={resolving}
              waiving={waiving}
              waiveReason={waiveReason}
              selectedDocId={selectedDocId}
              loading={loading}
              error={errors[item.item_id]}
              onStartResolve={(id) => { setResolving(id); setWaiving(null); }}
              onStartWaive={(id) => { setWaiving(id); setResolving(null); setWaiveReason(""); }}
              onSelectDoc={(id, docId) => setSelectedDocId((s) => ({ ...s, [id]: docId }))}
              onWaiveReasonChange={setWaiveReason}
              onResolve={resolve}
              onWaive={waive}
              onCancel={() => { setResolving(null); setWaiving(null); setWaiveReason(""); }}
            />
          ))}
        </div>
      )}

      {cleared.length > 0 && (
        <div>
          {pending.length > 0 && (
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted mb-2 mt-5">
              Cleared ({cleared.length})
            </p>
          )}
          {cleared.map((item, idx) => (
            <div key={item.item_id} className={`py-3 flex items-start justify-between gap-3 ${idx > 0 || pending.length > 0 ? "border-t border-hairline" : ""}`}>
              <div>
                <p className="text-[14px] font-medium text-ink">{item.label}</p>
                <p className="text-[12px] text-muted">{kindLabels[item.document_kind] ?? item.document_kind}</p>
              </div>
              {item.resolved_at ? (
                <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal/10 text-teal">✓ resolved</span>
              ) : (
                <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-graphite/10 text-graphite" title={item.waive_reason ?? ""}>
                  waived
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ItemRowProps {
  item: DocItem;
  isFirst: boolean;
  kindLabel: string;
  uploadedDocs: UploadedDoc[];
  resolving: string | null;
  waiving: string | null;
  waiveReason: string;
  selectedDocId: Record<string, string>;
  loading: string | null;
  error?: string;
  onStartResolve: (id: string) => void;
  onStartWaive: (id: string) => void;
  onSelectDoc: (itemId: string, docId: string) => void;
  onWaiveReasonChange: (val: string) => void;
  onResolve: (id: string) => void;
  onWaive: (id: string) => void;
  onCancel: () => void;
}

function ItemRow({ item, isFirst, kindLabel, uploadedDocs, resolving, waiving, waiveReason, selectedDocId, loading, error, onStartResolve, onStartWaive, onSelectDoc, onWaiveReasonChange, onResolve, onWaive, onCancel }: ItemRowProps) {
  const matchingDocs = uploadedDocs.filter((d) => d.document_kind === item.document_kind);
  const isResolving = resolving === item.item_id;
  const isWaiving = waiving === item.item_id;
  const isLoading = loading === item.item_id;

  return (
    <div className={`py-4 ${!isFirst ? "border-t border-hairline" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-[14px] font-medium text-ink">{item.label}</p>
          <p className="text-[12px] text-muted">{kindLabel}</p>
        </div>
        {!isResolving && !isWaiving && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onStartResolve(item.item_id)}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-[3px] bg-teal text-white hover:bg-teal/90 transition-colors"
            >
              Mark resolved
            </button>
            <button
              onClick={() => onStartWaive(item.item_id)}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-[3px] border border-hairline text-graphite hover:bg-paper transition-colors"
            >
              Waive
            </button>
          </div>
        )}
      </div>

      {isResolving && (
        <div className="mt-2 space-y-2">
          {matchingDocs.length > 0 && (
            <div>
              <label className="text-[12px] font-semibold text-muted uppercase tracking-wider block mb-1">
                Link to uploaded document (optional)
              </label>
              <select
                value={selectedDocId[item.item_id] ?? ""}
                onChange={(e) => onSelectDoc(item.item_id, e.target.value)}
                className="w-full border border-hairline rounded-[3px] px-3 py-2 text-[13px] bg-paper focus:outline-none focus:border-teal"
              >
                <option value="">(no specific document)</option>
                {matchingDocs.map((d) => (
                  <option key={d.document_id} value={d.document_id}>
                    {d.original_filename ?? d.document_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onResolve(item.item_id)}
              disabled={isLoading}
              className="px-4 py-1.5 text-[13px] font-semibold bg-teal text-white rounded-[3px] hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "Saving…" : "Confirm resolved"}
            </button>
            <button onClick={onCancel} className="px-4 py-1.5 text-[13px] border border-hairline rounded-[3px] hover:bg-paper">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isWaiving && (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            placeholder="Reason for waiver (required)"
            value={waiveReason}
            onChange={(e) => onWaiveReasonChange(e.target.value)}
            className="w-full border border-hairline rounded-[3px] px-3 py-2 text-[13px] bg-paper focus:outline-none focus:border-amber"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onWaive(item.item_id)}
              disabled={isLoading || !waiveReason.trim()}
              className="px-4 py-1.5 text-[13px] font-semibold bg-amber text-white rounded-[3px] hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "Saving…" : "Confirm waiver"}
            </button>
            <button onClick={onCancel} className="px-4 py-1.5 text-[13px] border border-hairline rounded-[3px] hover:bg-paper">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-error mt-1">{error}</p>}
    </div>
  );
}
