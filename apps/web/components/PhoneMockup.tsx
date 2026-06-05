// iPhone 15 Pro-style mockup — matches SNAPReturningUserHomeView layout.
// The frame uses side buttons + dynamic island to read as "iPhone" instantly.
export function PhoneMockup() {
  return (
    <div className="iphone">
      {/* Side buttons — volume up, volume down (left), power (right) */}
      <div className="iphone__btn iphone__btn--vol-up" />
      <div className="iphone__btn iphone__btn--vol-dn" />
      <div className="iphone__btn iphone__btn--power" />

      {/* Screen bezel */}
      <div className="iphone__bezel">
        {/* Dynamic Island */}
        <div className="iphone__island" />

        {/* Status bar */}
        <div className="iphone__statusbar">
          <span className="iphone__time">9:41</span>
          <span className="iphone__status-icons">
            <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
              <rect x="0" y="5" width="3" height="6" rx="0.8" opacity="0.3"/>
              <rect x="4.5" y="3" width="3" height="8" rx="0.8" opacity="0.5"/>
              <rect x="9" y="1" width="3" height="10" rx="0.8" opacity="0.75"/>
              <rect x="13.5" y="0" width="3" height="11" rx="0.8"/>
            </svg>
            <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
              <path d="M8 1.5C9.8 1.5 11.4 2.2 12.6 3.3L14 1.9C12.4 0.7 10.3 0 8 0C5.7 0 3.6 0.7 2 1.9L3.4 3.3C4.6 2.2 6.2 1.5 8 1.5Z" fill="currentColor"/>
              <path d="M8 4C9.1 4 10.1 4.4 10.9 5.1L12.3 3.7C11.1 2.6 9.6 2 8 2C6.4 2 4.9 2.6 3.7 3.7L5.1 5.1C5.9 4.4 6.9 4 8 4Z" fill="currentColor"/>
              <circle cx="8" cy="7" r="1.2" fill="currentColor"/>
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
              <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor" strokeOpacity="0.35"/>
              <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor"/>
              <path d="M23 4.5v3a1.5 1.5 0 000-3z" fill="currentColor" fillOpacity="0.4"/>
            </svg>
          </span>
        </div>

        {/* Navigation bar */}
        <div className="iphone__nav">
          <span className="iphone__nav-back">
            <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
              <path d="M7 1L1.5 6.5L7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </span>
          <span className="iphone__nav-title">Civica</span>
          <span style={{width: 44}} />
        </div>

        {/* App content */}
        <div className="iphone__content">
          {/* Page header */}
          <div className="iphone__page-header">
            <div className="iphone__page-title">Your application</div>
            <div className="iphone__page-sub">CalFresh · In progress</div>
          </div>

          {/* Status banner */}
          <div className="iphone__banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink: 0, color: '#2d5a45'}}>
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm.5-13H11v6l4.8 2.9.7-1.2-4-2.3V7z"/>
            </svg>
            <div>
              <div className="iphone__banner-title">Interview scheduled</div>
              <div className="iphone__banner-sub">Oct 20 · 10:00 AM</div>
            </div>
          </div>

          {/* Timeline */}
          <div className="iphone__timeline">
            {/* Step 1 — complete */}
            <div className="iphone__step">
              <div className="iphone__step-rail">
                <div className="iphone__marker iphone__marker--done">
                  <svg viewBox="0 0 14 14" fill="none" width="14" height="14">
                    <path d="M3 7l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="iphone__connector iphone__connector--done" />
              </div>
              <div className="iphone__step-body">
                <div className="iphone__step-row">
                  <span className="iphone__step-name">Submitted</span>
                  <span className="iphone__step-ts">Oct 14</span>
                </div>
                <div className="iphone__step-detail">Documents received</div>
              </div>
            </div>

            {/* Step 2 — current */}
            <div className="iphone__step">
              <div className="iphone__step-rail">
                <div className="iphone__marker iphone__marker--active">
                  <svg viewBox="0 0 14 14" fill="none" width="14" height="14">
                    <circle cx="7" cy="7" r="3.5" fill="#1a1714"/>
                  </svg>
                </div>
                <div className="iphone__connector" />
              </div>
              <div className="iphone__step-body">
                <div className="iphone__step-row">
                  <span className="iphone__step-name" style={{fontWeight: 700}}>Interview</span>
                  <span className="iphone__step-ts">Oct 20</span>
                </div>
                <div className="iphone__step-detail">10:00 AM · Phone call</div>
              </div>
            </div>

            {/* Step 3 — future */}
            <div className="iphone__step">
              <div className="iphone__step-rail">
                <div className="iphone__marker iphone__marker--future">
                  <svg viewBox="0 0 14 14" fill="none" width="14" height="14">
                    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                </div>
              </div>
              <div className="iphone__step-body iphone__step-body--last">
                <div className="iphone__step-row">
                  <span className="iphone__step-name" style={{color: '#5a544d'}}>Decision</span>
                  <span className="iphone__step-ts" style={{opacity: 0.5}}>~30 days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="iphone__cta">Continue application</div>
        </div>

        {/* Home indicator */}
        <div className="iphone__home-indicator" />
      </div>
    </div>
  );
}
