"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";
import { decryptDemoName } from "../lib/format";

interface Answer {
  answer_id: string;
  question_key: string;
  question_label: string;
  applicant_answer: string | null;
  original_ocr_value: string | null;
  navigator_confirmed_value: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export default function AnswerReviewList({ answers }: { answers: Answer[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  async function saveReview(answerId: string) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await api.answers.review(session.access_token, answerId, {
        navigator_confirmed_value: confirmed[answerId] ?? "",
        review_note: note || undefined,
      });
      setSaved((s) => new Set(s).add(answerId));
      setEditing(null);
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {answers.map((a, idx) => (
        <div key={a.answer_id} className={`py-4 ${idx > 0 ? "border-t border-hairline" : ""}`}>
          <p className="text-[13px] font-medium text-graphite mb-2">{a.question_label}</p>
          <div className="grid grid-cols-3 gap-4 text-[15px] mb-3">
            <div>
              <p className="eyebrow mb-1">Applicant</p>
              <p className="text-ink">{a.applicant_answer ? decryptDemoName(a.applicant_answer) : "—"}</p>
            </div>
            <div>
              <p className="eyebrow mb-1">OCR</p>
              <p className="text-ink">{a.original_ocr_value ?? "—"}</p>
            </div>
            <div>
              <p className="eyebrow mb-1">Confirmed</p>
              {saved.has(a.answer_id) || a.reviewed_at ? (
                <p className="text-pine font-semibold">
                  {confirmed[a.answer_id] ?? a.navigator_confirmed_value ?? "—"}
                </p>
              ) : (
                <p className="text-muted italic">pending</p>
              )}
            </div>
          </div>

          {editing === a.answer_id ? (
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                placeholder="Confirmed value"
                value={confirmed[a.answer_id] ?? a.applicant_answer ?? ""}
                onChange={(e) => setConfirmed((c) => ({ ...c, [a.answer_id]: e.target.value }))}
                className="flex-1 border border-hairline rounded-[3px] px-3 py-1.5 text-[13px] focus:outline-none focus:border-pine"
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1 border border-hairline rounded-[3px] px-3 py-1.5 text-[13px] focus:outline-none focus:border-pine"
              />
              <button
                onClick={() => saveReview(a.answer_id)}
                disabled={saving}
                className="px-4 py-1.5 text-[13px] font-medium bg-pine text-white rounded-[3px] hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "…" : "Save"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-1.5 text-[13px] border border-hairline rounded-[3px] hover:bg-paper"
              >
                Cancel
              </button>
            </div>
          ) : (
            !saved.has(a.answer_id) && !a.reviewed_at && (
              <button
                onClick={() => {
                  setEditing(a.answer_id);
                  setConfirmed((c) => ({ ...c, [a.answer_id]: a.applicant_answer ?? "" }));
                }}
                className="text-[13px] font-medium text-pine hover:underline"
              >
                Review →
              </button>
            )
          )}
        </div>
      ))}
    </div>
  );
}
