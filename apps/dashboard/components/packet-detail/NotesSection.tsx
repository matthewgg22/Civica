import React from "react";
import { getNotes } from "../../lib/packet-fetchers";
import NotesList from "../NotesList";

/**
 * Chromeless body. Outer card chrome is provided by the wrapping
 * <EvidenceSection> on /packets/[id]. Do not re-add a <section>
 * border/background here without coordinating with that wrapper.
 */
export function NotesSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 w-32 bg-surface rounded" />
      <div className="space-y-2 mt-4">
        {[80, 60, 72].map((w, i) => (
          <div key={i} className="h-4 bg-surface rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

export default async function NotesSection({ packetId }: { packetId: string }) {
  const notes = await getNotes(packetId);
  return (
    <>
      <p className="section-sub leading-snug -mt-1">
        Internal notes for your team. Mark internal-only to hide from the applicant.
      </p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <NotesList packetId={packetId} initialNotes={notes as any} />
    </>
  );
}
