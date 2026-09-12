"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { DemeterMark } from "../components/DemeterMark";
import { errorStrings, LOCALES, STORAGE_KEY, type Locale } from "./i18n";

// Root error boundary for the public site. Catches errors thrown inside the
// root layout's children — every Demeter route funnels here. The root layout's
// <html>/<body> stay intact; layout-level failures go to global-error.tsx.
//
// Demeter-branded per apps/web/DEMETER-DESIGN.md (white ground, wheat mark,
// Newsreader serif, terracotta CTA). Bilingual: reads the same locale the
// landing page persists; unknown on first render -> EN, hydrate in an effect.

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
      // Honor every supported locale, not just en/es — a vi/zh/tl visitor must
      // not drop to English mid-failure (the whole product serves LEP users).
      if (saved && (LOCALES as string[]).includes(saved)) setLocale(saved as Locale);
    } catch {
      // localStorage disabled — keep default.
    }
  }, []);

  // Custom event so we track USER-VISIBLE error frequency, not just exception
  // rate. The underlying error is captured by Sentry auto-instrumentation.
  useEffect(() => {
    Sentry.captureMessage("web.error_page_viewed", {
      level: "warning",
      tags: { digest: error.digest ?? "none" },
      extra: { pathname: typeof window !== "undefined" ? window.location.pathname : "" },
    });
  }, [error.digest]);

  const copy = errorStrings[locale] ?? errorStrings.en;
  const errorId = error.digest ?? "none";

  return (
    <main className="error-page">
      <div className="container">
        <div className="error-card" role="alert">
          <div className="error-card__mark">
            <DemeterMark size={30} />
          </div>
          <p className="error-card__status">{copy.errorStatus}</p>
          <h1 className="error-card__title">{copy.errorTitle}</h1>
          <p className="error-card__body">{copy.errorBody}</p>
          <p className="error-card__reference">
            {copy.errorReferenceLabel}:{" "}
            <span className="error-card__reference-value">{errorId}</span>
            <span className="error-card__reference-hint"> · {copy.errorReferenceHint}</span>
          </p>
          <div className="error-card__actions">
            <button
              type="button"
              onClick={reset}
              className="error-card__primary-cta"
            >
              {copy.errorRetryCta}
            </button>
            {/* Plain <a>: a full navigation after a caught render error is
                more reliable than client routing. */}
            <a href="/screen/ask" className="error-card__secondary-cta">
              {copy.errorHomeCta} →
            </a>
          </div>
          <p className="error-card__help">{copy.errorHelpNote}</p>
        </div>
      </div>
    </main>
  );
}
