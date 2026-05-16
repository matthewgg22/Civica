"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase";
import { timeAgo, shortId } from "../lib/format";

type Activity = {
  id: string;
  kind: "transition" | "doc" | "note";
  text: string;
  detail?: string;
  at: string;
  packetId?: string;
};

export default function ActivityTicker({ initial }: { initial: Activity[] }) {
  const [items, setItems] = useState<Activity[]>(initial);

  // Re-sync items when the server pushes a new initial set (page refresh /
  // RSC reload). Without this, useState only reads `initial` on first mount,
  // so slice / order changes server-side don't take effect.
  const initialKey = initial.map((i) => i.id).join("|");
  useEffect(() => {
    setItems(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-activity")
      .on("postgres_changes",
        { event: "INSERT", schema: "snap_enrollment", table: "packet_status_history" },
        (payload) => {
          const row = payload.new as { history_id: string; to_status: string; from_status: string | null; occurred_at: string; packet_id: string };
          setItems((prev) => [{
            id: row.history_id,
            kind: "transition" as const,
            text: `Packet ${shortId(row.packet_id)} → ${row.to_status}`,
            detail: row.from_status ? `from ${row.from_status}` : "new draft",
            at: row.occurred_at,
            packetId: row.packet_id,
          }, ...prev].slice(0, 10));
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "snap_enrollment", table: "uploaded_documents" },
        (payload) => {
          const row = payload.new as { document_id: string; document_kind: string; uploaded_at: string; packet_id: string };
          setItems((prev) => [{
            id: row.document_id,
            kind: "doc" as const,
            text: `${row.document_kind.replace(/_/g, " ")} uploaded`,
            detail: `packet ${shortId(row.packet_id)}`,
            at: row.uploaded_at,
            packetId: row.packet_id,
          }, ...prev].slice(0, 10));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (items.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-[13px] text-muted">Waiting for activity…</p>
        <p className="text-[11px] text-muted mt-1">Live updates appear in real time</p>
      </div>
    );
  }

  return (
    <ol className="space-y-1">
      {items.map((item) => {
        const body = (
          <div className="flex items-start gap-3 py-1 px-2 -mx-2 rounded-[3px] hover:bg-paper transition-colors">
            <Dot kind={item.kind} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-ink leading-tight">{item.text}</p>
              {item.detail && <p className="text-[12px] text-graphite mt-0.5 leading-tight">{item.detail}</p>}
            </div>
            <span className="text-[12px] text-graphite tabular-nums shrink-0 pt-0.5 font-medium">{timeAgo(item.at)}</span>
          </div>
        );
        return (
          <li key={item.id}>
            {item.packetId ? (
              <a
                href={`/packets/${item.packetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
                aria-label="Open packet detail in new tab"
              >
                {body}
              </a>
            ) : body}
          </li>
        );
      })}
    </ol>
  );
}

function Dot({ kind }: { kind: Activity["kind"] }) {
  // Color-coded so caseworkers can visually scan event types at a glance.
  // indigo = status change, teal = doc upload, amber = note added.
  const color = kind === "doc" ? "bg-teal" : kind === "note" ? "bg-amber" : "bg-indigo";
  return (
    <div className="relative mt-1.5 shrink-0" title={kind === "doc" ? "Document upload" : kind === "note" ? "Navigator note" : "Status change"}>
      <span className={`block w-2.5 h-2.5 rounded-full ${color}`} />
      <span className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${color} animate-ping opacity-40`} />
    </div>
  );
}
