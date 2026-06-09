"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STORAGE_KEY, type Locale } from "../i18n";
import { snapT } from "../../lib/i18n/snap-copy";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="signin-page" />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/apply";
  // Surfaced by /api/auth/google + /auth/callback when OAuth fails.
  const hasError = search.get("error") != null;

  const [locale, setLocale] = useState<Locale>("en");

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

  return (
    <div className="signin-page">
      <header className="signin-header">
        <a className="brand" href="/welcome">Civica</a>
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
      </header>

      <main className="signin-main">
        <div className="signin-card">
          <h1 className="signin-title">{snapT(locale, "signin_title")}</h1>
          <p className="signin-subtitle">{snapT(locale, "signin_subtitle")}</p>

          <a className="signin-google" href={googleHref}>
            <svg className="signin-google-icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58Z" />
            </svg>
            {snapT(locale, "signin_continue_google")}
          </a>

          <p className="signin-disclosure">{snapT(locale, "signin_google_disclosure")}</p>

          {hasError && (
            <div className="signin-error" role="alert">
              {snapT(locale, "signin_error_generic")}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
