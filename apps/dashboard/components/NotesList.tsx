"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";

interface Note {
  note_id: string;
  body_ciphertext: string;
  is_internal: boolean;
  created_at: string;
  author_staff_id: string;
}

export default function NotesList({ packetId, initialNotes }: { packetId: string; initialNotes: Note[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [saving, setSaving] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const note = await api.notes.create(session.access_token, packetId, {
        body_ciphertext: body,
        is_internal: isInternal,
      });
      setNotes((n) => [note, ...n]);
      setBody("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={addNote} className="space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          className="w-full border border-hairline rounded-[3px] px-3 py-2 text-[15px] bg-paper focus:outline-none focus:border-teal focus:bg-white resize-none transition-colors"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[13px] text-graphite cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="accent-teal w-4 h-4"
            />
            Internal only (not visible to applicant)
          </label>
          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="px-5 py-2 text-[13px] font-semibold bg-teal text-white rounded-[3px] hover:bg-teal/90 disabled:bg-graphite/20 disabled:text-graphite disabled:cursor-not-allowed transition-all"
          >
            {saving ? "Saving…" : "Add Note"}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-[13px] text-muted">No notes yet</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.note_id} className="text-[15px] border-l-2 border-teal pl-4 py-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] text-muted tabular-nums">{new Date(note.created_at).toLocaleString()}</span>
                {note.is_internal && (
                  <span className="text-[10px] bg-amber/15 text-amber px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">internal</span>
                )}
              </div>
              <p className="text-ink">{note.body_ciphertext}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
