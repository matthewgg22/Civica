"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY, type Locale } from "../i18n";
import { welcomeStrings } from "../../lib/i18n/snap-copy";

export default function WelcomePage() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") setLocale(saved as Locale);
    } catch {
      // localStorage disabled
    }
  }, []);

  function toggleLocale() {
    const next: Locale = locale === "en" ? "es" : "en";
    setLocale(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
  }

  const t = welcomeStrings[locale];

  return (
    <div className="signin-page">
      <header className="signin-header">
        <a className="brand" href="/">Civica</a>
        <button
          type="button"
          className="locale-toggle"
          onClick={toggleLocale}
          aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}
        >
          {locale === "en" ? "Español" : "English"}
        </button>
      </header>

      <main className="signin-main">
        <div className="signin-card welcome-card">
          <h1 className="signin-title">{t.welcome_title}</h1>
          <p className="signin-subtitle">{t.welcome_subtitle}</p>

          <ul className="welcome-trust-list" aria-label={t.welcome_trust_label}>
            <li className="welcome-trust-item">
              <span className="welcome-trust-icon" aria-hidden="true">🌾</span>
              <span>{t.welcome_trust_1}</span>
            </li>
            <li className="welcome-trust-item">
              <span className="welcome-trust-icon" aria-hidden="true">🔒</span>
              <span>{t.welcome_trust_2}</span>
            </li>
            <li className="welcome-trust-item">
              <span className="welcome-trust-icon" aria-hidden="true">📋</span>
              <span>{t.welcome_trust_3}</span>
            </li>
          </ul>

          <a
            href="/sign-in?next=%2Fapply"
            className="signin-cta"
            style={{ display: "block", textAlign: "center", textDecoration: "none" }}
          >
            {t.welcome_cta}
          </a>

          <p className="welcome-signin-link">
            {t.welcome_returning}{" "}
            <a href="/sign-in" className="welcome-link">{t.welcome_signin_link}</a>
          </p>
        </div>
      </main>
    </div>
  );
}
