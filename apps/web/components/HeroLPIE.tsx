import type { Copy } from "../app/i18n";
import { TestFlightCTA } from "./TestFlightCTA";

export function HeroLPIE({ copy }: { copy: Copy }) {
  return (
    <section className="hero">
      <div className="container container--hero">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="hero__headline">{copy.heroHeadline}</h1>
        <p className="hero__sub">{copy.heroSub}</p>
        <div className="cta-row">
          <a className="btn btn--primary" href="#lead-capture">
            {copy.ctaQualify} →
          </a>
          <TestFlightCTA label={copy.ctaTestFlight} />
        </div>
      </div>
    </section>
  );
}
