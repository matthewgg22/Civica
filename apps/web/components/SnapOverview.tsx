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

/** The lede — renders ABOVE the chat, so the page explains itself before it
 *  asks for input, without pushing the chat below the fold.
 *
 *  Two columns on wide screens. The right column is not decoration: a
 *  single-column lede left ~740px of the 1180px container empty, which is the
 *  "doesn't fill the page" complaint this rebuild exists to fix — and the
 *  honest thing to put there is what makes the answers trustworthy, stated
 *  plainly enough to be quoted. */
export function SnapLede({ states }: { states: PackMeta[] }) {
  return (
    <section className="dmx dmx--lede" aria-labelledby="what-is-snap">
      <div className="dmx__ledegrid">
        <div>
          <p className="dmx__eyebrow">Supplemental Nutrition Assistance Program</p>
          <h2 id="what-is-snap" className="dmx__h2">
            SNAP is monthly money for groceries, paid onto a card.
          </h2>
          <p className="dmx__lede">
            Formerly called food stamps, SNAP is a federal program run by each state. If
            you qualify, benefits arrive once a month on an EBT card you use like a debit
            card at most grocery stores. Applying is free, and you can apply whether or not
            you are working.
          </p>
        </div>
        <aside className="dmx__trust" aria-label="How these answers are made">
          <dl className="dmx__trustlist">
            <div className="dmx__trustrow">
              <dt>Free, no account</dt>
              <dd>Ask as many questions as you need. Nothing to sign up for.</dd>
            </div>
            <div className="dmx__trustrow">
              <dt>Every claim cited</dt>
              <dd>
                Answers quote the federal regulation, and the state manual where we have
                verified one.
              </dd>
            </div>
            <div className="dmx__trustrow">
              <dt>
                {states.length} state{states.length === 1 ? "" : "s"} verified
              </dt>
              <dd>
                {`${states.map((s) => s.code).join(" · ")} — each checked against that agency’s own published rules before going live.`}
              </dd>
            </div>
            <div className="dmx__trustrow">
              <dt>Everywhere else</dt>
              <dd>
                Federal rules still answer. Figures that vary by state are deferred to your
                agency rather than guessed.
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

/** The depth — renders BELOW the chat. Carries the GEO weight: mechanisms,
 *  differentiation, and every verified state's real agency, all in server HTML. */
export function SnapDetail({ states }: { states: PackMeta[] }) {
  return (
    <>
      <section className="dmx" aria-labelledby="what-decides">
        <h2 id="what-decides" className="dmx__h2">
          What actually decides whether you qualify
        </h2>
        <p className="dmx__body">
          Not your income alone — that is the most common reason people who qualify never
          apply. Eligibility turns on what is left after the deductions you are entitled to,
          and on a short list of category rules.
        </p>
        <dl className="dmx__defs">
          <div className="dmx__def">
            <dt>Household size</dt>
            <dd>
              Who buys and prepares food together, which is not always who lives together.
              Roommates who shop separately are usually separate households.
            </dd>
          </div>
          <div className="dmx__def">
            <dt>Income, after deductions</dt>
            <dd>
              Rent, utilities, childcare, child support you pay, and — for members who are
              60+ or disabled — medical costs above a set floor all come off before the
              limit is applied.
            </dd>
          </div>
          <div className="dmx__def">
            <dt>Category rules</dt>
            <dd>
              Students, non-citizens, and adults without dependents each have their own
              rules, and most have exemptions that are missed more often than they are
              applied.
            </dd>
          </div>
          <div className="dmx__def">
            <dt>Your state</dt>
            <dd>
              Federal rules set the floor; each state adds its own manual, its own utility
              allowances, and in some states its own asset test. Advice from one state is
              frequently wrong in the next.
            </dd>
          </div>
        </dl>
      </section>

      <section className="dmx" aria-labelledby="why-hard">
        <h2 id="why-hard" className="dmx__h2">
          Why a straight answer is hard to find
        </h2>
        <div className="dmx__grid">
          <div className="dmx__card">
            <h3 className="dmx__h3">The rule is real but buried</h3>
            <p className="dmx__body">
              Most eligibility questions have one correct answer, sitting somewhere in a few
              hundred pages of federal regulation and a state manual on top of it.
            </p>
          </div>
          <div className="dmx__card">
            <h3 className="dmx__h3">Old numbers keep circulating</h3>
            <p className="dmx__body">
              Limits change every October. Advice passed down from a few years ago turns
              people away who would qualify today.
            </p>
          </div>
          <div className="dmx__card">
            <h3 className="dmx__h3">Deductions decide it</h3>
            <p className="dmx__body">
              Miss one deduction you are entitled to and a household looks over the limit
              when it is not. This is the single most common way an eligible household gets
              the wrong answer.
            </p>
          </div>
          <div className="dmx__card">
            <h3 className="dmx__h3">Asking feels risky</h3>
            <p className="dmx__body">
              People worry a wrong answer on a form will be held against them, so they never
              file. Knowing what a question is actually asking is usually what gets someone
              past it.
            </p>
          </div>
        </div>
      </section>

      <section className="dmx" aria-labelledby="how-answers">
        <h2 id="how-answers" className="dmx__h2">
          How Demeter answers
        </h2>
        <ol className="dmx__steps">
          <li className="dmx__step">
            <span className="dmx__num">01</span>
            <div>
              <h3 className="dmx__h3">Every claim carries its rule</h3>
              <p className="dmx__body">
                Answers cite the federal regulation and, in verified states, that state&rsquo;s
                own manual — linked, so you can read the rule yourself or show it to a
                caseworker who disagrees.
              </p>
            </div>
          </li>
          <li className="dmx__step">
            <span className="dmx__num">02</span>
            <div>
              <h3 className="dmx__h3">It says when it is not sure</h3>
              <p className="dmx__body">
                Each answer is marked certain or uncertain, and says why. When the sources
                retrieved do not cover your question, it says so instead of guessing a
                number.
              </p>
            </div>
          </li>
          <li className="dmx__step">
            <span className="dmx__num">03</span>
            <div>
              <h3 className="dmx__h3">State packs are checked adversarially</h3>
              <p className="dmx__body">
                Before a state goes live, its policy pack is cross-checked against the
                state&rsquo;s own primary sources and run through a gate whose only job is to
                prove the draft wrong. Corrections are applied before publication.{" "}
                <a className="dmx__link" href="/verify">
                  See how we verify
                </a>
                .
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="dmx" aria-labelledby="agencies">
        <h2 id="agencies" className="dmx__h2">
          Your state runs the program — here is who
        </h2>
        <p className="dmx__body">
          Demeter never decides your case. Your state agency does. These are the agencies
          whose own published rules the verified answers are built from, and where you
          actually apply.
        </p>
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
        <p className="dmx__note">
          Not listed? Demeter still answers at the federal floor, and points you to your own
          state agency for figures that vary by state.
        </p>
      </section>
    </>
  );
}
