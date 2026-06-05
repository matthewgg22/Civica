"use client";

import { useScroll, useTransform } from "motion/react";
import React from "react";
import { GoogleGeminiEffect } from "../../components/ui/google-gemini-effect";

export default function WhyCivicaPage() {
  const ref = React.useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Staggered cascade: outer paths lead, inner paths trail slightly
  const p1 = useTransform(scrollYProgress, [0, 0.8], [0.20, 1.2]);
  const p2 = useTransform(scrollYProgress, [0, 0.8], [0.17, 1.2]);
  const p3 = useTransform(scrollYProgress, [0, 0.8], [0.14, 1.2]);
  const p4 = useTransform(scrollYProgress, [0, 0.8], [0.11, 1.2]);
  const p5 = useTransform(scrollYProgress, [0, 0.8], [0.08, 1.2]);
  const p6 = useTransform(scrollYProgress, [0, 0.8], [0.05, 1.2]);
  const p7 = useTransform(scrollYProgress, [0, 0.8], [0.02, 1.2]);
  const p8 = useTransform(scrollYProgress, [0, 0.8], [0.00, 1.2]);

  return (
    <div className="page">
      <header className="site-header">
        <div className="container site-header__inner">
          <a className="brand" href="/">
            Civica
          </a>
          <nav className="site-nav" aria-label="Main">
            <a className="site-nav__link site-nav__link--active" href="/why-civica">
              Why Civica
            </a>
          </nav>
          <div className="site-header__actions">
            <a className="site-header__signin" href="/sign-in">
              Sign in
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Scroll-driven Gemini hero */}
        <div className="why-gemini-scroll" ref={ref}>
          <div className="why-gemini-sticky">
            <div className="container why-gemini-copy">
              <p className="eyebrow">Why Civica</p>
              <h1 className="why-gemini-headline">
                The rules are complicated.
                <br />
                Your application shouldn&rsquo;t be.
              </h1>
              <p className="why-gemini-sub">
                SNAP eligibility depends on income, household size, and rules that vary
                state&nbsp;by&nbsp;state. Civica walks you through every question — so you
                arrive at your application confident in every answer.
              </p>
            </div>

            <GoogleGeminiEffect
              pathLengths={[p1, p2, p3, p4, p5, p6, p7, p8]}
            />

            <div className="why-gemini-scroll-hint" aria-hidden="true">
              <span>Scroll to explore</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 2v10M3 8l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

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
                <div className="why-feature-card__icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M7 16l2.5-5 2.5 3.5 2.5-5L17 16"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="why-feature-card__title">Mae, your AI guide</h3>
                  <p className="why-feature-card__text">
                    Ask Mae any eligibility question — income limits, deductions, what documents
                    to bring — in plain language, before you ever touch the form. No jargon,
                    no guessing.
                  </p>
                </div>
              </div>

              {/* Buddy */}
              <div className="why-feature-card">
                <div className="why-feature-card__icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="17" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M3 20c0-3 2.7-5.5 6-5.5h6c3.3 0 6 2.5 6 5.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="why-feature-card__title">The Buddy system</h3>
                  <p className="why-feature-card__text">
                    Get matched with someone who has already navigated the process. Real
                    guidance from a peer — at the exact moment you need it most.
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              <div className="why-feature-card">
                <div className="why-feature-card__icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
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
                </div>
                <div>
                  <h3 className="why-feature-card__title">Personalized recommendations</h3>
                  <p className="why-feature-card__text">
                    Based on your household profile, the app and your local CBO surface the
                    specific benefits, programs, and services you actually qualify for — not a
                    generic list.
                  </p>
                </div>
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
              <a href="/" className="btn btn--secondary">
                Back to home
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">© 2026 Civica</div>
      </footer>
    </div>
  );
}
