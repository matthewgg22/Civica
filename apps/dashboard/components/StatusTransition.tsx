"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";

interface Props {
  packetId: string;
  nextStatuses: string[];
}

export default function StatusTransition({ packetId, nextStatuses }: Props) {
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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
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
        {nextStatuses.map((status) => (
          <button
            key={status}
            onClick={() => transition(status)}
            disabled={loading !== null}
            className="px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-teal text-white hover:bg-teal/90 disabled:bg-graphite/20 disabled:text-graphite disabled:cursor-not-allowed transition-colors"
          >
            {loading === status ? "Moving…" : `→ ${status}`}
          </button>
        ))}
      </div>
      {error && <p className="text-[13px] text-error">{error}</p>}
    </div>
  );
}
