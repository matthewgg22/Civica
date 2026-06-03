"use client";

import { useEffect, useState } from "react";
import { strings, STORAGE_KEY, type Locale } from "./i18n";

// Root error boundary for the marketing site. Catches errors thrown inside
// the root layout's children. The root layout's <html>/<body> stay intact;
// layout-level failures are caught by global-error.tsx instead.
//
// Bilingual: reads the same locale that the landing page uses (persisted in
// localStorage). On first render the locale is unknown — render EN, hydrate
// from localStorage in an effect. The flash is harmless on a transient state.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
  const errorId = error.digest ?? "—";

  return (
    <main className="error-page">
      <div className="container">
        <div className="error-card" role="alert">
          <p className="error-card__status">{copy.errorStatus}</p>
          <h1 className="error-card__title">{copy.errorTitle}</h1>
          <p className="error-card__body">{copy.errorBody}</p>
          <p className="error-card__reference">
            {copy.errorReferenceLabel}:{" "}
            <span className="error-card__reference-value">{errorId}</span>
          </p>
          <div className="error-card__actions">
            <button
              type="button"
              onClick={reset}
              className="error-card__primary-cta"
            >
              {copy.errorRetryCta}
            </button>
            <a href="/" className="error-card__secondary-cta">
              {copy.errorHomeCta} →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
