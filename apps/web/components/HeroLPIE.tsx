import type { Copy } from "../app/i18n";

export function HeroLPIE({ copy }: { copy: Copy }) {
  return (
    <section className="hero">
      <div className="container container--hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="hero__headline">{copy.heroHeadline}</h1>
        <p className="hero__sub">{copy.heroSub}</p>
        <div className="cta-row">
          <a className="btn btn--primary" href="/welcome">
            {copy.ctaStartApplication} →
          </a>
          <a className="btn btn--secondary" href="#lead-capture">
            {copy.ctaQualify}
          </a>
        </div>
      </div>
    </section>
  );
}
