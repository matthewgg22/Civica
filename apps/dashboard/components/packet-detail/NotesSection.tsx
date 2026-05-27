import React from "react";
import { getNotes } from "../../lib/packet-fetchers";
import NotesList from "../NotesList";

export function NotesSkeleton() {
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6 space-y-3 animate-pulse">
      <div className="h-3 w-32 bg-paper rounded" />
      <div className="space-y-2 mt-4">
        {[80, 60, 72].map((w, i) => (
          <div key={i} className={`h-4 bg-paper rounded`} style={{ width: `${w}%` }} />
        ))}
      </div>
    </section>
  );
}

export default async function NotesSection({ packetId }: { packetId: string }) {
  const notes = await getNotes(packetId);
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="mb-5">
        <div className="flex items-baseline gap-2">
          <h2 className="section-title">Navigator Notes</h2>
          <span className="text-[12px] text-muted tabular-nums">({notes.length})</span>
        </div>
        <p className="section-sub mt-1 leading-snug">
          Internal notes for your team. Mark internal-only to hide from the applicant.
        </p>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <NotesList packetId={packetId} initialNotes={notes as any} />
    </section>
  );
}
