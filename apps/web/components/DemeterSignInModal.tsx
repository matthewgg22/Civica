"use client";

// Sign-in, over the chat rather than instead of it (owner rec 2026-08-22).
//
// WHY A MODAL AND NOT THE ROUTE. Navigating to /sign-in threw the
// conversation off screen at the exact moment someone was deciding whether
// to trust us with an email — and the page behind the card was a flat
// scrim, so nothing said "your chat is still here". Now the chat stays,
// blurred, behind a small card: the thing being saved is visible while you
// decide to save it.
//
// The route STILL EXISTS and still works: the links keep their href, this
// only preventDefaults when JavaScript is there to handle it. Magic-link
// returns, OAuth error redirects, shared links and no-JS all land on the
// standalone page exactly as before.
//
// Auth actions come from lib/magic-link so the endpoint and the failure
// mapping cannot drift from the route's copy of them.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SIGNIN_T } from "../lib/i18n/demeter-signin-copy";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { googleHref, sendMagicLink } from "../lib/magic-link";

export function DemeterSignInModal({
  next,
  lang,
  onClose,
}: {
  next: string;
  lang: AnswerLang;
  onClose: () => void;
}) {
  const dt = SIGNIN_T[lang];
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // FOCUS, all three parts of it:
  //  - it starts inside the card, so the dialog is reachable;
  //  - Tab CYCLES within the card rather than walking out into the blurred
  //    chat behind, which is unreachable to a mouse but was still in the
  //    tab order — a modal you can tab out of is a modal in name only;
  //  - and it RETURNS to whatever opened this on close, so the keyboard is
  //    left where it was rather than back at the document top.
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
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      // The card itself holds focus on open (tabIndex -1), so the first Tab
      // has to be steered too, not just the wrap at either end.
      if (!e.shiftKey && (active === last || active === card)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === card)) {
        e.preventDefault();
        last.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setError(null);
    setState("sending");
    const outcome = await sendMagicLink(email, next);
    if (outcome === "sent") return setState("sent");
    // Focus returns to the field that needs fixing (vercel-guidelines
    // finding 8): role="alert" announces it, this navigates to it.
    setError(
      outcome === "invalid_email"
        ? dt.errorInvalidEmail
        : outcome === "rate_limited"
          ? dt.errorRateLimited
          : dt.errorGeneric,
    );
    setState("idle");
    emailRef.current?.focus();
  };

  return (
    <div className="dmsi" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="dmsi__card signin-card"
        role="dialog"
        aria-modal="true"
        aria-label={dt.title}
        tabIndex={-1}
        ref={cardRef}
      >
        <button type="button" className="dmsi__close" onClick={onClose} aria-label={dt.close}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
        <h2 className="signin-title">{dt.title}</h2>
        <p className="signin-subtitle">{dt.subtitle}</p>

        {state === "sent" ? (
          <div role="status">
            <p className="signin-sent-title">{dt.emailSentTitle}</p>
            <p className="signin-otp-sent">{dt.emailSentBody.replace("{email}", email)}</p>
            {/* A way back, same as the route has: a mistyped address or a
                link that never arrives otherwise leaves this card with no
                exit but closing it and starting over. */}
            <button
              type="button"
              className="signin-resend"
              onClick={() => {
                setState("idle");
                setEmail("");
              }}
            >
              {dt.emailRetry}
            </button>
          </div>
        ) : (
          <>
            <a className="signin-google" href={googleHref(next)}>
              <svg className="signin-google-icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.98 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              {dt.continueGoogle}
            </a>
            <div className="signin-divider" role="separator">
              <span>{dt.or}</span>
            </div>
            <form onSubmit={submit}>
              {/* Same structure as the standalone route's form — .signin-field
                  carries the label/input stacking, .signin-cta the button —
                  so both surfaces inherit one set of styles rather than the
                  modal growing its own. */}
              <div className="signin-field">
                <label className="signin-label" htmlFor="dmsi-email">
                  {dt.emailLabel}
                </label>
                <input
                  id="dmsi-email"
                  ref={emailRef}
                  className="signin-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  required
                  placeholder={dt.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && (
                <p className="signin-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="signin-cta"
                disabled={state === "sending" || email.trim() === ""}
              >
                {state === "sending" ? dt.emailSending : dt.emailCta}
              </button>
            </form>
            <p className="signin-disclosure">{dt.emailDisclosure}</p>
          </>
        )}
      </div>
    </div>
  );
}
