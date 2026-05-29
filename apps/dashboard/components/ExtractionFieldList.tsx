"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";

interface ExtractionField {
  field_id: string;
  field_key: string;
  field_label: string;
  original_ocr_value: string | null;
  applicant_answer: string | null;
  navigator_confirmed_value: string | null;
  confidence: number;
  needs_review: boolean;
  reviewed_at: string | null;
  review_note: string | null;
}

interface Props {
  fields: ExtractionField[];
}

export default function ExtractionFieldList({ fields }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [localReviewed, setLocalReviewed] = useState<Set<string>>(new Set());

  const pending = fields.filter((f) => f.needs_review && !f.reviewed_at && !localReviewed.has(f.field_id));
  const done = fields.filter((f) => !f.needs_review || f.reviewed_at || localReviewed.has(f.field_id));

  async function saveReview(fieldId: string) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await api.fields.review(session.access_token, fieldId, {
        navigator_confirmed_value: confirmed[fieldId] ?? "",
        review_note: note || undefined,
      });
      setLocalReviewed((s) => new Set(s).add(fieldId));
      setEditing(null);
      setNote("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(f: ExtractionField) {
    setEditing(f.field_id);
    setConfirmed((c) => ({ ...c, [f.field_id]: f.applicant_answer ?? f.original_ocr_value ?? "" }));
    setNote(f.review_note ?? "");
  }

  function confidencePill(conf: number) {
    const pct = Math.round(conf * 100);
    const cls = conf >= 0.85 ? "bg-teal/10 text-teal" : conf >= 0.6 ? "bg-amber/15 text-amber" : "bg-brick/10 text-brick";
    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{pct}%</span>;
  }

  if (fields.length === 0) {
    return (
      <div className="py-3 px-4 bg-paper border border-dashed border-hairline rounded-[4px] flex items-center gap-3">
        <span className="text-muted text-[16px] shrink-0">○</span>
        <p className="text-[13px] text-graphite">
          <span className="font-semibold">No extraction fields</span>
          <span className="text-muted"> · fields appear once documents are processed by OCR</span>
        </p>
      </div>
    );
  }

  return (
    <div>
      {pending.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-amber mb-2">
            Needs review ({pending.length})
          </p>
          {pending.map((f, idx) => (
            <FieldRow
              key={f.field_id}
              f={f}
              idx={idx}
              isFirst={idx === 0}
              editing={editing}
              confirmed={confirmed}
              note={note}
              saving={saving}
              onStartEdit={startEdit}
              onConfirmChange={(id, val) => setConfirmed((c) => ({ ...c, [id]: val }))}
              onNoteChange={setNote}
              onSave={saveReview}
              onCancel={() => setEditing(null)}
              confidencePill={confidencePill}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div>
          {pending.length > 0 && (
            <p className="text-[11px] uppercase tracking-wider font-semibold text-graphite mb-2 mt-5">
              Reviewed ({done.length})
            </p>
          )}
          {done.map((f, idx) => (
            <FieldRow
              key={f.field_id}
              f={f}
              idx={idx}
              isFirst={idx === 0}
              editing={editing}
              confirmed={confirmed}
              note={note}
              saving={saving}
              onStartEdit={startEdit}
              onConfirmChange={(id, val) => setConfirmed((c) => ({ ...c, [id]: val }))}
              onNoteChange={setNote}
              onSave={saveReview}
              onCancel={() => setEditing(null)}
              confidencePill={confidencePill}
              reviewed={localReviewed.has(f.field_id) || !!f.reviewed_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FieldRowProps {
  f: ExtractionField;
  idx: number;
  isFirst: boolean;
  editing: string | null;
  confirmed: Record<string, string>;
  note: string;
  saving: boolean;
  reviewed?: boolean;
  onStartEdit: (f: ExtractionField) => void;
  onConfirmChange: (id: string, val: string) => void;
  onNoteChange: (val: string) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  confidencePill: (conf: number) => React.ReactNode;
}

function FieldRow({ f, idx, isFirst, editing, confirmed, note, saving, reviewed, onStartEdit, onConfirmChange, onNoteChange, onSave, onCancel, confidencePill }: FieldRowProps) {
  return (
    <div className={`py-4 ${!isFirst || idx > 0 ? "border-t border-hairline" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-medium text-graphite">{f.field_label}</p>
        <div className="flex items-center gap-2">
          {confidencePill(f.confidence)}
          {reviewed && (
            <span className="text-[11px] font-semibold text-teal">✓ reviewed</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-[15px] mb-3">
        <div>
          <p className="eyebrow mb-1">OCR value</p>
          <p className="text-ink">{f.original_ocr_value ?? "—"}</p>
        </div>
        <div>
          <p className="eyebrow mb-1">Applicant correction</p>
          <p className="text-ink">{f.applicant_answer ?? <span className="text-muted italic">none</span>}</p>
        </div>
        <div>
          <p className="eyebrow mb-1">Confirmed</p>
          {reviewed ? (
            <p className="text-pine font-semibold">
              {confirmed[f.field_id] ?? f.navigator_confirmed_value ?? "—"}
            </p>
          ) : (
            <p className="text-muted italic">pending</p>
          )}
        </div>
      </div>

      {editing === f.field_id ? (
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            placeholder="Confirmed value"
            value={confirmed[f.field_id] ?? ""}
            onChange={(e) => onConfirmChange(f.field_id, e.target.value)}
            className="flex-1 border border-hairline rounded-[3px] px-3 py-1.5 text-[13px] focus:outline-none focus:border-pine"
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            className="flex-1 border border-hairline rounded-[3px] px-3 py-1.5 text-[13px] focus:outline-none focus:border-pine"
          />
          <button
            onClick={() => onSave(f.field_id)}
            disabled={saving}
            className="px-4 py-1.5 text-[13px] font-medium bg-pine text-white rounded-[3px] hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "…" : "Confirm"}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-[13px] border border-hairline rounded-[3px] hover:bg-paper"
          >
            Cancel
          </button>
        </div>
      ) : (
        !reviewed && (
          <button
            onClick={() => onStartEdit(f)}
            className="text-[13px] font-medium text-pine hover:underline"
          >
            Review →
          </button>
        )
      )}
    </div>
  );
}
