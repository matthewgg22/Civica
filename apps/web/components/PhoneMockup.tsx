// iOS-faithful status screen mockup.
// Mirrors CivicaStatusTimeline + SNAPReturningUserHomeView:
//   complete → amberPrimary (#C9922A) fill + checkmark + amber connector
//   current  → wheatPop (#E8C547) fill + solid dot + hairline connector
//   future   → ghost circle + hairline connector (last step has none)
// Layout mirrors the actual view hierarchy:
//   statusBar → header (pageTitle + subtitle) → statusBanner → timeline
export function PhoneMockup() {
  return (
    <div className="phone-mockup" aria-hidden="true">
      <div className="phone-mockup__island" />
      <div className="phone-mockup__screen">
        <div className="phone-card">

          {/* iOS status bar */}
          <div className="phone-statusbar">
            <span className="phone-statusbar__time">9:41</span>
            <span className="phone-statusbar__signals">
              <span className="phone-signal" />
              <span className="phone-signal" />
              <span className="phone-signal phone-signal--wifi" />
              <span className="phone-battery" />
            </span>
          </div>

          {/* Header — mirrors `header` VStack in SNAPReturningUserHomeView */}
          <div className="phone-header">
            <div className="phone-header__title">Your application</div>
            <div className="phone-header__sub">CalFresh · In progress</div>
          </div>

          {/* Status banner — clock.fill icon, pine accent at 0.13 opacity */}
          <div className="phone-banner">
            <svg className="phone-banner__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4zm-.75 2.75a.75.75 0 011.5 0v3.69l2.03 2.03a.75.75 0 11-1.06 1.06l-2.25-2.25A.75.75 0 019.25 11V8.75z"/>
            </svg>
            <div className="phone-banner__copy">
              <div className="phone-banner__title">Waiting for interview</div>
              <div className="phone-banner__sub">Oct 20 · 10:00 AM</div>
            </div>
          </div>

          {/* Timeline — mirrors CivicaStatusTimeline */}
          <div className="phone-timeline">

            {/* Step 1: complete — amberPrimary fill + amber connector */}
            <div className="phone-step">
              <div className="phone-step__rail">
                <div className="phone-step__dot phone-step__dot--done">
                  <svg viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="phone-step__line phone-step__line--done" />
              </div>
              <div className="phone-step__body">
                <div className="phone-step__row">
                  <span className="phone-step__name">Submitted</span>
                  <span className="phone-step__ts">Oct 14</span>
                </div>
                <div className="phone-step__sub">Documents received</div>
              </div>
            </div>

            {/* Step 2: current — wheatPop fill + hairline connector */}
            <div className="phone-step">
              <div className="phone-step__rail">
                <div className="phone-step__dot phone-step__dot--active">
                  <svg viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="2.5" fill="var(--civica-ink)"/>
                  </svg>
                </div>
                <div className="phone-step__line" />
              </div>
              <div className="phone-step__body">
                <div className="phone-step__row">
                  <span className="phone-step__name phone-step__name--bold">Interview</span>
                  <span className="phone-step__ts">Oct 20</span>
                </div>
                <div className="phone-step__sub">10:00 AM · Phone call</div>
              </div>
            </div>

            {/* Step 3: future — ghost circle, no connector */}
            <div className="phone-step">
              <div className="phone-step__rail">
                <div className="phone-step__dot phone-step__dot--future">
                  <svg viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                </div>
              </div>
              <div className="phone-step__body phone-step__body--last">
                <div className="phone-step__row">
                  <span className="phone-step__name phone-step__name--muted">Decision</span>
                  <span className="phone-step__ts phone-step__ts--muted">~30 days</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
