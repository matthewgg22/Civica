// iOS status screen mockup — mirrors SNAPReturningUserHomeView + CivicaStatusTimeline.
// Designed to read cleanly at ~260px render width.
// All px sizes are absolute so they don't inherit from the 17px root.
export function PhoneMockup() {
  return (
    <div className="pm">
      {/* Phone frame */}
      <div className="pm__island" />
      <div className="pm__screen">

        {/* Status bar */}
        <div className="pm__statusbar">
          <span className="pm__time">9:41</span>
          <span className="pm__icons">
            <svg width="15" height="10" viewBox="0 0 15 10" fill="none">
              <rect x="0" y="4" width="2" height="6" rx="0.5" fill="currentColor" opacity="0.4"/>
              <rect x="3" y="2.5" width="2" height="7.5" rx="0.5" fill="currentColor" opacity="0.6"/>
              <rect x="6" y="1" width="2" height="9" rx="0.5" fill="currentColor" opacity="0.8"/>
              <rect x="9" y="0" width="2" height="10" rx="0.5" fill="currentColor"/>
            </svg>
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
              <rect x="0.75" y="0.75" width="13.5" height="9.5" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.35"/>
              <rect x="2" y="2" width="9" height="7" rx="1" fill="currentColor"/>
              <path d="M15 4.5v2a1 1 0 000-2z" fill="currentColor" opacity="0.4"/>
            </svg>
          </span>
        </div>

        {/* Nav title — inline style mirrors .navigationBarTitleDisplayMode(.inline) */}
        <div className="pm__nav">
          <span className="pm__nav-back">‹ Back</span>
          <span className="pm__nav-title">Civica</span>
          <span className="pm__nav-spacer" />
        </div>

        {/* Page header — mirrors SNAPReturningUserHomeView `header` */}
        <div className="pm__header">
          <div className="pm__header-title">Your application</div>
          <div className="pm__header-sub">CalFresh · In progress</div>
        </div>

        {/* Status banner — pine accent at 13% opacity, clock icon */}
        <div className="pm__banner">
          <svg className="pm__banner-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm.5-13H11v6l4.8 2.9.7-1.2-4-2.3V7z"/>
          </svg>
          <div>
            <div className="pm__banner-title">Interview scheduled</div>
            <div className="pm__banner-sub">Oct 20 · 10:00 AM · Phone call</div>
          </div>
        </div>

        {/* Timeline — mirrors CivicaStatusTimeline */}
        <div className="pm__timeline">

          {/* Step 1 — complete: amberPrimary #C9922A */}
          <div className="pm__step">
            <div className="pm__rail">
              <div className="pm__dot pm__dot--done">
                <svg viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="pm__line pm__line--done" />
            </div>
            <div className="pm__body">
              <div className="pm__row">
                <span className="pm__name">Submitted</span>
                <span className="pm__ts">Oct 14</span>
              </div>
              <div className="pm__detail">Documents received</div>
            </div>
          </div>

          {/* Step 2 — current: wheatPop #E8C547 */}
          <div className="pm__step">
            <div className="pm__rail">
              <div className="pm__dot pm__dot--active">
                <svg viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="3" fill="var(--civica-ink)"/>
                </svg>
              </div>
              <div className="pm__line" />
            </div>
            <div className="pm__body">
              <div className="pm__row">
                <span className="pm__name pm__name--bold">Interview</span>
                <span className="pm__ts">Oct 20</span>
              </div>
              <div className="pm__detail">10:00 AM · Phone call</div>
            </div>
          </div>

          {/* Step 3 — future: ghost circle */}
          <div className="pm__step">
            <div className="pm__rail">
              <div className="pm__dot pm__dot--future">
                <svg viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              </div>
            </div>
            <div className="pm__body pm__body--last">
              <div className="pm__row">
                <span className="pm__name pm__name--muted">Decision</span>
                <span className="pm__ts pm__ts--muted">~30 days</span>
              </div>
            </div>
          </div>

        </div>

        {/* Primary CTA — mirrors CivicaPrimaryButton */}
        <div className="pm__cta">
          <div className="pm__cta-btn">Continue application</div>
        </div>

      </div>
    </div>
  );
}
