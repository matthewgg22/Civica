import type { Copy } from "../app/i18n";
import { PhoneMockup } from "./PhoneMockup";

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
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
