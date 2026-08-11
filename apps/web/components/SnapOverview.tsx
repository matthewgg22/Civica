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
/** THE ORIENTATION BAR — the top of the page and its only <h1>.
 *
 *  Replaces SnapLede, which opened the page with an <h2> about SNAP and left
 *  the product unnamed until the chat card's own <h1> 120 words later. That put
 *  an <h2> BEFORE the <h1> in document order: an inverted heading hierarchy
 *  that failed screen readers and told search engines the page was a SNAP
 *  explainer containing a chatbot, rather than a product that answers SNAP
 *  questions.
 *
 *  ~45 words, two statements, product first. Category research settled the
 *  order: GetCalFresh leads with comprehension because it gave the application
 *  away to BenefitsCal and comprehension is all it still owns; mRelief and
 *  Consensus both own their tool and both put it at the top. Demeter owns the
 *  answering, so it belongs in the second group.
 *
 *  The four trust rows that used to sit here moved BELOW the chat (SnapDetail).
 *  Not deleted — every word is still server-rendered on this URL. They are
 *  credibility, and credibility is what you read after you see the thing, not
 *  the wall you climb to reach it. */
export function SnapOrientation({
  lang = "en",
  states = [],
}: {
  lang?: AnswerLang;
  states?: PackMeta[];
}) {
  const c = PAGE_COPY[lang];
  return (
    // TWO COLUMNS. Measured at 1440: a single left-aligned column left 579px of
    // the 1180px container empty — 49% of the page width, at the very top.
    // Uniform emptiness is the strongest "generated page" tell there is, and it
    // was the largest single contributor to this page reading as slop.
    //
    // The right column is not filler. Verified-state monograms are the one
    // claim on this page that is countable and checkable, and they answer the
    // question a first-time visitor actually has — "does this know about MY
    // state?" — at a glance, before any prose.
    <section className="dmo" aria-labelledby="demeter-h1">
      <div className="dmo__text">
        <p className="dmo__eyebrow">{c.eyebrow}</p>
        <h1 id="demeter-h1" className="dmo__h1">
          {c.h1}
        </h1>
        <p className="dmo__lede">{c.productLede}</p>
        <p className="dmo__snap">{c.snapLine}</p>
      </div>
      {states.length > 0 && (
        <aside className="dmo__states" aria-label={c.trust[2]?.t}>
          <p className="dmo__states-label">
            {states.length} {c.trust[2]?.t}
          </p>
          <ul className="dmo__states-grid">
            {states.map((s) => (
              <li key={s.code}>
                <span className="dmst__mark">{s.code}</span>
              </li>
            ))}
          </ul>
          <p className="dmo__states-note">{c.trust[3]?.d}</p>
        </aside>
      )}
    </section>
  );
}

/** The depth — renders BELOW the chat. Carries the GEO weight: what the trust
 *  claims actually mean, what decides eligibility, how answers are produced,
 *  and every verified state's real agency. All server HTML, all in the page's
 *  own language.
 *
 *  Two sections left here for /questions (SnapFormQuestions + SnapWhyHard):
 *  the 17 form-question cards were the single largest block on the page at
 *  ~635 words, and "why a straight answer is hard to find" is the natural
 *  introduction to them. Moved rather than cut — the words stay indexable, on
 *  a page that is ABOUT them. This page went from ~1,300 words of static copy
 *  to ~600, and the chat from ~15% page depth to immediately under a 45-word
 *  bar. */
export function SnapDetail({ states, lang = "en" }: { states: PackMeta[]; lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  return (
    <>
      {/* Trust, relocated from the old lede. Same four claims, same words. */}
      <section className="dmx" aria-labelledby="why-trust">
        <h2 id="why-trust" className="dmx__h2">
          {c.trustH2}
        </h2>
        <dl className="dmx__trustlist dmx__trustlist--wide">
          {c.trust.map((row, i) => (
            <div className="dmx__trustrow" key={row.t}>
              {/* The third row counts the packs, so its term carries the
                  number and its detail lists the codes — everything else is
                  static copy. */}
              <dt>{i === 2 ? `${states.length} ${row.t}` : row.t}</dt>
              <dd>
                {i === 2 ? `${states.map((s) => s.code).join(" · ")} — ${row.d}` : row.d}
              </dd>
            </div>
          ))}
        </dl>
      </section>

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

      {/* The one internal link out. The form-question cards are the content a
          generative engine is most likely to quote, so they need a crawlable
          path from the page that already ranks — a moved section with no link
          into it is a deleted section as far as discovery is concerned. */}
      <section className="dmx dmx--outlink">
        <a className="dmx__outlink" href={questionsHref(lang)}>
          <span className="dmx__outlink-label">{c.questionsLink}</span>
          <span className="dmx__outlink-body">{c.questionsIntro}</span>
        </a>
      </section>
    </>
  );
}

/** English stays un-prefixed; the localized pages live under /es|/vi|/zh. */
export function questionsHref(lang: AnswerLang): string {
  return lang === "en" ? "/questions" : `/${lang}/questions`;
}

export function askHref(lang: AnswerLang): string {
  return lang === "en" ? "/screen/ask" : `/${lang}/screen/ask`;
}

/** Why the form's own wording defeats people. Introduces the cards below it,
 *  which is the job it was always doing — it just used to do it three sections
 *  away from them. */
export function SnapWhyHard({ lang = "en" }: { lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  return (
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
  );
}

/** The questions the FORM asks, decoded. Rendered from FORM_QUESTIONS — the
 *  same vetted, citation-backed entries the chat routes on — so this and the
 *  engine can never disagree, and neither can this and the JSON-LD (both call
 *  formQuestionHeading()).
 *
 *  Every entry names the governing rule and none carries a dollar figure, so
 *  none of it rots at the October COLA. */
export function SnapFormQuestions({ lang = "en" }: { lang?: AnswerLang }) {
  return (
    <section className="dmx" aria-labelledby="form-questions">
      <h2 id="form-questions" className="dmx__sronly">
        {PAGE_COPY[lang].faqH2}
      </h2>
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
  );
}
