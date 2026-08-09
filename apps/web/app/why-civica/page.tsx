"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AppNav from "../../components/AppNav";
import { LanguagePicker } from "../../components/LanguagePicker";
import { StaticGeminiHero } from "../../components/StaticGeminiHero";
import { STORAGE_KEY, LOCALES, type Locale } from "../i18n";
import { welcomeStrings } from "../../lib/i18n/snap-copy";

const TESTFLIGHT_URL =
  process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? "https://testflight.apple.com/";

// The animated hero is the only consumer of framer-motion. Load it lazily so
// the page shell (nav, copy, cards, CTA) paints before the motion chunk arrives;
// until then we show the motion-free StaticGeminiHero.
const WhyCivicaHero = dynamic(() => import("../../components/WhyCivicaHero"), {
  ssr: false,
  loading: () => <StaticGeminiHero />,
});

export default function WhyCivicaPage() {
  const [locale, setLocale] = useState<Locale>("en");
  // Render the motion-free StaticGeminiHero on the server and on first paint so
  // the lines are visible immediately (no blank flash), then upgrade to the
  // animated scroll hero once mounted on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (LOCALES as string[]).includes(saved)) setLocale(saved as Locale);
    } catch {
      /* localStorage disabled */
    }
  }, []);

  function changeLocale(next: Locale) {
    setLocale(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const t = welcomeStrings[locale];

  return (
    <div className="home">
      <AppNav
        rightSlot={
          <LanguagePicker locale={locale} onChange={changeLocale} ariaLabel="Choose language" />
        }
        tabs={[
          { label: t.home_nav_what, href: "/welcome#what-is-snap" },
          { label: t.home_nav_why, href: "/why-civica", active: true },
        ]}
        primaryCta={{
          label: t.home_nav_apply,
          href: "/apply",
          menu: [
            { label: t.home_nav_signin, href: "/sign-in" },
            {
              label: t.home_app_cta,
              href: TESTFLIGHT_URL,
              iconSrc: "/civica-app-icon.png",
              external: true,
            },
          ],
        }}
      />

      <main>
        {mounted ? <WhyCivicaHero /> : <StaticGeminiHero />}

        {/* Feature cards */}
        <section className="why-features section">
          <div className="container">
            <p className="eyebrow">How it helps</p>
            <h2 className="section__title">Built to remove every obstacle</h2>
            <p className="section__body">
              Civica combines AI guidance, peer support, and trusted CBO expertise — so you
              arrive at your application confident in every answer.
            </p>

            <div className="why-feature-cards">
              {/* Mae */}
              <div className="why-feature-card">
                <div className="why-feature-card__top">
                  <span className="why-feature-card__num">01</span>
                  <span className="why-feature-card__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M7 16l2.5-5 2.5 3.5 2.5-5L17 16"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                <h3 className="why-feature-card__title">Demeter, your AI guide</h3>
                <p className="why-feature-card__text">
                  Ask Demeter any eligibility question — income limits, deductions, what documents
                  to bring — in plain language, before you ever touch the form. No jargon,
                  no guessing.
                </p>
              </div>

              {/* Buddy */}
              <div className="why-feature-card">
                <div className="why-feature-card__top">
                  <span className="why-feature-card__num">02</span>
                  <span className="why-feature-card__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="17" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M3 20c0-3 2.7-5.5 6-5.5h6c3.3 0 6 2.5 6 5.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </div>
                <h3 className="why-feature-card__title">The Buddy system</h3>
                <p className="why-feature-card__text">
                  Get matched with someone who has already navigated the process. Real
                  guidance from a peer — at the exact moment you need it most.
                </p>
              </div>

              {/* Recommendations */}
              <div className="why-feature-card">
                <div className="why-feature-card__top">
                  <span className="why-feature-card__num">03</span>
                  <span className="why-feature-card__icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M7 12h10M7 8h6M7 16h8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </div>
                <h3 className="why-feature-card__title">Personalized recommendations</h3>
                <p className="why-feature-card__text">
                  Based on your household profile, the app and your local CBO surface the
                  specific benefits, programs, and services you actually qualify for — not a
                  generic list.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* One connected system */}
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
                <p className="ecosystem-card__body">A trained navigator at a partner org reviews your application before it&rsquo;s filed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section why-cta-section">
          <div className="container why-cta-inner">
            <h2 className="section__title">Ready to find out what you qualify for?</h2>
            <p className="section__body">Takes about 10 minutes. Free, confidential, no account required.</p>
            <div className="cta-row" style={{ marginTop: "var(--civica-space-xl)" }}>
              <a href="/apply" className="btn btn--primary">
                Check my eligibility
              </a>
              <a href="/welcome" className="btn btn--secondary">
                Back to home
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container home-footer__inner">
          <span>© 2026 Civica</span>
          <a className="home-footer__link" href="/privacy">Privacy Policy</a>
        </div>
      </footer>
    </div>
  );
}
