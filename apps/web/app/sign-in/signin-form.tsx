"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { STORAGE_KEY, type Locale } from "../i18n";
import { snapT } from "../../lib/i18n/snap-copy";
import { SIGNIN_T, resolveSigninLang } from "../../lib/i18n/demeter-signin-copy";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { DemeterMark } from "../../components/DemeterMark";

const LANG_NAMES: Record<AnswerLang, string> = {
  en: "English",
  es: "Español",
  vi: "Tiếng Việt",
  zh: "中文",
};

/** The whole interactive page, client-side. Split from page.tsx so the page
 *  module can stay a SERVER component and export generateMetadata — while
 *  this was itself the "use client" default export, every visit wore the root
 *  layout's "Civica — Apply for SNAP food benefits" tab title (#698). */
export default function SignInClient() {
  return (
    <Suspense fallback={<div className="signin-page" />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const search = useSearchParams();
  // DEMETER IS THE DEFAULT (#698). This used to fall back to "/apply", which
  // dated from before the pivot and meant every COLD entry to this page — a
  // bookmark, a shared link, a back-navigation that dropped the query, an auth
  // error redirect — greeted a Demeter user with "Save your application… for
  // your navigator": an application they never started and a navigator they
  // have never met.
  //
  // Both real callers pass `next` explicitly (DemeterSave → /screen/…,
  // BuddyBanner → /apply), so the fallback only ever governed entries that
  // named no destination. Those now read as the product people actually
  // arrived from; the apply flow opts in, which is the inverse of before and
  // the right way round now.
  const next = search.get("next") ?? "/screen/ask";
  // Surfaced by /api/auth/google + /auth/callback when OAuth fails.
  const hasError = search.get("error") != null;
  // Where they came from decides what we promise. Arriving from the Demeter
  // chat's Save button and being told "Save your application" would describe a
  // commitment they have not made — and this page is shared by both flows.
  //
  // LOCALE-TOLERANT (#898 P1-5): the localized chat pages live at
  // /es/screen/ask, /vi/…, /zh/… — a bare startsWith("/screen") sent every
  // non-English Demeter user to the Civica apply-flow branding ("Save your
  // application… for your navigator") at the exact moment they were deciding
  // whether to trust this with their email.
  const forConversation = /^\/(?:(?:es|vi|zh)\/)?(?:screen|chat)(?:\/|$|\?)/.test(next);

  const [locale, setLocale] = useState<Locale>("en");
  // The Demeter branch's language (#694): four options, resolved from the
  // explicit ?lang= (DemeterSave passes it), else the next-path's own locale
  // prefix — which is what survives the trip through an inbox — else English.
  // Deliberately NOT persisted to the apply flow's EN/ES STORAGE_KEY: writing
  // "vi" there would corrupt a toggle that only knows two values.
  const [lang, setLang] = useState<AnswerLang>(() =>
    resolveSigninLang(search.get("lang"), next),
  );
  const dt = SIGNIN_T[lang];
  const [email, setEmail] = useState("");
  // Focus lands back in the field that needs fixing on a failed submit
  // (vercel-guidelines finding 8) — role="alert" announces, this navigates.
  const emailRef = useRef<HTMLInputElement>(null);
  const [linkState, setLinkState] = useState<"idle" | "sending" | "sent">("idle");
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") setLocale(saved);
    } catch {
      // localStorage disabled
    }
  }, []);

  // Full-page navigation (not fetch): OAuth needs a top-level redirect so the
  // PKCE verifier cookie set by the server route rides along to Google.
  const googleHref = `/api/auth/google?next=${encodeURIComponent(next)}`;

  // The magic-link route answers identically whether or not the address is
  // known, and so does this: the only failures surfaced are ones the person can
  // act on (a malformed address, too many requests). Anything else still lands
  // on "check your email", because the alternative is telling someone their
  // address does not exist on a benefits service.
  const sendLink = async (event: FormEvent) => {
    event.preventDefault();
    if (linkState === "sending") return;
    setLinkError(null);
    setLinkState("sending");
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
      if (res.status === 400) {
        setLinkError(forConversation ? dt.errorInvalidEmail : snapT(locale, "signin_error_invalid_email"));
        setLinkState("idle");
        emailRef.current?.focus();
        return;
      }
      if (res.status === 429) {
        setLinkError(forConversation ? dt.errorRateLimited : snapT(locale, "signin_error_rate_limited"));
        setLinkState("idle");
        emailRef.current?.focus();
        return;
      }
      setLinkState("sent");
    } catch {
      setLinkError(forConversation ? dt.errorGeneric : snapT(locale, "signin_error_generic"));
      setLinkState("idle");
      emailRef.current?.focus();
    }
  };

  return (
    // data-surface scopes the Demeter reskin, so the apply flow's own look is
    // untouched rather than a shared page changing for everyone.
    <div className="signin-page" data-surface={forConversation ? "demeter" : "civica"}>
      <header className="signin-header">
        {/* The brand has to match the product they came from. A Demeter user
            sent to a "Civica" wordmark linking to /welcome — a page that is
            itself on the retire list (#668) — lands somewhere unrelated to
            what they were doing, mid sign-in, which is exactly when a person
            is deciding whether this is trustworthy. */}
        {forConversation ? (
          <a className="signin-brand-demeter" href="/screen/ask">
            <DemeterMark size={28} />
            <span>Demeter</span>
          </a>
        ) : (
          <a className="brand" href="/welcome">Civica</a>
        )}
        {forConversation ? (
          // The chat this person just left offers four languages; the page
          // standing between them and their saved conversation offers the
          // same four (#694). Buttons, not links — the language is page
          // state here, and navigating away would drop the next= handoff.
          <div className="signin-langs" role="group" aria-label="Language">
            {(Object.keys(LANG_NAMES) as AnswerLang[]).map((code) => (
              <button
                key={code}
                type="button"
                className="signin-lang"
                aria-pressed={lang === code}
                onClick={() => setLang(code)}
              >
                {LANG_NAMES[code]}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="locale-toggle"
            onClick={() => {
              const nextLocale: Locale = locale === "en" ? "es" : "en";
              setLocale(nextLocale);
              try { window.localStorage.setItem(STORAGE_KEY, nextLocale); } catch {}
            }}
            aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}
          >
            {locale === "en" ? "Español" : "English"}
          </button>
        )}
      </header>

      <main className="signin-main">
        <div className="signin-card">
          <h1 className="signin-title">
            {forConversation ? dt.title : snapT(locale, "signin_title")}
          </h1>
          <p className="signin-subtitle">
            {forConversation ? dt.subtitle : snapT(locale, "signin_subtitle")}
          </p>

          {linkState === "sent" ? (
            <div role="status">
              <p className="signin-sent-title">
                {forConversation ? dt.emailSentTitle : snapT(locale, "signin_email_sent_title")}
              </p>
              <p className="signin-otp-sent">
                {(forConversation ? dt.emailSentBody : snapT(locale, "signin_email_sent_body")).replace("{email}", email)}
              </p>
              <button
                type="button"
                className="signin-resend"
                onClick={() => {
                  setLinkState("idle");
                  setEmail("");
                }}
              >
                {forConversation ? dt.emailRetry : snapT(locale, "signin_email_retry")}
              </button>
            </div>
          ) : (
            <>
          <a className="signin-google" href={googleHref}>
            <svg className="signin-google-icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58Z" />
            </svg>
            {forConversation ? dt.continueGoogle : snapT(locale, "signin_continue_google")}
          </a>

          <p className="signin-disclosure">
            {forConversation ? dt.googleDisclosure : snapT(locale, "signin_google_disclosure")}
          </p>

          <div className="signin-divider" role="separator">
            <span>{forConversation ? dt.or : snapT(locale, "signin_or")}</span>
          </div>

          {/* Email, not SMS. /api/auth/otp exists but is phone — a worse ask
              for someone applying for food assistance, often on a shared or
              borrowed phone, and it costs per message. */}
          <form onSubmit={sendLink}>
            <div className="signin-field">
            <label className="signin-label" htmlFor="signin-email">
              {forConversation ? dt.emailLabel : snapT(locale, "signin_email_label")}
            </label>
            <input
              id="signin-email"
              className="signin-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              ref={emailRef}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={forConversation ? dt.emailPlaceholder : snapT(locale, "signin_email_placeholder")}
            />
            </div>
            <button
              type="submit"
              className="signin-cta"
              disabled={linkState === "sending" || email.trim() === ""}
            >
              {forConversation
                ? linkState === "sending" ? dt.emailSending : dt.emailCta
                : snapT(locale, linkState === "sending" ? "signin_email_sending" : "signin_email_cta")}
            </button>
          </form>

          <p className="signin-disclosure">
            {forConversation ? dt.emailDisclosure : snapT(locale, "signin_email_disclosure")}
          </p>

          {/* Sign-in-wrap. Adjacent to the button that creates the account,
              because notice buried elsewhere is not assent. Demeter branch only:
              the Civica application flow is governed by its own terms, which
              these documents deliberately do not cover. */}
          {forConversation && (
            <p className="signin-disclosure">
              {dt.termsAssent.before}
              <a className="signin-link" href="/terms">
                {dt.termsAssent.terms}
              </a>
              {dt.termsAssent.between}
              <a className="signin-link" href="/privacy">
                {dt.termsAssent.privacy}
              </a>
              {dt.termsAssent.after}
            </p>
          )}

          {linkError && (
            <div className="signin-error" role="alert">
              {linkError}
            </div>
          )}
            </>
          )}

          {hasError && (
            <div className="signin-error" role="alert">
              {forConversation ? dt.errorGeneric : snapT(locale, "signin_error_generic")}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
