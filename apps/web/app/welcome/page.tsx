"use client";

import { useEffect, useState } from "react";
import AppNav from "../../components/AppNav";
import { LanguagePicker } from "../../components/LanguagePicker";
import { PhoneMockup } from "../../components/PhoneMockup";
import { BenefitEstimator } from "../../components/BenefitEstimator";
import { MaeHelpButton } from "../../components/MaeHelpButton";
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
        {/* Treated Van Gogh wheatfield background — blurred, gently drifting */}
        <div className="hero-art" aria-hidden="true">
          <div className="bs-drift"><div className="bs-img" /></div>
          <div className="bs-tint" />
          <div className="bs-scrim" />
        </div>
        <div className="home-hero__inner hero__grid">
          <div className="hero__col hero__col--copy">
            {/* USDA SNAP trust badge */}
            <a
              className="usda-badge"
              href="https://www.fns.usda.gov/snap/supplemental-nutrition-assistance-program"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg className="usda-badge__shield" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              USDA SNAP — Federal Program
            </a>
            <p className="home-hero__eyebrow">{t.home_hero_eyebrow}</p>
            <p className="home-hero__snap-note">Supplemental Nutrition Assistance Program · formerly known as Food Stamps</p>
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
            <PhoneMockup />
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
                <div className="home-find__map" aria-hidden="true">
                  <span className="home-find__pin home-find__pin--food" data-label="Grocery store">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z" /><circle cx="12" cy="9" r="2.6" fill="#fff" /></svg>
                  </span>
                  <span className="home-find__pin home-find__pin--ebt" data-label="EBT accepted">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z" /><circle cx="12" cy="9" r="2.6" fill="#fff" /></svg>
                  </span>
                  <span className="home-find__pin home-find__pin--meal" data-label="Free meals">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z" /><circle cx="12" cy="9" r="2.6" fill="#fff" /></svg>
                  </span>
                  <span className="home-find__you" />
                </div>
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

      {/* Mae — own section, clearly separated from FAQ */}
      <section className="home-section home-section--mae">
        <div className="home-section__inner">
          <div className="faq-mae-cta">
            <p className="faq-mae-cta__heading">Any other questions?</p>
            <p className="faq-mae-cta__body">
              Ask Demeter — Civica&rsquo;s AI guide trained on federal SNAP regulations, real application experiences, and caseworker review.
            </p>
            <button
              type="button"
              className="faq-mae-cta__btn"
              onClick={() => (document.querySelector('.mae-fab') as HTMLButtonElement)?.click()}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 5.5c0-1.1.9-2 2-2s2 .9 2 2c0 .9-.6 1.6-1.5 1.9V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="7" cy="10.5" r=".75" fill="currentColor"/>
              </svg>
              Ask Demeter
            </button>
            <p className="faq-mae-cta__disclaimer">
              Demeter&rsquo;s answers are based on federal SNAP citations (7 CFR 273), real application experiences, and caseworker review — but may occasionally be incorrect. Always confirm eligibility with your county office. We flag uncertainty and cite sources where possible.
            </p>
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
        <div className="home-section__inner home-footer__inner">
          <span>© 2026 Civica</span>
          <a className="home-footer__link" href="/privacy">Privacy Policy</a>
        </div>
      </footer>

      {/* Mae floating help button — visible on all sections */}
      <MaeHelpButton />
    </div>
  );
}
