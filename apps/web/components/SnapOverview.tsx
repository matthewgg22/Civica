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
import { COUNT_FLOOR } from "../lib/live-counts";
import { programDisplayName, agencyDisplayName } from "../lib/program-name";
import { StateFlag } from "./StateFlag";
import { UsCoverageMap } from "./UsCoverageMap";
import { SnapRetailerMap } from "./SnapRetailerMap";
import { SnapMiniChat } from "./SnapMiniChat";

/** The three verified codes in VERIFIED_STATES that are not states — DC is a
 *  federal district, Guam and the U.S. Virgin Islands are territories. Both
 *  places below used to fold all of them into "{53} States verified", which
 *  was accurate about the count and wrong about the word. Splitting on this
 *  set keeps the "states" count and label actually true, without dropping
 *  DC/GU/VI from the page — they get their own, correctly-named mention. */
const NON_STATE_CODES = new Set(["DC", "GU", "VI"]);

function splitJurisdictions(states: PackMeta[]) {
  return {
    actualStates: states.filter((s) => !NON_STATE_CODES.has(s.code)),
    otherJurisdictions: states.filter((s) => NON_STATE_CODES.has(s.code)),
  };
}

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
  publicCount = null,
  states = [],
  initialState = null,
}: {
  lang?: AnswerLang;
  /** Live count of public questions answered (lib/live-counts.ts), passed in
   *  by the page so this component stays synchronous and testable. Null (the
   *  default) means unavailable, and unavailable renders NOTHING. */
  publicCount?: number | null;
  /** Verified jurisdictions for the mini chat's state select. */
  states?: PackMeta[];
  /** ?state= param or the geo hint — preselects the mini chat's state the
   *  same way /chat preselects its own picker. */
  initialState?: string | null;
}) {
  const c = PAGE_COPY[lang];
  const chatPath = lang === "en" ? "/chat" : `/${lang}/chat`;
  return (
    // TWO COLUMNS at desktop: the orientation text, and one real answer.
    //
    // History, because this ground has moved twice. The bar once carried a
    // second column of verified-state flags, removed on direct feedback:
    // fifty flags before a single word of orientation buried the claim in
    // decoration. It then ran single-column, which left the top-right empty
    // at desktop — a standing taste call (#715). The taste audit's finding 5
    // resolved both: the right column now holds the one thing the flags were
    // not — the PRODUCT ITSELF, demonstrated. A real answer, generated
    // through the actual pipeline (see the copy table's comment for the
    // audit line), shortened and labeled as exactly that. It is the page's
    // only demo and the proof of the lede's own claim, so unlike the flags
    // it argues FOR the orientation rather than competing with it.
    <section className="dmo" aria-labelledby="demeter-h1">
      <div className="dmo__text">
        <p className="dmo__eyebrow">{c.eyebrow}</p>
        <h1 id="demeter-h1" className="dmo__h1">
          {c.h1}
        </h1>
        <p className="dmo__lede">{c.productLede}</p>
        <p className="dmo__snap">{c.snapLine}</p>
      </div>
      <aside className="dmex" aria-label={c.example.label}>
        <p className="dmex__label">{c.example.label}</p>
        {/* The mini chat (owner redesign 2026-08-21) — it REPLACED the
            cycling example card: the real way in beats a demo of it. The
            vetted exchanges survive as its starter chips; their earned
            verdicts are why these three questions get offered at all (data
            tests in taste-audit-copy pin that quality). Handoff is a native
            GET form to /chat — one chat, reachable two ways, and the typed
            path works with no JavaScript at all. */}
        <SnapMiniChat
          chatPath={chatPath}
          states={states}
          initialState={initialState}
          starters={c.example.items.map((item) => item.q)}
          copy={c.miniChat}
        />
        {/* DORMANT UNTIL TRUE (approved 2026-08-21). The requested "Over 300
            people" line was refused — prod truth at the time was 12 questions
            ever — so the card carries a usage claim only when the MEASURED
            count clears the floor. No placeholder, no "be the first": below
            the floor this renders nothing at all. */}
        {publicCount !== null && publicCount >= COUNT_FLOOR ? (
          <p className="dmex__tally">
            {c.example.tally.replace("{n}", String(publicCount))}
          </p>
        ) : null}
      </aside>
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
  const { actualStates, otherJurisdictions } = splitJurisdictions(states);
  return (
    <>
      {/* Trust, relocated from the old lede. Same four claims, same words. */}
      <section className="dmx" aria-labelledby="why-trust">
        <h2 id="why-trust" className="dmx__h2">
          {c.trustH2}
        </h2>
        <dl className="dmx__trustlist dmx__trustlist--wide">
          {/* RENDERED OUT OF ARRAY ORDER: the three compact rows (0, 1, 3)
              first, the full-width flags row (2) last — not c.trust's own
              0-1-2-3 order. The auto-fit grid packs short rows two-up; with
              the full-width row sitting in the MIDDLE of the array, row 3
              ("Everywhere else") landed on its own line after it with
              nothing to pair beside, reading as orphaned rather than part of
              the same list. Moving the full-width row to the end lets 0, 1
              and 3 flow together first, however many columns actually fit,
              with the flags claiming their own final row same as before. */}
          {[0, 1, 3].map((i) => {
            const row = c.trust[i];
            if (!row) return null;
            return (
              <div className="dmx__trustrow" key={row.t}>
                <dt>{row.t}</dt>
                <dd>{row.d}</dd>
              </div>
            );
          })}
          {/* The states-verified row — moved here from the hero orientation
              bar on direct feedback (see SnapOrientation). Counted on actual
              STATES only: DC/GU/VI are real, verified jurisdictions but not
              states, and folding them into this count made the label wrong
              even though the number was right. They still get named, just
              not as one of the 50. */}
          {c.trust[2] && (
            // FULL WIDTH, not squeezed into one auto-fit cell like the other
            // three rows — fifty flags need the room the hero aside used to
            // give them; a 15rem-minimum grid cell would wrap them into a
            // cramped narrow column instead.
            <div className="dmx__trustrow dmx__trustrow--states" key={c.trust[2].t}>
              <dt>
                {actualStates.length} {c.trust[2].t}
              </dt>
              <dd>
                <ul className="dmo__states-grid">
                  {actualStates.map((s) => (
                    <li key={s.code}>
                      <StateFlag code={s.code} />
                    </li>
                  ))}
                </ul>
                {otherJurisdictions.length > 0 && (
                  <>
                    <p className="dmo__states-also">{c.statesAlsoVerified}</p>
                    <ul className="dmo__states-grid">
                      {otherJurisdictions.map((s) => (
                        <li key={s.code}>
                          <StateFlag code={s.code} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="dmo__states-detail">{c.trust[2].d}</p>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* WHAT SNAP IS, before the rules that decide who gets it. The page went
          straight from "here is why you can trust us" to "here is what decides
          eligibility" — explaining the qualifying rules for a program it had
          never actually described. One line in the orientation bar was carrying
          the whole definition. */}
      <section className="dmx" aria-labelledby="what-is-snap">
        {/* THE DEEP BAND (owner redesign 2026-08-21, FeelBetterBot-inspired
            structure): the program definition is the page's one moment of
            weight, set as light type on deep ink — Demeter's own near-black,
            deliberately NOT the parent brand's pine (the iOS/Demeter brand
            line stays drawn). The USDA attribution box stays OUTSIDE the
            band below: it is a legal disclaimer, not brand theater. */}
        <div className="dmband">
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
        </div>

        {/* Pointing at USDA is exactly the place to say we are not USDA. A
            benefits site that links the federal program without disclaiming
            affiliation is one a worried applicant can easily read as official.
            THE LOGO LEADS now — large, on its own, at the box's left edge —
            rather than sitting inside the links list as one more line item
            among three. It was a 148px thumbnail sharing a narrow column with
            two plain-text links, which read as an afterthought for a mark
            USDA requires be displayed; making it the thing the box opens with
            instead says what this box actually is before a word of it is
            read. */}
        <div className="dmx__official">
          <div className="dmx__official-logo">
            {/* Decorative on purpose: it sits immediately beside the heading
                that names it, so alt text would announce the same thing twice.
                Rendered at its true 663:460 ratio and otherwise untouched —
                "the logo cannot be altered" is a condition of being allowed
                to use it; only its box size is ours to set. */}
            <Image src="/snap-logo.png" alt="" aria-hidden width={230} height={160} />
          </div>
          <div className="dmx__official-content">
            <h3 className="dmx__h3">{c.officialH3}</h3>
            <p className="dmx__note">{c.officialNote}</p>
            <ul className="dmx__officiallinks">
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
          </div>
          {/* Must appear on any material where an organisation outside USDA
              uses the mark. It lives inside this box, next to the logo, rather
              than in the page footer — a required notice about a specific mark
              belongs with the mark, not three sections away. */}
          <p className="dmx__servicemark">{SNAP_SERVICE_MARK}</p>
        </div>
      </section>

      {/* WHO ACTUALLY DECIDES, immediately after what the programme is.
          A reader's questions arrive in an order — what is this, who decides
          it, how do I use it — and the page answered the third before the
          second. Knowing your own state runs this, and which agency, is what
          makes every rule below concrete rather than abstract. */}
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
            rather not poke at a map.

            DISPLAY NAMES, not raw pack fields (taste audit finding 1). The
            pack's program/agency strings are written for the MODEL (#761) and
            carry research annotation — rendered raw, this list read a
            screen-reader user "see PROVENANCE.md Finding 8" and cross-pack
            notes as the accessible alternative to the map. The one audience
            that gets the text version must get exactly what a sighted user
            gets from a tap: program, agency, portal. */}
        {/* translate="no": every line is state codes, program and agency
            proper nouns, and portal URLs — identifiers a machine translator
            can only corrupt (vercel-guidelines finding 1). */}
        <ul className="dmx__sronly" translate="no">
          {states.map((s) => (
            <li key={s.code}>
              {s.code}: {programDisplayName(s.program)}, {agencyDisplayName(s.agency)}
              {/* Portal names drift too — Wyoming's is "…(paper application
                  only — no online portal found)". Same cleaning rule as the
                  program name: its trailing-paren-prose cut is exactly this
                  shape. */}
              {s.portal ? `, ${programDisplayName(s.portal.name)} (${s.portal.url})` : ""}
            </li>
          ))}
        </ul>
      </section>

      {/* The one internal link out. The form-question cards are the content a
          generative engine is most likely to quote, so they need a crawlable
          path from the page that already ranks — a moved section with no link
          into it is a deleted section as far as discovery is concerned. */}
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
                    <a className="dmx__link" href="/verify">
                      {c.statesLink}
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

      <section className="dmx dmx--outlink">
        <a className="dmx__outlink" href={questionsHref(lang)}>
          <span className="dmx__outlink-label">{c.questionsLink}</span>
          <span className="dmx__outlink-body">{c.questionsIntro}</span>
        </a>
      </section>
      {/* WHERE THE CARD WORKS, last. It used to sit inside "what SNAP is",
          which put "here are 252,000 shops" in front of someone who had not yet
          established whether they could get the card at all. It is the final
          question in the sequence — what it is, who decides, then how you use
          it — and it reads as a payoff there rather than as a detour. */}
      <SnapRetailerMap lang={lang} />

    </>
  );
}

/** "I need food this week."
 *
 *  SNAP takes at least seven days even under expedited service, so a page that
 *  only explains SNAP hands someone who is out of food an accurate answer and
 *  no dinner. Feeding America leads with a food-bank finder; GetCalFresh points
 *  at real people. We carried nothing.
 *
 *  Deliberately NOT inside an accordion, not below the fold, and not phrased as
 *  a caveat. Someone in that situation should not have to read a page about
 *  eligibility rules to find it. */
export function SnapFoodNow({ lang = "en" }: { lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  return (
    <aside className="dmnow" aria-label={c.foodNowLabel}>
      <p className="dmnow__label">{c.foodNowLabel}</p>
      <p className="dmnow__body">{c.foodNowBody}</p>
      <p className="dmnow__links">
        <a
          className="dmnow__link"
          href="https://www.feedingamerica.org/find-your-local-foodbank"
          target="_blank"
          rel="noopener noreferrer"
        >
          {c.foodNowBank}&nbsp;↗
        </a>
        <a
          className="dmnow__link"
          href="https://www.211.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {c.foodNow211}&nbsp;↗
        </a>
      </p>
    </aside>
  );
}

/** The reasons eligible people never apply.
 *
 *  The page explained the rules well and never addressed why someone would not
 *  try. These are the fears, answered plainly, and they close the page because
 *  they are the last thing standing between reading and acting.
 *
 *  <details>/<summary>: native disclosure, keyboard-operable and announced
 *  correctly with no JavaScript, so it works in the server-rendered HTML a
 *  crawler and a generative engine both read. Every answer is IN the markup
 *  whether or not it is open.
 *
 *  The immigration one is the reason this section is careful rather than
 *  reassuring: DHS rescinded the 2022 public charge rule effective 18 Sept
 *  2026, so a flat "SNAP doesn't count" is true today and wrong next month.
 *  See issue #759 — /welcome still says the flat version. */
export function SnapFears({ lang = "en" }: { lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  return (
    <section className="dmx" aria-labelledby="fears">
      <h2 id="fears" className="dmx__h2">
        {c.fearsH2}
      </h2>
      <p className="dmx__body">{c.fearsBody}</p>
      <div className="dmfear">
        {c.fears.map((f) => (
          <details className="dmfear__item" key={f.q}>
            <summary className="dmfear__q">{f.q}</summary>
            <p className="dmfear__a">{f.a}</p>
          </details>
        ))}
      </div>
      {/* The way out of a list of answers we chose in advance. */}
      <a className="dmfear__cta" href={lang === "en" ? "/chat" : `/${lang}/chat`}>
        <span className="dmfear__ctalabel">{c.fearsCta}</span>
        <span className="dmfear__ctanote">{c.fearsCtaNote}</span>
      </a>
    </section>
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
          announcing "3 of 5" is carrying the same information the rail does.
          `.dmtl__track` is a SINGLE line spanning every step, not one border
          per column — five separate 2px rules broken by the grid's gaps never
          read as one journey; they read as five unrelated shelves. One line,
          with a dot per step sitting on it, is what "timeline" was supposed
          to mean. It fills in left to right as the row scrolls into view (see
          the CSS) so the page itself performs the forward motion the content
          describes. */}
      <ol className="dmtl">
        <span className="dmtl__track" aria-hidden />
        {c.timeline.map((step) => (
          <li className="dmtl__step" key={step.t}>
            {/* THE MARKER IS A DRAWING, not a numbered dot — the dot lives on
                the track now, separately. Four steps, four illustrations, in
                the house line-art. Decorative on purpose: the step's heading
                and its date sit immediately beside it and say everything the
                picture does, so alt text would be a second announcement of
                the same beat and a stray tab stop in a list a screen reader
                already numbers "3 of 4". */}
            <Image
              className="dmtl__mark"
              src={`/timeline/${step.img}.png`}
              alt=""
              aria-hidden
              width={192}
              height={192}
            />
            <span className="dmtl__dot" aria-hidden />
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
