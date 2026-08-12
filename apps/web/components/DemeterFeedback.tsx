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

import { useState } from "react";
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
  // useState with a lazy initializer, not a ref written during render. Same
  // guarantee — computed once per mount, never again — but it is the form React
  // supports for it: writing a ref during render is untracked mutation, and
  // React 19 flags it because a replayed render can observe a different value.
  // The setter is deliberately unused; this is a constant for this component's
  // lifetime.
  const [reportId] = useState<string>(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "",
  );

  const submit = (r: "up" | "down", why?: string | null, text?: string) => {
    // Fire-and-forget by design: feedback must never make the page feel slow
    // or, worse, appear to fail.
    void fetch("/api/demeter/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId: reportId || undefined,
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
      {/* ICONS, with the words as the accessible name rather than as visible
          labels. "Yes / No" beside "Was this helpful?" reads as a question
          demanding an answer; a thumb is an offer you can ignore. The label is
          still the localized string, so a screen reader hears "Yes", and the
          title gives a sighted user the same word on hover. */}
      <button
        type="button"
        className="dmfb__btn dmfb__btn--icon"
        aria-label={copy.helpful}
        title={copy.helpful}
        onClick={() => {
          submit("up");
          setDone(true);
        }}
      >
        <ThumbIcon />
      </button>
      <button
        type="button"
        className="dmfb__btn dmfb__btn--icon"
        aria-label={copy.notHelpful}
        title={copy.notHelpful}
        onClick={() => {
          // Record the negative signal immediately — the reason is a bonus, and
          // most people will not stay for it.
          submit("down");
          setRating("down");
        }}
      >
        <ThumbIcon down />
      </button>
    </div>
  );
}

/** One outline thumb, rotated for the down state, so the pair cannot drift.
 *  currentColor throughout: the button owns the colour, including on hover. */
function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg
      className="dmfb__thumb"
      data-down={down ? "true" : undefined}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Z" />
      <path d="M7 10l4.2-7a2 2 0 0 1 3.6 1.5L14 9h4.6a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.3 19H7" />
    </svg>
  );
}
