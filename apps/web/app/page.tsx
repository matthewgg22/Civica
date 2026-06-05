"use client";

import { useEffect, useState } from "react";
import { strings, STORAGE_KEY, LOCALES, type Locale } from "./i18n";
import { HeroLPIE } from "../components/HeroLPIE";
import { LeadCaptureForm } from "../components/LeadCaptureForm";
import { LanguagePicker } from "../components/LanguagePicker";

export default function Page() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (LOCALES as string[]).includes(saved)) setLocale(saved as Locale);
    } catch {
      // localStorage disabled — fall back to default.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
      document.documentElement.lang = locale;
    } catch {
      // ignore
    }
  }, [locale]);

  const copy = strings[locale as keyof typeof strings] ?? strings.en;

  return (
    <div className="page">
      <header className="site-header">
        <div className="container site-header__inner">
          <a className="brand" href="/">
            Civica
          </a>
          <div className="site-header__actions">
            <LanguagePicker
              locale={locale}
              onChange={setLocale}
              ariaLabel={copy.languageToggleAria}
            />
            <a className="site-header__signin" href="/sign-in">
              {copy.navSignIn}
            </a>
          </div>
        </div>
      </header>

      <main>
        <HeroLPIE copy={copy} />

        <section className="section">
          <div className="container">
            <h2 className="section__title">{copy.whatTitle}</h2>
            <p className="section__body">{copy.whatBody}</p>
          </div>
        </section>

        <section className="section" id="lead-capture">
          <div className="container">
            <h2 className="section__title">{copy.formTitle}</h2>
            <p className="section__body">{copy.formSub}</p>
            <LeadCaptureForm copy={copy} />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">© 2026 Civica</div>
      </footer>
    </div>
  );
}
