"use client";

import { useEffect, useState } from "react";
import AppNav from "../../components/AppNav";
import { LanguagePicker } from "../../components/LanguagePicker";
import { AppDownloadIsland } from "../../components/AppDownloadIsland";
import { STORAGE_KEY, LOCALES, type Locale } from "../i18n";
import { welcomeStrings } from "../../lib/i18n/snap-copy";

// Applicant portal home — the welcoming first page. Mirrors the iOS entry
// ("Apply for SNAP" hero + a short explainer). The apply CTA goes straight
// to the wizard (localStorage draft, no sign-in needed to start), matching
// iOS "save anytime, no commitment to submit."
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

  return (
    <div className="home">
      <AppNav
        rightSlot={<LanguagePicker locale={locale} onChange={changeLocale} ariaLabel="Choose language" />}
        signIn={{ label: t.home_nav_signin, href: "/sign-in" }}
        tabs={[
          { label: t.home_nav_what, href: "#what-is-snap" },
          { label: t.home_nav_status, href: "/status" },
          { label: t.home_nav_apply, href: "/apply" },
        ]}
      />

      {/* Hero — two columns: message + eligibility card */}
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__text">
            <p className="home-hero__eyebrow">{t.home_hero_eyebrow}</p>
            <h1 className="home-hero__title">{t.home_hero_title}</h1>
            <p className="home-hero__body">{t.home_hero_body}</p>
            <div className="home-hero__ctas">
              <a href="/apply" className="btn btn--primary">{t.welcome_cta}</a>
              <a href="/sign-in" className="btn btn--secondary">{t.home_hero_secondary}</a>
            </div>
          </div>
          <aside className="home-hero__card">
            <p className="home-hero__card-body">{t.home_what_qualify}</p>
            <a href="/apply" className="home-hero__card-link">{t.home_nav_apply} →</a>
          </aside>
        </div>
      </section>

      {/* What is SNAP */}
      <section className="home-section" id="what-is-snap">
        <div className="home-section__inner">
          <h2 className="home-section__title">{t.home_what_title}</h2>
          <p className="home-section__body">{t.home_what_body}</p>
          <ul className="home-facts">
            {[t.home_what_fact1, t.home_what_fact2, t.home_what_fact3].map((fact, i) => {
              const [lead, sub] = fact.split("|");
              return (
                <li key={i} className="home-fact">
                  <strong>{lead}</strong>{sub ? ` ${sub}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Why Civica + final CTA */}
      <section className="home-section home-section--alt">
        <div className="home-section__inner">
          <h2 className="home-section__title">{t.welcome_trust_label}</h2>
          <ul className="home-trust">
            <li className="home-trust__item">{t.welcome_trust_1}</li>
            <li className="home-trust__item">{t.welcome_trust_2}</li>
            <li className="home-trust__item">{t.welcome_trust_3}</li>
          </ul>
          <div className="home-final-cta">
            <a href="/apply" className="btn btn--primary">{t.welcome_cta}</a>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-section__inner">© 2026 Civica</div>
      </footer>

      <AppDownloadIsland label={t.home_app_label} sub={t.home_app_sub} cta={t.home_app_cta} />
    </div>
  );
}
