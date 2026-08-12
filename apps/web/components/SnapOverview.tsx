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
import Image from "next/image";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { StateFlag } from "./StateFlag";
import { UsCoverageMap } from "./UsCoverageMap";

/** REQUIRED VERBATIM by FNS wherever an organisation outside USDA uses the SNAP
 *  logo. Not our sentence to reword, and deliberately NOT in the localized copy
 *  table — a mandated legal notice that can be translated is a mandated legal
 *  notice that can drift. It renders in English on every language of the page,
 *  which is what "must include the statement" means.
 *
 *  Source: fns.usda.gov/resource/snap-logo-guidance. The spacing in "U. S." is
 *  theirs; it is reproduced rather than tidied. */
const SNAP_SERVICE_MARK =
  "The SNAP logo is a service mark of the U. S. Department of Agriculture. " +
  "USDA does not endorse any goods, services, or enterprises.";

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
    <section
      className={states.length > 0 ? "dmo dmo--split" : "dmo"}
      aria-labelledby="demeter-h1"
    >
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
                <StateFlag code={s.code} />
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

      {/* WHAT SNAP IS, before the rules that decide who gets it. The page went
          straight from "here is why you can trust us" to "here is what decides
          eligibility" — explaining the qualifying rules for a program it had
          never actually described. One line in the orientation bar was carrying
          the whole definition. */}
      <section className="dmx" aria-labelledby="what-is-snap">
        <h2 id="what-is-snap" className="dmx__h2">
          {c.snapH2}
        </h2>
        <p className="dmx__body">{c.snapBody}</p>
        <dl className="dmx__defs">
          {c.snapFacts.map((f) => (
            <div className="dmx__def" key={f.t}>
              <dt>{f.t}</dt>
              <dd>{f.d}</dd>
            </div>
          ))}
        </dl>

        {/* Pointing at USDA is exactly the place to say we are not USDA. A
            benefits site that links the federal program without disclaiming
            affiliation is one a worried applicant can easily read as official. */}
        <div className="dmx__official">
          <div>
            <h3 className="dmx__h3">{c.officialH3}</h3>
            <p className="dmx__note">{c.officialNote}</p>
          </div>
          <ul className="dmx__officiallinks">
            {/* Decorative on purpose: it sits immediately beside a labelled link
                to the same destination, so alt text would announce that
                destination twice and add a duplicate tab stop. Rendered at its
                true 663:460 ratio and otherwise untouched — "the logo cannot be
                altered" is a condition of being allowed to use it. */}
            <li className="dmx__snaplogo">
              <Image src="/snap-logo.png" alt="" aria-hidden width={148} height={103} />
            </li>
            <li>
              <a
                className="dmx__link"
                href="https://www.fns.usda.gov/snap"
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.officialFns}&nbsp;↗
              </a>
            </li>
            <li>
              <a
                className="dmx__link"
                href="https://www.fns.usda.gov/snap/state-directory"
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.officialDirectory}&nbsp;↗
              </a>
            </li>
          </ul>
          {/* Must appear on any material where an organisation outside USDA
              uses the mark. It lives inside this box, next to the logo, rather
              than in the page footer — a required notice about a specific mark
              belongs with the mark, not three sections away. */}
          <p className="dmx__servicemark">{SNAP_SERVICE_MARK}</p>
        </div>
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

      {/* The outside evidence for the method described directly above, which is
          why it sits here rather than anywhere else: "we cite our sources" is a
          claim about ourselves, and this is someone else's finding that the
          alternative does not hold up. */}
      <section className="dmx dmx--evidence" aria-labelledby="evidence">
        <h2 id="evidence" className="dmx__h2">
          {c.evidenceH2}
        </h2>
        {/* Two columns on a wide screen: the argument on the left, the source
            it rests on to the right. Stacked in one narrow column, this section
            left half the page empty — and a pull-quote below its own body is a
            decoration rather than a citation sitting beside the claim. */}
        <div className="dmx__evgrid">
          <p className="dmx__body">{c.evidenceBody}</p>
          <div className="dmx__evaside">
        <figure className="dmx__quote">
          <blockquote cite="https://beeckcenter.georgetown.edu/report/ai-powered-rules-as-code-experiments-with-public-benefits-policy/">
            “{c.evidenceQuote}”
          </blockquote>
          <figcaption>{c.evidenceAttrib}</figcaption>
        </figure>
        <ul className="dmx__officiallinks">
          <li>
            <a
              className="dmx__link"
              href="https://beeckcenter.georgetown.edu/report/ai-powered-rules-as-code-experiments-with-public-benefits-policy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {c.evidenceReport}&nbsp;↗
            </a>
          </li>
          <li>
            <a
              className="dmx__link"
              href="https://beeckcenter.georgetown.edu/the-digital-benefits-network-showcases-twelve-generative-ai-experiments-for-benefits-policy-at-policy2code-demo-day/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {c.evidenceDemoDay}&nbsp;↗
            </a>
          </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="dmx" aria-labelledby="agencies">
        <h2 id="agencies" className="dmx__h2">
          {c.agenciesH2}
        </h2>
        <p className="dmx__body">{c.agenciesBody}</p>
        {/* A map, not a stack of fourteen cards. The list was accurate and
            unusable: to answer "is MY state here?" you had to read all of it.
            A map answers that before you read anything.

            The cards' content is not lost — it moves into the panel beside the
            map, one state at a time, which is how many anyone ever needed. */}
        <UsCoverageMap states={states} copy={c.map} />
        <p className="dmx__note">{c.agenciesNote}</p>

        {/* Every state, still in the HTML. The map is a CLIENT component, so
            its labels are invisible to a crawler that does not execute JS —
            and this section is how a generative engine learns that Demeter
            covers CalFresh, Basic Food, FoodShare and the rest by name. Visually
            hidden, deliberately not display:none, so it stays in the
            accessibility tree as a plain readable list for anyone who would
            rather not poke at a map. */}
        <ul className="dmx__sronly">
          {states.map((s) => (
            <li key={s.code}>
              {s.code} — {s.program}, {s.agency}
              {s.portal ? `, ${s.portal.name} (${s.portal.url})` : ""}
            </li>
          ))}
        </ul>
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

/** What happens after you apply, on the clock the regulation sets.
 *
 *  The form-question cards on this page explain what a question MEANS. This is
 *  the other half of what people arrive not knowing: what happens next, and by
 *  when. The deadlines are federal (7 CFR 273.2), so unlike the dollar figures
 *  — which vary by state and move every October — they can be stated outright.
 *
 *  Expedited service sits BEFORE the thirty-day decision rather than as a
 *  footnote to it. Seven days is the most useful fact on the page for someone
 *  who is out of food this week, and a footnote is where it goes to be missed.
 *  Its criteria are described in plain terms rather than by their dollar
 *  thresholds, which is both the house rule and the accurate move: the
 *  thresholds are federal but the rent-and-utilities test depends on figures
 *  that are not. */
export function SnapTimeline({ lang = "en" }: { lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  return (
    <section className="dmx" aria-labelledby="timeline">
      <h2 id="timeline" className="dmx__h2">
        {c.timelineH2}
      </h2>
      <p className="dmx__body">{c.timelineBody}</p>
      {/* An ordered list, because it is genuinely a sequence — a screen reader
          announcing "3 of 6" is carrying the same information the rail does. */}
      <ol className="dmtl">
        {c.timeline.map((step) => (
          <li className="dmtl__step" key={step.t}>
            <span className="dmtl__when">{step.when}</span>
            <div className="dmtl__body">
              <h3 className="dmx__h3">{step.t}</h3>
              <p className="dmx__body">{step.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="dmx__note">{c.timelineNote}</p>
    </section>
  );
}

/** The hand-off to the chat, which now lives entirely on the Ask Demeter page.
 *
 *  The landing used to carry a working state picker and composer. Two places
 *  to start the same conversation meant the landing shipped a picker whose
 *  choice it then had to forward, and a first-time visitor met a half-chat on
 *  a page that is not the chat. The composer belongs where the conversation
 *  happens; this page's job is to explain and then hand over.
 *
 *  Any ?state= on the landing rides along, so /guides/[state] and /verify deep
 *  links still arrive scoped. */
export function SnapAskCta({
  lang = "en",
  state = null,
}: {
  lang?: AnswerLang;
  state?: string | null;
}) {
  const c = PAGE_COPY[lang];
  const base = lang === "en" ? "/chat" : `/${lang}/chat`;
  return (
    <section className="dmx dmx--outlink dmx--askcta">
      <a className="dmx__outlink" href={state ? `${base}?state=${state}` : base}>
        <span className="dmx__outlink-label">{c.askLink}</span>
        <span className="dmx__outlink-body">{c.askIntro}</span>
      </a>
    </section>
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
