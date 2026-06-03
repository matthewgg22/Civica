"use client";

import { useEffect, useState } from "react";
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

  const copy = strings[locale];

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
            <a href="/" className="error-card__primary-cta error-card__primary-cta--link">
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
