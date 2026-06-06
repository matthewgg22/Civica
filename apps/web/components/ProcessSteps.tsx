import type { Copy } from "../app/i18n";

export function ProcessSteps({ copy }: { copy: Copy }) {
  const steps = [
    { num: "1", title: copy.step1Title, body: copy.step1Body },
    { num: "2", title: copy.step2Title, body: copy.step2Body },
    { num: "3", title: copy.step3Title, body: copy.step3Body },
  ];

  return (
    <section className="process-section">
      <div className="container">
        <p className="process-section__eyebrow">{copy.processTitle}</p>
        <div className="process-grid">
          {steps.map((step) => (
            <div className="process-card" key={step.num}>
              <div className="process-number" aria-hidden="true">{step.num}</div>
              <h3 className="process-card__title">{step.title}</h3>
              <p className="process-card__body">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
