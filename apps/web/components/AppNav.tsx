"use client";

import ProductSwitcher from "./ProductSwitcher";

// Unified nav bar for the applicant portal — mirrors the staff-dashboard
// AppHeader design (wheat logo + Civica wordmark + ProductSwitcher + tabs).
// `demo` keeps the ?demo=1 flag on internal links so the public demo flow
// never bounces to sign-in.
export default function AppNav({ demo = false }: { demo?: boolean }) {
  const statusHref = demo ? "/status?demo=1" : "/status";
  return (
    <header className="app-nav">
      <div className="app-nav__left">
        <a href="/" className="app-nav__logo" aria-label="Civica home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/civica-wheat-mark.png" alt="Civica" width={44} height={44} />
        </a>
        <div className="app-nav__brand-block">
          <a href="/" className="app-nav__brand">Civica</a>
          <ProductSwitcher current="Applicant Portal" />
        </div>
        <nav className="app-nav__tabs" aria-label="Sections">
          <a href={statusHref} className="app-nav__tab app-nav__tab--active">My Application</a>
          <a href="/apply" className="app-nav__tab">Start New</a>
        </nav>
      </div>
      <div className="app-nav__right">
        {demo && <span className="app-nav__demo">Demo</span>}
      </div>
    </header>
  );
}
