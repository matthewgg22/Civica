"use client";

import type { ReactNode } from "react";
import ProductSwitcher from "./ProductSwitcher";

export type NavTab = { label: string; href: string; active?: boolean };

// Unified nav bar for the applicant portal — mirrors the staff-dashboard
// AppHeader design (wheat logo + Civica wordmark + ProductSwitcher + tabs).
// `tabs` is caller-supplied so the marketing home (What is CalFresh / How it
// works / Apply / Check status) and the in-app status page (My Application /
// Start New) can share one bar with different destinations. `rightSlot` holds
// page-specific chrome (locale toggle, demo badge).
export default function AppNav({
  tabs = [],
  demo = false,
  rightSlot,
  logoHref = "/welcome",
  signIn,
}: {
  tabs?: NavTab[];
  demo?: boolean;
  rightSlot?: ReactNode;
  logoHref?: string;
  // Optional "Sign in" link in the nav bar. Omit on already-authed pages
  // (e.g. status) where a sign-out control is shown instead.
  signIn?: { label: string; href: string };
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
        {signIn && (
          <a href={signIn.href} className="app-nav__signin">
            {signIn.label}
          </a>
        )}
        {demo && <span className="app-nav__demo">Demo data</span>}
      </div>
    </header>
  );
}
