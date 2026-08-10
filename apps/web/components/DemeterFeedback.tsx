"use client";

// Per-answer feedback: the only path by which a wrong answer reaches us.
//
// Deliberately small. The automatic checks already catch fabricated citations
// and invented numbers; what they cannot catch is an answer that is correctly
// cited and still wrong for this person. That report has to come from the
// reader, and a reader who is mid-application will not fill in a form.
//
// So: two buttons, always visible under an answer. A reason picker appears only
// after a thumbs-down, because asking "what was wrong?" before someone has said
// anything was wrong is noise. The note field is optional and last.
//
// It never blocks and never errors at the user. If the write fails, they still
// see "thank you" — they did their part, and telling them it failed only
// teaches them not to bother next time. The failure is logged server-side where
// it belongs.

import { useRef, useState } from "react";
import type { AnswerLang } from "@civica/demeter-engine/packs";

export interface FeedbackCopy {
  prompt: string;
  helpful: string;
  notHelpful: string;
  thanks: string;
  reasonPrompt: string;
  /** readonly: the copy table is `as const`, and widening it there just to
   *  satisfy this prop would throw away the literal types the rest of the
   *  component tree relies on. */
  readonly reasons: readonly { readonly value: string; readonly label: string }[];
  notePlaceholder: string;
  send: string;
  skip: string;
}

export function DemeterFeedback({
  question,
  answer,
  state,
  lang,
  certainty,
  copy,
}: {
  question: string;
  answer: string;
  state: string | null;
  lang: AnswerLang;
  certainty: "certain" | "uncertain" | null;
  copy: FeedbackCopy;
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [done, setDone] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // ONE id per report, reused across both submits. The thumbs-down fires
  // immediately and the reason+note follows, and without a shared key those
  // are two rows — one person's single complaint counted twice, split across
  // two `reason` buckets in the rollup. The route upserts on this.
  const reportIdRef = useRef<string>("");
  if (!reportIdRef.current) {
    reportIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "";
  }

  const submit = (r: "up" | "down", why?: string | null, text?: string) => {
    // Fire-and-forget by design: feedback must never make the page feel slow
    // or, worse, appear to fail.
    void fetch("/api/demeter/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId: reportIdRef.current || undefined,
        rating: r,
        reason: why ?? null,
        note: text ?? "",
        question,
        answer,
        state,
        lang,
        certainty,
      }),
    }).catch(() => {
      /* silent by design — see the header */
    });
  };

  if (done) return <p className="dmfb__thanks">{copy.thanks}</p>;

  if (rating === "down") {
    return (
      <div className="dmfb dmfb--expanded">
        <p className="dmfb__prompt">{copy.reasonPrompt}</p>
        <div className="dmfb__reasons">
          {copy.reasons.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`dmfb__reason ${reason === r.value ? "is-sel" : ""}`}
              onClick={() => setReason(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          className="dmfb__note"
          rows={2}
          value={note}
          placeholder={copy.notePlaceholder}
          aria-label={copy.notePlaceholder}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="dmfb__actions">
          <button
            type="button"
            className="dmfb__send"
            onClick={() => {
              submit("down", reason, note);
              setDone(true);
            }}
          >
            {copy.send}
          </button>
          <button
            type="button"
            className="dmfb__skip"
            onClick={() => {
              // The thumbs-down already fired on click; skipping only declines
              // to add detail, it does not withdraw the signal.
              setDone(true);
            }}
          >
            {copy.skip}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dmfb">
      <span className="dmfb__prompt">{copy.prompt}</span>
      <button
        type="button"
        className="dmfb__btn"
        onClick={() => {
          submit("up");
          setDone(true);
        }}
      >
        {copy.helpful}
      </button>
      <button
        type="button"
        className="dmfb__btn"
        onClick={() => {
          // Record the negative signal immediately — the reason is a bonus, and
          // most people will not stay for it.
          submit("down");
          setRating("down");
        }}
      >
        {copy.notHelpful}
      </button>
    </div>
  );
}
