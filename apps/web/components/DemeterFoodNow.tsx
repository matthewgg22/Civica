"use client";

// The crisis dialog behind the top bar's "Need food this week?" button.
//
// Same card-over-blurred-chat treatment as DemeterSignInModal, deliberately:
// the conversation someone is in the middle of stays visible behind it, so
// this reads as a detour rather than as having lost their place. The focus
// handling is the same three parts — start inside the card, cycle Tab within
// it, return focus to the opener on close.
//
// Both destinations are external and open in a new tab. That is the one place
// this product sends someone away on purpose: a food bank tonight is worth
// more than another answer about eligibility.

import { useEffect, useRef } from "react";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { FOODNOW_T, FOOD_BANK_URL, URL_211 } from "../lib/i18n/demeter-foodnow-copy";

export function DemeterFoodNow({ lang, onClose }: { lang: AnswerLang; onClose: () => void }) {
  const c = FOODNOW_T[lang];
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const focusable = [
        ...card.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="dmfn" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dmfn__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dmfn-title"
        tabIndex={-1}
        ref={cardRef}
      >
        <button type="button" className="dmfn__close" onClick={onClose} aria-label={c.close}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
            <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
            <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
          </svg>
        </button>
        <h2 className="dmfn__title" id="dmfn-title">
          {c.title}
        </h2>
        <p className="dmfn__body">{c.body}</p>
        <div className="dmfn__actions">
          <a className="dmfn__primary" href={FOOD_BANK_URL} target="_blank" rel="noopener noreferrer">
            {c.bank} ↗
          </a>
          <a className="dmfn__secondary" href={URL_211} target="_blank" rel="noopener noreferrer">
            {c.call211} ↗
          </a>
        </div>
        {/* Under the links, not above them: food today outranks the fact that
            SNAP itself may arrive within the week. */}
        <p className="dmfn__expedited">{c.expedited}</p>
      </div>
    </div>
  );
}
