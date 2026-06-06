"use client";

import { useEffect, useState } from "react";
import AppNav from "../../components/AppNav";
import { LanguagePicker } from "../../components/LanguagePicker";
import { STORAGE_KEY, LOCALES, type Locale } from "../i18n";

// Privacy Policy — placeholder. Content to be drafted with counsel.
export default function PrivacyPage() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (LOCALES as string[]).includes(saved)) setLocale(saved as Locale);
    } catch { /* localStorage disabled */ }
  }, []);

  function changeLocale(next: Locale) {
    setLocale(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
  }

  return (
    <div className="home">
      <AppNav
        rightSlot={<LanguagePicker locale={locale} onChange={changeLocale} ariaLabel="Choose language" />}
        tabs={[
          { label: "What is SNAP", href: "/welcome#what-is-snap" },
          { label: "Why Civica", href: "/why-civica" },
        ]}
        primaryCta={{ label: "Apply now", href: "/apply" }}
      />

      <section className="home-section">
        <div className="home-section__inner legal-page">
          <h1 className="home-section__title">Privacy Policy</h1>
          <p className="legal-page__note">
            Our full privacy policy is being finalized and will be published here soon.
            In the meantime, your information is encrypted and only shared with the
            agency processing your application.
          </p>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-section__inner home-footer__inner">
          <span>© 2026 Civica</span>
          <a className="home-footer__link" href="/privacy">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
