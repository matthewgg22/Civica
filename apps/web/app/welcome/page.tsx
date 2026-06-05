"use client";

import { useEffect, useState } from "react";
import AppNav from "../../components/AppNav";
import { LanguagePicker } from "../../components/LanguagePicker";
// iOS app lives in the nav CTA dropdown now (the floating island was retired).
const TESTFLIGHT_URL =
  process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? "https://testflight.apple.com/";
import { STORAGE_KEY, LOCALES, type Locale } from "../i18n";
import { welcomeStrings } from "../../lib/i18n/snap-copy";
import {
  incomeGuide,
  formatGuideUsd,
  MAX_BENEFIT_ONE_PERSON,
} from "../../lib/eligibility-guide";

// Applicant portal home — the welcoming first page. Mirrors the iOS entry
// ("Apply for SNAP" hero + a short explainer). The apply CTA goes straight
// to the wizard (localStorage draft, no sign-in needed to start), matching
// iOS "save anytime, no commitment to submit."
//
// The "What is SNAP" section is the explainer, structured around the
// questions real applicants ask: what can I buy, do I earn too much, and
// why does this feel different everywhere? Income limits and program names
// vary by state, so the copy stays state-agnostic and frames Civica as the
// thing that reads YOUR state's rules for you. Figures derive from
// lib/eligibility-guide.ts (mirrors the engine's federal constants).
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
          { label: t.home_nav_status, href: "/status" },
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
            <ul className="home-hero__card-list">
              <li className="home-hero__card-item">{t.welcome_trust_1}</li>
              <li className="home-hero__card-item">{t.welcome_trust_2}</li>
              <li className="home-hero__card-item">{t.welcome_trust_3}</li>
            </ul>
            <a href="/apply" className="home-hero__card-link">{t.welcome_cta}</a>
          </aside>
        </div>
      </section>

      {/* What is SNAP — the explainer */}
      <section className="home-section" id="what-is-snap">
        <div className="home-section__inner home-explainer">
          <h2 className="home-section__title">{t.home_what_title}</h2>
          <p className="home-section__body">{t.home_what_body}</p>

          {/* What you can / can't buy */}
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
            <div className="home-buy__col home-buy__col--cant">
              <p className="home-buy__label home-buy__label--cant">{t.home_buy_cant_label}</p>
              <ul className="home-buy__list">
                {t.home_buy_cant.split("|").map((item, i) => (
                  <li key={i} className="home-buy__item home-buy__item--cant">{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Income guide — grouped into one "Could I qualify?" panel */}
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
              {t.home_income_benefit.replace(
                "{max}",
                formatGuideUsd(MAX_BENEFIT_ONE_PERSON),
              )}
            </p>
            <p className="home-income__note">{t.home_income_note}</p>
          </div>

          {/* FAQ — state-rules framing as the spine */}
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
          <a href="/apply" className="btn btn--primary">{t.welcome_cta}</a>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-section__inner">© 2026 Civica</div>
      </footer>
    </div>
  );
}
