"use client";

import { useEffect, useState } from "react";
import AppNav from "../../components/AppNav";
import { LanguagePicker } from "../../components/LanguagePicker";
import { STORAGE_KEY, LOCALES, type Locale } from "../i18n";
import { welcomeStrings } from "../../lib/i18n/snap-copy";

// Applicant portal home — the welcoming first page. Mirrors the iOS entry
// (hero "Apply for SNAP" + explainer + how-it-works) rather than the old
// bare card. Nav tabs anchor-scroll to sections or route to apply/status.
export default function WelcomePage() {
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

  const t = welcomeStrings[locale];

  const localeToggle = (
    <LanguagePicker locale={locale} onChange={changeLocale} ariaLabel="Choose language" />
  );

  const steps = [
    { n: 1, title: t.home_how_1_title, body: t.home_how_1_body },
    { n: 2, title: t.home_how_2_title, body: t.home_how_2_body },
    { n: 3, title: t.home_how_3_title, body: t.home_how_3_body },
    { n: 4, title: t.home_how_4_title, body: t.home_how_4_body },
  ];

  return (
    <div className="home">
      <AppNav
        rightSlot={localeToggle}
        tabs={[
          { label: t.home_nav_what, href: "#what-is-calfresh" },
          { label: t.home_nav_how, href: "#how-it-works" },
          { label: t.home_nav_status, href: "/status" },
          { label: t.home_nav_apply, href: "/sign-in?next=%2Fapply" },
        ]}
      />

      {/* Hero */}
      <section className="home-hero">
        <div className="home-hero__inner">
          <p className="home-hero__eyebrow">{t.home_hero_eyebrow}</p>
          <h1 className="home-hero__title">{t.home_hero_title}</h1>
          <p className="home-hero__body">{t.home_hero_body}</p>
          <div className="home-hero__ctas">
            <a href="/sign-in?next=%2Fapply" className="btn btn--primary">{t.welcome_cta}</a>
            <a href="/sign-in" className="btn btn--secondary">{t.home_hero_secondary}</a>
          </div>
        </div>
      </section>

      {/* What is CalFresh */}
      <section className="home-section" id="what-is-calfresh">
        <div className="home-section__inner">
          <h2 className="home-section__title">{t.home_what_title}</h2>
          <p className="home-section__body">{t.home_what_body}</p>
          <ul className="home-facts">
            <li className="home-fact"><span className="home-fact__mark" aria-hidden>🌾</span><span>{t.home_what_fact1}</span></li>
            <li className="home-fact"><span className="home-fact__mark" aria-hidden>👥</span><span>{t.home_what_fact2}</span></li>
            <li className="home-fact"><span className="home-fact__mark" aria-hidden>🔒</span><span>{t.home_what_fact3}</span></li>
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="home-section home-section--alt" id="how-it-works">
        <div className="home-section__inner">
          <h2 className="home-section__title">{t.home_how_title}</h2>
          <ol className="home-steps">
            {steps.map((s) => (
              <li key={s.n} className="home-step">
                <span className="home-step__num">{s.n}</span>
                <div>
                  <p className="home-step__title">{s.title}</p>
                  <p className="home-step__body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why Civica + final CTA */}
      <section className="home-section">
        <div className="home-section__inner">
          <h2 className="home-section__title">{t.welcome_trust_label}</h2>
          <ul className="home-trust">
            <li className="home-trust__item"><span className="home-trust__icon" aria-hidden>🌾</span><span>{t.welcome_trust_1}</span></li>
            <li className="home-trust__item"><span className="home-trust__icon" aria-hidden>🔒</span><span>{t.welcome_trust_2}</span></li>
            <li className="home-trust__item"><span className="home-trust__icon" aria-hidden>📋</span><span>{t.welcome_trust_3}</span></li>
          </ul>
          <div className="home-final-cta">
            <a href="/sign-in?next=%2Fapply" className="btn btn--primary">{t.welcome_cta}</a>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-section__inner">© 2026 Civica</div>
      </footer>
    </div>
  );
}
