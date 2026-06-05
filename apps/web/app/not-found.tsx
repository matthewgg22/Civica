"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { strings, STORAGE_KEY, type Locale } from "./i18n";

// Root 404. Civica web is a single-route marketing surface today; most
// not-found hits are old shared links or hand-typed URLs. Bilingual to match
// the landing page; CTAs route back to "/" and the qualify hash anchor.

export default function NotFound() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") setLocale(saved);
    } catch {
      // localStorage disabled — keep default.
    }
  }, []);

  // Track 404 frequency as a wayfinding-gap signal. Pathname is the only
  // tag we need to debug which dead link a user followed; no user data.
  useEffect(() => {
    Sentry.captureMessage("web.not_found_viewed", {
      level: "info",
      extra: { pathname: typeof window !== "undefined" ? window.location.pathname : "" },
    });
  }, []);

  const copy = strings[locale as keyof typeof strings] ?? strings.en;

  return (
    <main className="error-page">
      <div className="container">
        <div className="error-card">
          <p className="error-card__status error-card__status--muted">
            {copy.notFoundStatus}
          </p>
          <h1 className="error-card__title">{copy.notFoundTitle}</h1>
          <p className="error-card__body">{copy.notFoundBody}</p>
          <div className="error-card__actions">
            <a href="/welcome" className="error-card__primary-cta error-card__primary-cta--link">
              {copy.notFoundHomeCta}
            </a>
            <a href="/#lead-capture" className="error-card__secondary-cta">
              {copy.notFoundQualifyCta} →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
