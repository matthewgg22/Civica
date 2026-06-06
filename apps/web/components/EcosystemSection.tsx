import type { Copy } from "../app/i18n";

export function EcosystemSection({ copy }: { copy: Copy }) {
  return (
    <section className="ecosystem-section">
      <div className="container">
        <h2 className="ecosystem-section__title">{copy.ecosystemTitle}</h2>
        <p className="ecosystem-section__sub">{copy.ecosystemSub}</p>
        <div className="ecosystem-grid">
          <div className="ecosystem-card ecosystem-card--tinted">
            <div className="ecosystem-card__icon" aria-hidden="true">📱</div>
            <h3 className="ecosystem-card__title">{copy.ecosystemIOSTitle}</h3>
            <p className="ecosystem-card__body">{copy.ecosystemIOSBody}</p>
          </div>
          <div className="ecosystem-arrow" aria-hidden="true">↔</div>
          <div className="ecosystem-card">
            <div className="ecosystem-card__icon" aria-hidden="true">🌐</div>
            <h3 className="ecosystem-card__title">{copy.ecosystemWebTitle}</h3>
            <p className="ecosystem-card__body">{copy.ecosystemWebBody}</p>
          </div>
          <div className="ecosystem-arrow" aria-hidden="true">↔</div>
          <div className="ecosystem-card ecosystem-card--tinted">
            <div className="ecosystem-card__icon" aria-hidden="true">🏢</div>
            <h3 className="ecosystem-card__title">{copy.ecosystemCBOTitle}</h3>
            <p className="ecosystem-card__body">{copy.ecosystemCBOBody}</p>
          </div>
        </div>
        <p className="ecosystem-section__footnote">{copy.ecosystemFootnote}</p>
      </div>
    </section>
  );
}
