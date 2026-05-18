"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";

export interface Blocker {
  kind: "unresolved_docs" | "unreviewed_fields" | "missing_consent";
  label: string;
  count?: number;
}

interface Props {
  packetId: string;
  nextStatuses: readonly string[];
  blockers?: Blocker[];
}

const BLOCKED_STATUS = "Ready for Handoff";

export default function StatusTransition({ packetId, nextStatuses, blockers = [] }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function transition(status: string) {
    setLoading(status);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      await api.packets.update(session.access_token, packetId, { status }, reason || undefined);
      toast.success(`Packet advanced to ${status}`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update status";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {blockers.length > 0 && nextStatuses.includes(BLOCKED_STATUS) && (
        <div className="rounded-[3px] border border-amber/40 bg-amber/8 px-4 py-3 space-y-2">
          <p className="text-[13px] font-semibold text-amber">
            Cannot advance to &ldquo;Ready for Handoff&rdquo; — resolve the following first:
          </p>
          <ul className="space-y-1">
            {blockers.map((b) => (
              <li key={b.kind} className="flex items-center gap-2 text-[13px] text-graphite">
                <span className="text-amber shrink-0">▸</span>
                {b.label}
                {b.count !== undefined && b.count > 0 && (
                  <span className="font-semibold text-ink">({b.count})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <input
          type="text"
          placeholder="Why are you moving this packet?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-hairline rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-teal focus:bg-white transition-colors"
        />
        <p className="text-[11px] text-muted mt-1.5 italic">↳ This message will appear in the packet's audit trail for compliance review.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => {
          const isBlocked = status === BLOCKED_STATUS && blockers.length > 0;
          return (
            <button
              key={status}
              onClick={() => transition(status)}
              disabled={loading !== null || isBlocked}
              title={isBlocked ? "Resolve all blockers before advancing to Ready for Handoff" : undefined}
              className="px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-teal text-white hover:bg-teal/90 disabled:bg-graphite/20 disabled:text-graphite disabled:cursor-not-allowed transition-colors"
            >
              {loading === status ? "Moving…" : `→ ${status}`}
            </button>
          );
        })}
      </div>

      {error && <p className="text-[13px] text-error">{error}</p>}
    </div>
  );
}
