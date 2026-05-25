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

  // Note: the duplicate blocker list that used to render here has been
  // removed. Blockers are surfaced in the consolidated Review Status card
  // at the top of the packet, so showing them again right above the
  // button was redundant. The "→ Ready for Handoff" button stays disabled
  // with a tooltip when blockers exist.
  const blockerSummary = blockers.length > 0
    ? `${blockers.length} item${blockers.length === 1 ? "" : "s"} unresolved — see Review Status above`
    : null;

  return (
    <div className="space-y-3">
      <div>
        <input
          type="text"
          placeholder="Why are you moving this packet?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-hairline rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white transition-colors"
        />
        <p className="text-[11px] text-muted mt-1.5 italic">↳ This message will appear in the packet's audit trail for compliance review.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {nextStatuses.map((status) => {
          const isBlocked = status === BLOCKED_STATUS && blockers.length > 0;
          return (
            <button
              key={status}
              onClick={() => transition(status)}
              disabled={loading !== null || isBlocked}
              title={isBlocked ? "Resolve all items in Review Status before advancing to Ready for Handoff" : undefined}
              className="px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-pine text-white hover:bg-pine/90 disabled:bg-graphite/20 disabled:text-graphite disabled:cursor-not-allowed transition-colors"
            >
              {loading === status ? "Moving…" : `→ ${status}`}
            </button>
          );
        })}
        {blockerSummary && (
          <span className="text-[12px] text-warning ml-2">{blockerSummary}</span>
        )}
      </div>

      {error && <p className="text-[13px] text-error">{error}</p>}
    </div>
  );
}
