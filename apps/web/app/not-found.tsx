"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { DemeterMark } from "../components/DemeterMark";
import { strings, STORAGE_KEY, type Locale } from "./i18n";

// Root 404. Demeter-branded per apps/web/DEMETER-DESIGN.md. Most not-found hits
// are stale links or hand-typed URLs. CTAs route to the Demeter home and to the
// static /questions reference (which stays up even when dynamic pages fail).

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

  // Track 404 frequency as a wayfinding-gap signal; pathname only, no user data.
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
          <div className="error-card__mark">
            <DemeterMark size={40} />
          </div>
          <p className="error-card__status error-card__status--muted">
            {copy.notFoundStatus}
          </p>
          <h1 className="error-card__title">{copy.notFoundTitle}</h1>
          <p className="error-card__body">{copy.notFoundBody}</p>
          <div className="error-card__actions">
            <Link
              href="/screen/ask"
              className="error-card__primary-cta error-card__primary-cta--link"
            >
              {copy.notFoundHomeCta}
            </Link>
            <Link href="/questions" className="error-card__secondary-cta">
              {copy.notFoundQuestionsCta} →
            </Link>
          </div>
          <p className="error-card__help">{copy.errorHelpNote}</p>
        </div>
      </div>
    </main>
  );
}
