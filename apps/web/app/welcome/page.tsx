"use client";

import { useEffect, useState } from "react";
import AppNav from "../../components/AppNav";
import { LanguagePicker } from "../../components/LanguagePicker";
import { PhoneMockup } from "../../components/PhoneMockup";
import { BenefitEstimator } from "../../components/BenefitEstimator";
const TESTFLIGHT_URL =
  process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? "https://testflight.apple.com/";
import { STORAGE_KEY, LOCALES, type Locale } from "../i18n";
import { welcomeStrings } from "../../lib/i18n/snap-copy";
import {
  incomeGuide,
  formatGuideUsd,
  MAX_BENEFIT_ONE_PERSON,
} from "../../lib/eligibility-guide";

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

  const faqs: [string, string][] = [
    // "What you can't buy" — moved out of the buy section into the FAQ.
    [t.home_cant_q, t.home_buy_cant.split("|").join(" · ")],
    [t.home_faq_q1, t.home_faq_a1],
    [t.home_faq_q2, t.home_faq_a2],
    [t.home_faq_q3, t.home_faq_a3],
    [t.home_faq_q4, t.home_faq_a4],
    [t.home_faq_q5, t.home_faq_a5],
  ];

  return (
    <div className="home">
      <AppNav
        rightSlot={<LanguagePicker locale={locale} onChange={changeLocale} ariaLabel="Choose language" />}
        tabs={[
          { label: t.home_nav_what, href: "#what-is-snap" },
          { label: t.home_nav_why, href: "/why-civica" },
        ]}
        primaryCta={{
          label: t.home_nav_apply,
          href: "/apply",
          menu: [
            { label: t.home_nav_signin, href: "/sign-in" },
            { label: t.home_app_cta, href: TESTFLIGHT_URL, iconSrc: "/civica-app-icon.png", external: true },
          ],
        }}
      />

      {/* Hero — 2-column grid with phone mockup */}
      <section className="home-hero">
        <div className="home-hero__inner hero__grid">
          <div className="hero__col hero__col--copy">
            <p className="home-hero__eyebrow">{t.home_hero_eyebrow}</p>
            <h1 className="home-hero__title">{t.home_hero_title}</h1>
            <p className="home-hero__body">{t.home_hero_body}</p>
            <div className="trust-chips" role="list">
              <span className="trust-chip trust-chip--free" role="listitem">✓ 100% free</span>
              <span className="trust-chip" role="listitem">✓ No minimum income</span>
              <span className="trust-chip" role="listitem">✓ USDA-verified</span>
            </div>
            <div className="home-hero__ctas">
              <a href="/apply" className="btn btn--primary">{t.welcome_cta}</a>
              <a href="/sign-in" className="btn btn--ghost">{t.home_hero_secondary}</a>
            </div>
            <BenefitEstimator />
          </div>

          <div className="hero__col hero__col--visual" aria-hidden="true">
            <div className="hero__watermark">$292</div>
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* Ecosystem — one connected system */}
      <section className="welcome-ecosystem">
        <div className="home-section__inner">
          <h2 className="welcome-ecosystem__title">One connected system</h2>
          <p className="welcome-ecosystem__sub">Start on web, continue on iOS, get support from a CBO partner — your progress syncs everywhere.</p>
          <div className="ecosystem-grid">
            <div className="ecosystem-card">
              <span className="ecosystem-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                  <path d="M10.5 18.5h3" />
                </svg>
              </span>
              <h3 className="ecosystem-card__title">iOS app</h3>
              <p className="ecosystem-card__body">Apply and track from your iPhone. Face ID sign-in, status notifications.</p>
            </div>
            <div className="ecosystem-card">
              <span className="ecosystem-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9.5" />
                  <path d="M2.5 12h19M12 2.5c2.6 2.5 4 6 4 9.5s-1.4 7-4 9.5c-2.6-2.5-4-6-4-9.5s1.4-7 4-9.5Z" />
                </svg>
              </span>
              <h3 className="ecosystem-card__title">Web</h3>
              <p className="ecosystem-card__body">The full application in any browser. Nothing to download.</p>
            </div>
            <div className="ecosystem-card">
              <span className="ecosystem-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 21.5h16M5.5 21.5V5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" />
                  <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
                </svg>
              </span>
              <h3 className="ecosystem-card__title">Navigator support</h3>
              <p className="ecosystem-card__body">A trained navigator at a partner org reviews your application before it's filed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* What is SNAP — the explainer */}
      <section className="home-section" id="what-is-snap">
        <div className="home-section__inner home-explainer">
          <h2 className="home-section__title">{t.home_what_title}</h2>
          <p className="home-section__body">{t.home_what_body}</p>

          <h3 className="home-sub-title">{t.home_buy_title}</h3>
          <div className="home-buy">
            <div className="home-buy__col home-buy__col--can">
              <p className="home-buy__label home-buy__label--can">{t.home_buy_can_label}</p>
              <ul className="home-buy__list">
                {t.home_buy_can.split("|").map((item, i) => (
                  <li key={i} className="home-buy__item home-buy__item--can">{item}</li>
                ))}
              </ul>
            </div>
            <div className="home-buy__col home-buy__col--find">
              <div className="home-find">
                <span className="home-find__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </span>
                <p className="home-find__title">{t.home_findfood_title}</p>
                <p className="home-find__body">{t.home_findfood_body}</p>
              </div>
            </div>
          </div>

          <h3 className="home-sub-title">{t.home_income_title}</h3>
          <p className="home-income__intro">{t.home_income_intro}</p>
          <div className="home-income-panel">
            <table className="home-income">
              <thead>
                <tr>
                  <th scope="col">{t.home_income_col_size}</th>
                  <th scope="col">{t.home_income_col_amount}</th>
                </tr>
              </thead>
              <tbody>
                {incomeGuide(8).map((row) => (
                  <tr key={row.size}>
                    <td>
                      {row.size}{" "}
                      {row.size === 1 ? t.home_income_person : t.home_income_people}
                    </td>
                    <td>{formatGuideUsd(row.monthly)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="home-income__benefit">
              {t.home_income_benefit.replace("{max}", formatGuideUsd(MAX_BENEFIT_ONE_PERSON))}
            </p>
            <p className="home-income__note">{t.home_income_note}</p>
          </div>

          <h3 className="home-sub-title">{t.home_faq_title}</h3>
          <div className="home-faq">
            {faqs.map(([q, a], i) => (
              <details key={i} className="home-faq__item">
                <summary className="home-faq__q">{q}</summary>
                <p className="home-faq__a">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="home-section home-section--alt">
        <div className="home-section__inner home-closing">
          <p className="home-closing__label">Ready to check your eligibility?</p>
          <a href="/apply" className="btn btn--primary">{t.welcome_cta}</a>
          <p className="home-closing__sub">Takes about 10 minutes · No income minimum · 5 languages</p>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-section__inner">© 2026 Civica</div>
      </footer>
    </div>
  );
}
