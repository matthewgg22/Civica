// The explainer that leads the page: what SNAP is, what actually decides
// eligibility, why a straight answer is hard to get, and how this tool answers.
//
// SERVER COMPONENT ON PURPOSE. This content exists to be read by people AND by
// generative search engines, and a client-rendered section is invisible to
// crawlers that don't execute JS. Everything here ships in the initial HTML.
//
// NO HARDCODED DOLLAR FIGURES — deliberate, and the single most important rule
// in this file. Income limits, deductions, and allotments change every October
// with the COLA, and they vary by state. The whole product's discipline is that
// numbers come from the verified corpus with a citation attached; a marketing
// page that hardcodes "$2,798 for a household of three" would be the same
// fabrication risk the engine's numeric gate exists to catch, and it would go
// stale on a schedule nobody is watching. So this explains MECHANISMS (what
// changes the answer) and routes every actual number to the chat or the state
// agency, where it arrives cited and current.

import type { PackMeta } from "@civica/demeter-engine/packs";
import {
  FORM_QUESTIONS,
  FORM_QUESTION_I18N,
  type FormQuestion,
} from "@civica/demeter-engine";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { PAGE_COPY } from "../lib/i18n/snap-page";

/** The most form-like phrasing for a topic — the longest one, which is the
 *  closest to how the question is actually printed. Derived rather than
 *  hand-listed so this can never drift from FORM_QUESTIONS. */
export function representativePhrasing(q: FormQuestion): string {
  return [...q.phrasings].sort((a, b) => b.length - a.length)[0] ?? q.topic;
}

/** "household_composition" → "Household composition". */
export function topicLabel(topic: string): string {
  const words = topic.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The FAQ question form used in BOTH the visible section and the JSON-LD, so
 *  a generative engine reads the same wording it would see on the page — in
 *  whichever language that page is.
 *
 *  THE QUOTED PHRASE STAYS ENGLISH, on purpose. The frame around it localizes
 *  ("¿Qué significa …?"), but the phrase itself is the literal text printed on
 *  the form the person is looking at, and most SNAP applications they will
 *  actually be handed are in English. Quoting a translated approximation would
 *  be worse on both counts: it would no longer match anything on their page,
 *  and the "right" translation varies by state, so we would be inventing form
 *  wording rather than reporting it.
 *
 *  Accepted cost: someone searching in Spanish for the Spanish phrasing is less
 *  likely to land here. If translated state applications become a target, the
 *  fix is per-state translated phrasings sourced from the real forms — not a
 *  machine translation of the English. */
export function formQuestionHeading(q: FormQuestion, lang: AnswerLang = "en"): string {
  return PAGE_COPY[lang].faqHeading(representativePhrasing(q));
}

/** The explanation in the reader's language. Falls back to the English source
 *  rather than rendering nothing — but the engine's coverage test makes that
 *  fallback unreachable in a healthy build. */
export function formQuestionAnswer(q: FormQuestion, lang: AnswerLang = "en"): string {
  return lang === "en" ? q.whyAsked : FORM_QUESTION_I18N[q.topic]?.[lang] ?? q.whyAsked;
}

/** The lede — renders ABOVE the chat, so the page explains itself before it
 *  asks for input, without pushing the chat below the fold.
 *
 *  Two columns on wide screens. The right column is not decoration: a
 *  single-column lede left ~740px of the 1180px container empty, which is the
 *  "doesn't fill the page" complaint this rebuild exists to fix — and the
 *  honest thing to put there is what makes the answers trustworthy, stated
 *  plainly enough to be quoted. */
export function SnapLede({ states, lang = "en" }: { states: PackMeta[]; lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  return (
    <section className="dmx dmx--lede" aria-labelledby="what-is-snap">
      <div className="dmx__ledegrid">
        <div>
          <p className="dmx__eyebrow">{c.eyebrow}</p>
          <h2 id="what-is-snap" className="dmx__h2">
            {c.h2}
          </h2>
          <p className="dmx__lede">{c.lede}</p>
        </div>
        <aside className="dmx__trust" aria-label={c.howH2}>
          <dl className="dmx__trustlist">
            {c.trust.map((row, i) => (
              <div className="dmx__trustrow" key={row.t}>
                {/* The third row counts the packs, so its term carries the
                    number and its detail lists the codes — everything else is
                    static copy. */}
                <dt>{i === 2 ? `${states.length} ${row.t}` : row.t}</dt>
                <dd>
                  {i === 2
                    ? `${states.map((s) => s.code).join(" · ")} — ${row.d}`
                    : row.d}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  );
}

/** The depth — renders BELOW the chat. Carries the GEO weight: mechanisms,
 *  differentiation, the form-question FAQ, and every verified state's real
 *  agency, all in server HTML, all in the page's own language. */
export function SnapDetail({ states, lang = "en" }: { states: PackMeta[]; lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  return (
    <>
      <section className="dmx" aria-labelledby="what-decides">
        <h2 id="what-decides" className="dmx__h2">
          {c.decidesH2}
        </h2>
        <p className="dmx__body">{c.decidesBody}</p>
        <dl className="dmx__defs">
          {c.defs.map((d) => (
            <div className="dmx__def" key={d.t}>
              <dt>{d.t}</dt>
              <dd>{d.d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="dmx" aria-labelledby="why-hard">
        <h2 id="why-hard" className="dmx__h2">
          {c.whyHardH2}
        </h2>
        <div className="dmx__grid">
          {c.cards.map((card) => (
            <div className="dmx__card" key={card.t}>
              <h3 className="dmx__h3">{card.t}</h3>
              <p className="dmx__body">{card.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dmx" aria-labelledby="how-answers">
        <h2 id="how-answers" className="dmx__h2">
          {c.howH2}
        </h2>
        <ol className="dmx__steps">
          {c.steps.map((step, i) => (
            <li className="dmx__step" key={step.t}>
              <span className="dmx__num">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="dmx__h3">{step.t}</h3>
                <p className="dmx__body">
                  {step.d}{" "}
                  {i === c.steps.length - 1 ? (
                    <a className="dmx__link" href={lang === "en" ? "/verify" : `/${lang}/verify`}>
                      {c.verifyLink}
                    </a>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* The questions the FORM asks, decoded. Rendered from FORM_QUESTIONS —
          the same vetted, citation-backed entries the chat routes on — so this
          section and the engine can never disagree, and neither can this and
          the JSON-LD (both call formQuestionHeading()).

          This is the page's GEO core. It is the content a generative engine is
          most likely to quote, because it answers the literal question someone
          types, and every entry names the governing rule. None of it carries a
          dollar figure, so it does not rot at the October COLA. */}
      <section className="dmx" aria-labelledby="form-questions">
        <h2 id="form-questions" className="dmx__h2">
          {c.faqH2}
        </h2>
        <p className="dmx__body">{c.faqBody}</p>
        <dl className="dmx__faq">
          {FORM_QUESTIONS.map((q) => (
            <div className="dmx__faqitem" key={q.topic}>
              <dt className="dmx__faqq">
                <span className="dmx__faqtopic">{topicLabel(q.topic)}</span>
                {formQuestionHeading(q, lang)}
              </dt>
              <dd className="dmx__faqa">
                {formQuestionAnswer(q, lang)}
                {/* Citations render separately and VERBATIM — never translated,
                    the same rule the answer pipeline follows. */}
                <span className="dmx__faqcite">{q.citation}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="dmx" aria-labelledby="agencies">
        <h2 id="agencies" className="dmx__h2">
          {c.agenciesH2}
        </h2>
        <p className="dmx__body">{c.agenciesBody}</p>
        <ul className="dmx__agencies">
          {states.map((s) => (
            <li key={s.code} className="dmx__agency">
              <span className="dmx__agency-code">{s.code}</span>
              <span className="dmx__agency-body">
                <span className="dmx__agency-program">{s.program}</span>
                <span className="dmx__agency-name">{s.agency}</span>
                {s.portal ? (
                  <a
                    className="dmx__link"
                    href={s.portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.portal.name}
                  </a>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="dmx__note">{c.agenciesNote}</p>
      </section>
    </>
  );
}
