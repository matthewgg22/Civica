"use client";

import type { ReactNode } from "react";
import ProductSwitcher from "./ProductSwitcher";

export type NavTab = { label: string; href: string; active?: boolean };

// One item in the primary-CTA dropdown (secondary actions: sign in, get the app).
export type NavMenuItem = {
  label: string;
  href: string;
  iconSrc?: string;
  external?: boolean;
};

// The dominant right-aligned call to action + an optional dropdown of
// secondary actions, mirroring the Anthropic header pattern (primary button
// far right, chevron reveals the rest). Adopts the pattern, not the styling —
// the CTA stays Civica pine, not a black pill.
export type NavPrimaryCta = {
  label: string;
  href: string;
  menu?: NavMenuItem[];
  menuLabel?: string; // accessible label for the chevron toggle
};

// Unified nav bar for the applicant portal — mirrors the staff-dashboard
// AppHeader design (wheat logo + Civica wordmark + ProductSwitcher + tabs).
// `tabs` is caller-supplied so the marketing home and the in-app status page
// can share one bar with different destinations. `rightSlot` holds page-specific
// chrome (locale toggle, demo badge). `primaryCta` is the dominant action.
export default function AppNav({
  tabs = [],
  demo = false,
  rightSlot,
  logoHref = "/welcome",
  primaryCta,
}: {
  tabs?: NavTab[];
  demo?: boolean;
  rightSlot?: ReactNode;
  logoHref?: string;
  primaryCta?: NavPrimaryCta;
}) {
  return (
    <header className="app-nav">
      <div className="app-nav__left">
        <a href={logoHref} className="app-nav__logo" aria-label="Civica home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/civica-wheat-mark.png" alt="Civica" width={50} height={50} />
        </a>
        <div className="app-nav__brand-block">
          <a href={logoHref} className="app-nav__brand">Civica</a>
          <ProductSwitcher current="Applicant Portal" />
        </div>
        {tabs.length > 0 && (
          <nav className="app-nav__tabs" aria-label="Sections">
            {tabs.map((tab) => (
              <a
                key={tab.label}
                href={tab.href}
                className={`app-nav__tab ${tab.active ? "app-nav__tab--active" : ""}`}
              >
                {tab.label}
              </a>
            ))}
          </nav>
        )}
      </div>
      <div className="app-nav__right">
        {rightSlot}
        {demo && <span className="app-nav__demo">Demo data</span>}
        {primaryCta && (
          <div className="app-nav__cta-group">
            <a href={primaryCta.href} className="app-nav__cta">
              {primaryCta.label}
            </a>
            {primaryCta.menu && primaryCta.menu.length > 0 && (
              // Native <details> — keyboard- and screen-reader-correct with no
              // JS, robust on low-end Android browsers.
              <details className="app-nav__menu">
                <summary
                  className="app-nav__menu-trigger"
                  aria-label={primaryCta.menuLabel ?? "More options"}
                >
                  <span aria-hidden="true" className="app-nav__chevron">▾</span>
                </summary>
                <div className="app-nav__menu-panel" role="menu">
                  {primaryCta.menu.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className="app-nav__menu-item"
                      role="menuitem"
                      {...(item.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {item.iconSrc && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.iconSrc}
                          alt=""
                          width={20}
                          height={20}
                          className="app-nav__menu-icon"
                        />
                      )}
                      {item.label}
                    </a>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
