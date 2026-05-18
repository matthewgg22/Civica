"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";

interface RequestRow {
  request_id: string;
  status: "pending" | "uploaded" | "resolved" | "waived";
  sent_at: string;
  resolved_at: string | null;
  requested_by_staff_id: string;
  required_document_items: { item_id: string; label: string; document_kind: string } | null;
}

interface RequiredItem {
  item_id: string;
  label: string;
  document_kind: string;
  resolved_at: string | null;
  waived_at: string | null;
}

interface Props {
  packetId: string;
  unresolvedItems: RequiredItem[];
}

const STATUS_STYLE: Record<RequestRow["status"], string> = {
  pending: "bg-amber/15 text-amber",
  uploaded: "bg-teal/15 text-teal",
  resolved: "bg-graphite/10 text-graphite",
  waived: "bg-graphite/5 text-muted line-through",
};

export default function MissingItemRequestPanel({ packetId, unresolvedItems }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const rows = await api.missingItems.list(session.access_token, packetId);
        if (!cancelled) setRequests(rows as RequestRow[]);
      } catch {
        if (!cancelled) setRequests([]);
      }
    })();
    return () => { cancelled = true; };
  }, [packetId]);

  async function sendRequest() {
    if (!selectedItemId && !note.trim()) {
      setError("Pick a checklist item or enter a custom note.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      await api.missingItems.create(session.access_token, packetId, {
        required_item_id: selectedItemId || undefined,
        message_ciphertext: note.trim() || undefined,
        bump_packet_status: true,
      });
      setSelectedItemId("");
      setNote("");
      const rows = await api.missingItems.list(session.access_token, packetId);
      setRequests(rows as RequestRow[]);
      toast.success("Request sent to applicant");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send request";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function cancelRequest(requestId: string) {
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      await api.missingItems.cancel(session.access_token, requestId);
      const rows = await api.missingItems.list(session.access_token, packetId);
      setRequests(rows as RequestRow[]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel");
    }
  }

  async function resolveRequest(requestId: string) {
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      await api.missingItems.resolve(session.access_token, requestId);
      const rows = await api.missingItems.list(session.access_token, packetId);
      setRequests(rows as RequestRow[]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resolve");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-graphite italic leading-snug">
        Send a structured request to the applicant when a document is missing or needs to be clearer.
        Sending a request will move this packet to <span className="font-semibold">Needs Documents</span>.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
        <div className="space-y-2">
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full border border-hairline rounded-[3px] px-3 py-2 text-[14px] bg-paper focus:outline-none focus:border-teal focus:bg-white"
          >
            <option value="">— Custom (no checklist item)</option>
            {unresolvedItems.map((it) => (
              <option key={it.item_id} value={it.item_id}>
                {it.label}
              </option>
            ))}
          </select>
          <textarea
            placeholder='Plain-language note to the applicant. Example: "We still need proof of rent. A lease, rent receipt, or landlord letter works."'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full border border-hairline rounded-[3px] px-3 py-2 text-[14px] bg-paper focus:outline-none focus:border-teal focus:bg-white"
          />
          <p className="text-[11px] text-muted italic">
            Do not use threatening language. Do not imply the applicant will lose benefits.
          </p>
        </div>
        <button
          type="button"
          onClick={sendRequest}
          disabled={loading}
          className="px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-teal text-white hover:bg-teal/90 disabled:bg-graphite/20 disabled:cursor-not-allowed"
        >
          {loading ? "Sending…" : "Send request"}
        </button>
      </div>
      {error && <p className="text-[13px] text-error">{error}</p>}

      <div>
        <h3 className="text-[12px] uppercase tracking-wider font-semibold text-muted mb-2">
          Open requests {requests && `(${requests.length})`}
        </h3>
        {requests === null ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-[13px] text-muted italic">No requests sent yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {requests.map((r) => {
              const docItem = r.required_document_items;
              return (
                <li key={r.request_id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] text-ink">
                      {docItem?.label ?? "Custom request"}
                    </p>
                    <p className="text-[12px] text-muted mt-0.5">
                      Sent {formatDateTime(r.sent_at)}
                      {r.resolved_at && <> · resolved {formatDateTime(r.resolved_at)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                    {r.status === "uploaded" && (
                      <button
                        type="button"
                        onClick={() => resolveRequest(r.request_id)}
                        className="text-[12px] font-semibold text-teal hover:underline"
                      >
                        Mark resolved
                      </button>
                    )}
                    {r.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => cancelRequest(r.request_id)}
                        className="text-[12px] text-muted hover:text-error"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
