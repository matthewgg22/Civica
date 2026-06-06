"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Latest confirmed value to show: a local edit this session wins, else the
  // persisted navigator value.
  function currentConfirmed(a: Answer): string | null {
    return confirmed[a.answer_id] ?? a.navigator_confirmed_value ?? null;
  }
  function isReviewed(a: Answer): boolean {
    return saved.has(a.answer_id) || !!a.reviewed_at;
  }

  function startEdit(a: Answer) {
    setError(null);
    setEditing(a.answer_id);
    // Pre-fill with the current confirmed value (so corrections start from the
    // last value), falling back to the applicant's answer for a first review.
    setConfirmed((c) => ({
      ...c,
      [a.answer_id]: c[a.answer_id] ?? a.navigator_confirmed_value ?? a.applicant_answer ?? "",
    }));
    setNote(a.review_note ?? "");
  }

  async function saveReview(answerId: string) {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired — sign in again to save.");
        return;
      }
      await api.answers.review(session.access_token, answerId, {
        navigator_confirmed_value: confirmed[answerId] ?? "",
        review_note: note || undefined,
      });
      setSaved((s) => new Set(s).add(answerId));
      setEditing(null);
      setNote("");
      setFlashId(answerId);
      setTimeout(() => setFlashId((f) => (f === answerId ? null : f)), 2500);
      // Reflect the persisted value (reviewed_at / confirmed) from the server.
      router.refresh();
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {answers.map((a, idx) => {
        const reviewed = isReviewed(a);
        return (
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
                {reviewed ? (
                  <p className="text-pine font-semibold">
                    {currentConfirmed(a) ?? "—"}
                    {flashId === a.answer_id && (
                      <span className="ml-2 text-[11px] font-medium text-pine">Saved ✓</span>
                    )}
                  </p>
                ) : (
                  <p className="text-muted italic">pending</p>
                )}
              </div>
            </div>

            {editing === a.answer_id ? (
              <div className="flex flex-wrap gap-2 mt-3">
                <input
                  type="text"
                  placeholder="Confirmed value"
                  aria-label={`Confirmed value for ${a.question_label}`}
                  value={confirmed[a.answer_id] ?? ""}
                  onChange={(e) => setConfirmed((c) => ({ ...c, [a.answer_id]: e.target.value }))}
                  className="flex-1 min-w-[160px] border border-hairline rounded-[3px] px-3 py-1.5 text-[13px] focus:outline-none focus:border-pine"
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  aria-label={`Review note for ${a.question_label}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex-1 min-w-[160px] border border-hairline rounded-[3px] px-3 py-1.5 text-[13px] focus:outline-none focus:border-pine"
                />
                <button
                  onClick={() => saveReview(a.answer_id)}
                  disabled={saving}
                  className="px-4 py-1.5 text-[13px] font-medium bg-pine text-white rounded-[3px] hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(null); setError(null); }}
                  className="px-4 py-1.5 text-[13px] border border-hairline rounded-[3px] hover:bg-paper"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => startEdit(a)}
                  className="text-[13px] font-medium text-pine hover:underline"
                >
                  {reviewed ? "Edit" : "Review →"}
                </button>
                {reviewed && a.review_note && (
                  <span className="text-[12px] text-muted">Note: {a.review_note}</span>
                )}
              </div>
            )}

            {error && editing === a.answer_id && (
              <p className="mt-2 text-[12px] text-error">{error}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
