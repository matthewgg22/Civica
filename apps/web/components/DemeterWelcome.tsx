"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { DemeterMark } from "./DemeterMark";

/** REQUIRED VERBATIM by FNS wherever an organisation outside USDA uses the SNAP
 *  logo — the same string SnapOverview carries, and for the same reason. Not
 *  our sentence to reword, and deliberately NOT in the localized copy table: a
 *  mandated legal notice that can be translated is a mandated legal notice that
 *  can drift. It renders in English on every language of this card, which is
 *  what "must include the statement" means.
 *
 *  It is also the whole reason this card can carry the mark at all. A product
 *  that is not the government, opening with the government's logo, is exactly
 *  the confusion the notice exists to prevent — so it sits directly under the
 *  logo, at readable size, not in a footer three sections away.
 *
 *  Source: fns.usda.gov/resource/snap-logo-guidance. The spacing in "U. S." is
 *  theirs; it is reproduced rather than tidied. */
export const SNAP_SERVICE_MARK =
  "The SNAP logo is a service mark of the U. S. Department of Agriculture. " +
  "USDA does not endorse any goods, services, or enterprises.";

export interface DemeterWelcomeCopy {
  title: string;
  body: string;
  bodyTwo: string;
  signIn: string;
  continueWithout: string;
  cta: string;
  /** Accessible name for the corner dismiss. */
  close: string;
  /** USDA's own description of the program. */
  whatIsSnap: string;
}

/**
 * The first-visit card (owner, 2026-08-22).
 *
 * Shown ONCE, and it says what the program is before it says what this is —
 * someone who has just been told to "apply for SNAP" may not know what those
 * letters mean, and that is a worse place to start than not knowing what
 * Demeter is.
 *
 * IT IS NOT A GATE. Escape closes it, the backdrop closes it, and the chat
 * behind it is already loaded — nobody is held at a door to read a definition.
 */
export function DemeterWelcome({
  copy,
  onDismiss,
  signInHref,
}: {
  copy: DemeterWelcomeCopy;
  onDismiss: () => void;
  /** Where "Sign in" goes. Omitted, the card shows only the continue action. */
  signInHref?: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const ctaRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    ctaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus stays in the card while it is open — the chat behind it is inert
      // to the keyboard, or Tab walks a reader into a conversation they cannot
      // see past the backdrop.
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
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
      // Focus goes back where it came from, so dismissing does not drop a
      // keyboard reader at the top of the document.
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [onDismiss]);

  return (
    <div className="dmwel" role="presentation" onClick={onDismiss}>
      <div
        className="dmwel__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dmwel-title"
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* A CORNER DISMISS, not only the button at the foot. Someone who
            already knows what SNAP is should not have to read to the end of the
            card to leave it. */}
        <button
          type="button"
          className="dmwel__x"
          onClick={onDismiss}
          aria-label={copy.close}
          title={copy.close}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        {/* WHOSE CARD THIS IS. The SNAP mark says what the PROGRAM is; without
            Demeter's own mark beside it, a card that opens on the government's
            logo reads as the government's card — which is the confusion the
            service mark below exists to prevent, so the fix belongs here too,
            not only in the notice. */}
        {/* THE WORDMARK SITS UNDER ITS OWN MARK (owner, 2026-08-26), which is
            what lets both marks grow. Set side by side the lockup was 140px
            wide, and the pair no longer fitted one row on a phone: the SNAP
            logo wrapped to its own line, stranding the divider in mid-air, and
            the marks cost 160px of a card that had 43px of headroom. Stacked,
            the lockup is as wide as the word, the pair fits with room to
            spare, and the divider has nothing left to divide. */}
        <div className="dmwel__marks">
          <span className="dmwel__brand">
            <DemeterMark size={56} />
            <span className="dmwel__brandword" translate="no">
              Demeter <em>AI</em>
            </span>
          </span>
        {/* Unaltered, at its true 663:460 ratio — "the logo cannot be altered"
            is a condition of being allowed to use it; only its box is ours to
            set. Decorative: the heading beside it names the program, so alt
            text would announce the same thing twice. */}
          <span className="dmwel__logo">
            <Image src="/snap-logo.png" alt="" aria-hidden width={124} height={86} priority />
          </span>
        </div>

        <h2 className="dmwel__title" id="dmwel-title">
          {copy.title}
        </h2>
        <p className="dmwel__what">{copy.whatIsSnap}</p>
        {/* ONE POINT PER LINE. This was two dense paragraphs and the reader had
            to mine both for the fact that matters. */}
        <p className="dmwel__body">{copy.body}</p>
        <p className="dmwel__body dmwel__body--quiet">{copy.bodyTwo}</p>

        {/* SIGN IN LEADS, CONTINUING IS THE QUIET ONE (owner, 2026-08-26).
            Saving a conversation is the thing someone regrets not doing, and
            it is invisible until they have lost one. It is still only an
            offer: continuing without an account is one tap, right underneath,
            and nothing is gated behind the account. */}
        {signInHref ? (
          <>
            <a className="dmwel__cta" href={signInHref}>
              {copy.signIn}
              <span className="dmwel__arrow" aria-hidden>
                →
              </span>
            </a>
            <button
              type="button"
              className="dmwel__secondary"
              onClick={onDismiss}
              ref={ctaRef}
            >
              {copy.continueWithout}
            </button>
          </>
        ) : (
          <button type="button" className="dmwel__cta" onClick={onDismiss} ref={ctaRef}>
            {copy.cta}
            <span className="dmwel__arrow" aria-hidden>
              →
            </span>
          </button>
        )}

        {/* AT THE FOOT, not between the reader and the button. FNS requires the
            notice appear wherever the mark is used; it does not require it
            interrupt the path to the action, and it was doing exactly that.
            English on every language, by requirement. VERIFIED VERBATIM against
            fns.usda.gov/snap/logo-guidance on 2026-08-26, including the space
            in "U. S." — that is FNS's own spacing, not a typo of ours.
            The link is additive: it points at the programme the mark belongs
            to and changes not one character of the required sentence. */}
        <p className="dmwel__mark" lang="en">
          The SNAP logo is a service mark of the{" "}
          <a
            className="dmwel__marklink"
            href="https://www.fns.usda.gov/snap"
            target="_blank"
            rel="noopener noreferrer"
          >
            U. S. Department of Agriculture
          </a>
          . USDA does not endorse any goods, services, or enterprises.
        </p>
      </div>
    </div>
  );
}
