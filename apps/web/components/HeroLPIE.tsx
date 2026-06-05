import type { Copy } from "../app/i18n";

export function HeroLPIE({ copy }: { copy: Copy }) {
  return (
    <section className="hero">
      <div className="container container--hero hero__grid">
        <div className="hero__col hero__col--copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="hero__headline">{copy.heroHeadline}</h1>
          <p className="hero__sub">{copy.heroSub}</p>
          <div className="trust-chips" role="list">
            <span className="trust-chip" role="listitem">{copy.trustChipUSDA}</span>
            <span className="trust-chip" role="listitem">{copy.trustChipCBO}</span>
            <span className="trust-chip" role="listitem">{copy.trustChipStudents}</span>
          </div>
          <div className="cta-row">
            <a className="btn btn--primary" href="/welcome">
              {copy.ctaCheckQualify}
            </a>
          </div>
          <a className="hero__secondary" href="/sign-in">
            {copy.ctaAlreadyApplied}
          </a>
        </div>

        <div className="hero__col hero__col--visual" aria-hidden="true">
          <div className="hero__watermark">$292</div>
          <div className="phone-mockup">
            <div className="phone-mockup__notch" />
            <div className="phone-mockup__screen">
              <div className="phone-card">
                <div className="phone-card__header">
                  <span className="phone-card__label">MY APPLICATION</span>
                </div>
                <div className="phone-card__body">
                  <div className="phone-card__title">CalFresh Status</div>
                  <div className="phone-card__badge">
                    <span className="phone-card__dot" />
                    In Review
                  </div>
                  <div className="phone-card__progress-row">
                    <div className="phone-card__progress-bar">
                      <div className="phone-card__progress-fill" style={{ width: "62%" }} />
                    </div>
                    <span className="phone-card__progress-pct">62%</span>
                  </div>
                  <div className="phone-card__timeline">
                    <div className="phone-card__event phone-card__event--done">
                      <span className="phone-card__check">✓</span>
                      <div>
                        <div className="phone-card__event-title">Submitted Oct 14</div>
                      </div>
                    </div>
                    <div className="phone-card__event phone-card__event--active">
                      <span className="phone-card__dot-sm" />
                      <div>
                        <div className="phone-card__event-title">Interview scheduled</div>
                        <div className="phone-card__event-sub">Oct 20 at 10:00 AM</div>
                      </div>
                    </div>
                    <div className="phone-card__event">
                      <span className="phone-card__check phone-card__check--muted">✓</span>
                      <div>
                        <div className="phone-card__event-title">Documents received</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
