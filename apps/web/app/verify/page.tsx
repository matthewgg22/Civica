// /verify — the public "How we verify" page (CEO scope item 6; the
// credibility artifact no competitor can copy). The state cards come from the
// pack verification blocks at build time; the grounded-rate readout is a live
// count, so the page is ISR rather than fully static. Client-safe packs entry
// only — never the corpus barrel.

import type { Metadata } from "next";
import Link from "next/link";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { certaintyStats, REASON_LABEL } from "../../lib/certainty-stats";
import { publicVerification } from "../../lib/verification-summary";
import { agencyDisplayName, programDisplayName } from "../../lib/program-name";
import { StateFlag } from "../../components/StateFlag";
import { DemeterNav } from "../../components/DemeterNav";
import { DemeterFooter } from "../../components/DemeterFooter";
import { stateName } from "../../lib/state-names";

// The measured rate refreshes without a deploy; the pack cards don't move.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "How Demeter verifies its answers",
  description:
    "Every state in Demeter is built from primary sources and adversarially fact-checked before it ships. Here is the verification trail, state by state.",
};

// Below this many real answers, a percentage is false precision — "16.7%"
// reads as a measured rate when it's really "2 of 12", and a tiny sample can
// swing from 8% to 40% on the next answer alone. We show the raw count
// instead until there's enough volume for a rate to mean anything, rather
// than let a headline number imply more confidence than the sample supports.
const SMALL_SAMPLE_THRESHOLD = 50;

export default async function VerifyPage() {
  const stats = await certaintyStats(30);
  const isSmallSample = stats.measured && stats.totalAnswers < SMALL_SAMPLE_THRESHOLD;
  return (
    <>
      {/* THE PAGE HAD NO HEADER. It was reachable from every other surface and
          then stranded you there: no way back to the chat, no language links,
          no sign that this was part of a product rather than a document
          somebody had linked to. */}
      <DemeterNav path="/verify" />
      <main className="vpage">
      <header className="vpage__head">
        <h1 className="vpage__title">How we verify</h1>
        {/* WHY THIS PAGE EXISTS COMES FIRST. It used to open on the machinery —
            vendored regulations, eval suites, refute gates — which is the
            answer to a question nobody had asked yet. Someone reads this page
            because they are deciding whether to trust a machine with something
            that decides whether their family eats. That is the thing to
            acknowledge, before any of the apparatus. */}
        <p className="vpage__lede vpage__lede--lead">
          Looking for help with food assistance means trusting someone with a
          decision that matters enormously, often while already under strain. We
          think that deserves accuracy and honesty rather than confidence. Which
          also means being open about how the answers are produced, and admitting
          that a system like this can still be wrong.
        </p>
        <p className="vpage__lede">
          So: Demeter answers from the actual rules. The federal SNAP regulations
          (7 CFR 273, vendored and dated) plus per-state policy packs built from each
          state&apos;s own primary sources. Before a state ships, its pack goes through
          an adversarial pipeline: independent cross-checking, an eval suite, and a
          refute gate whose only job is to prove the draft wrong. Corrections are
          applied before publication, and every answer carries citations you can check.
        </p>
        <section className="vstat" aria-label="Measured grounded rate">
          {stats.measured ? (
            <>
              {/* The two branches carry their OWN unit text. Sharing one read
                  "2 of 12 of the last 12 answers were marked CERTAIN" — the
                  count already names the denominator the percentage needs
                  spelled out after it. */}
              <div className="vstat__figure">
                {isSmallSample ? (
                  <>
                    <span className="vstat__pct">
                      {stats.certainAnswers} of {stats.totalAnswers}
                    </span>
                    <span className="vstat__unit">
                      answers in the last {stats.windowDays}{" "}
                      days were marked{" "}
                      <strong>CERTAIN</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="vstat__pct">{stats.groundedRate}%</span>
                    <span className="vstat__unit">
                      of the last {stats.totalAnswers.toLocaleString()} answers were marked{" "}
                      <strong>CERTAIN</strong>
                    </span>
                  </>
                )}
              </div>
              {/* Deliberately carries NO interpolated number: the figure above
                  already states it, and every `{expr}`-to-word boundary on this
                  page is a whitespace hazard (see below). */}
              {isSmallSample && (
                <p className="vstat__flag">
                  Early data. That is too few answers to read as a rate &mdash; the next
                  one alone could swing a percentage by several points. We show the plain
                  count until the sample is large enough for a rate to mean something.
                </p>
              )}
              <p className="vstat__note">
                {/* The {" "} here are LOAD-BEARING, not formatting.
                    A JSX text child following an expression loses its leading
                    space if that text spans a line break. `{stats.windowDays} days
                    from Demeter's own\nanswer log` shipped to production as
                    "past 30days"; the same shape cost us "12real answers" and
                    "(4of them)". Text that stays on ONE line keeps its space,
                    which is why `{n} answers were marked{" "}` above was always
                    fine. An explicit {" "} compiles to a standalone string child
                    and always survives.
                    Vitest renders BOTH shapes correctly, so no unit test can
                    catch this — it was found by reading the deployed HTML.
                    If you reflow this paragraph, re-check the rendered output. */}
                Measured over the past {stats.windowDays}{" "}
                days from Demeter&apos;s own
                answer log. Not a target, not a claim. An answer only counts as
                certain when every rule it cites is backed by regulation text pulled
                for that specific question. Answers where Demeter fell back to quoting
                sources verbatim count as <em>failures</em> here ({stats.degraded}{" "}
                of them), so the number can&apos;t flatter itself.
                {stats.topReason && REASON_LABEL[stats.topReason] ? (
                  <> The most common reason certainty was withheld:{" "}
                  {REASON_LABEL[stats.topReason]}.</>
                ) : null}
              </p>
            </>
          ) : (
            <>
              <div className="vstat__figure">
                <span className="vstat__pending">Not yet measured</span>
              </div>
              <p className="vstat__note">
                This space shows the share of answers Demeter marks{" "}
                <strong>CERTAIN</strong>, counted from its own answer log over a rolling
                30 days. It stays blank until there are real answers to count, we&apos;d
                rather show nothing than a number with no observations behind it.
              </p>
            </>
          )}
        </section>

        <p className="vpage__lede">
          States without a verified pack get <strong>federal guidance only</strong>, and
          for rules that vary by state (income limits, deductions), Demeter declines to
          state exact dollar figures rather than risk a wrong number, and points you to
          your state agency instead.
        </p>
      </header>

      {/* WHAT THIS GRID DELIBERATELY NO LONGER PRINTS: each pack's enumerated
          primary sources, the pipeline that built it, and the specific
          corrections its refute gate caught. Fourteen of those side by side
          stopped being evidence of care and became a build sheet.

          What survives is the claim itself — checked against N primary sources,
          on this date, with this many corrections forced before it shipped.
          The sources are not hidden: every answer cites the rule it actually
          used, to the person who asked, for the question they asked. */}
      {/* THE UMBRELLA. Every state below administers ONE federal programme, and
          a grid of state cards on its own implies fifty-three separate schemes.
          Full width above them, because that is the relationship: the rules are
          federal, the administration is not. */}
      <section className="vusda" aria-label="Programme authority">
        <p className="vusda__eyebrow">The programme itself</p>
        <p className="vusda__body">
          SNAP is a federal programme, authorised by Congress and governed by{" "}
          <a
            className="vusda__link"
            href="https://www.ecfr.gov/current/title-7/part-273"
            target="_blank"
            rel="noopener noreferrer"
          >
            7 CFR Part 273
          </a>
          , administered nationally by the{" "}
          <a
            className="vusda__link"
            href="https://www.fns.usda.gov/snap"
            target="_blank"
            rel="noopener noreferrer"
          >
            USDA Food and Nutrition Service
          </a>
          . Every agency below runs that same programme in its own state.
        </p>
      </section>

      <section className="vpage__grid" aria-label="Verified states">
        {VERIFIED_STATES.map((s) => {
          const v = publicVerification(s);
          return (
            <article key={s.code} className="vcard">
              <div className="vcard__head">
                {/* THE STATE'S NAME, spelled out. The heading was the flag and
                    the two-letter code alone, which asks a reader to decode
                    "MI" and "MN" and "MS" at a glance on a page whose whole
                    purpose is being trustworthy about detail. */}
                <h2 className="vcard__state">
                  <StateFlag code={s.code} size={44} />
                  <span className="vcard__statename">
                    {stateName(s.code)} <span className="vcard__statecode">({s.code})</span>
                  </span>
                </h2>
                <span className="vcard__badge">
                  <span aria-hidden>✓</span> Verified
                </span>
              </div>
              <p className="vcard__program">{programDisplayName(s.program)}</p>
              <dl className="vcard__facts">
                <div>
                  <dt>Administered by</dt>
                  <dd>{agencyDisplayName(s.agency)}</dd>
                </div>
                <div>
                  <dt>Built from</dt>
                  <dd>
                    {v.sourceCount} primary {v.sourceCount === 1 ? "source" : "sources"}, read
                    from the agency&apos;s own published rules
                  </dd>
                </div>
                {/* "Passed an adversarial refute gate" appeared on EVERY card
                    with nothing else in it — a line that is true of all of them
                    and therefore distinguishes none of them, said once in the
                    lede above. What survives here is the part that varies: how
                    many corrections that gate actually forced. */}
                {v.corrections !== null && (
                  <div>
                    <dt>Corrections forced</dt>
                    <dd>
                      {v.corrections} {v.corrections === 1 ? "correction" : "corrections"} caught
                      and applied before publication
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Last verified</dt>
                  <dd>{v.verifiedOn}</dd>
                </div>
              </dl>
              {/* TWO DOORS, and neither of them used to exist properly: the one
                  CTA went to the landing page rather than the chat, so a reader
                  who wanted to ask about this state was returned to the start.
                  Ask goes to the chat scoped to the state; the agency link goes
                  to where the application is actually filed. */}
              <div className="vcard__actions">
                {/* The VISIBLE label is short, because thirty cards of "Ask
                    Demeter about Rhode Island" is a wall. The accessible name
                    carries the state, because thirty links all announcing "Ask
                    Demeter" is worse than a wall — it is thirty
                    indistinguishable destinations. */}
                <Link
                  className="vcard__cta"
                  href={`/chat?state=${s.code}`}
                  aria-label={`Ask Demeter about ${stateName(s.code)}`}
                >
                  Ask Demeter <span aria-hidden>→</span>
                </Link>
                {s.portal && (
                  <a
                    className="vcard__cta vcard__cta--agency"
                    href={s.portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${s.portal.name}, apply in ${stateName(s.code)} (opens in a new tab)`}
                  >
                    {s.portal.name} <span aria-hidden>↗</span>
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="vpage__foot">
        <p>
          This page counts the sources behind each state rather than listing them,
          because a citation is worth something when it is attached to the claim it
          supports. Ask a question and the answer names the specific rule it used , 
          the federal regulation, and your state&apos;s own manual where we have
          verified one. Linked, so you can read it yourself.
        </p>
        {/* CLOSING ON AN INVITATION TO CORRECT US, which is the only honest end
            for a page that has just spent several hundred words explaining why
            it might still be wrong. */}
        <p>
          New states are verified and added continuously, and this work is not
          finished. If you find something here that does not match what your agency
          told you, we want to know. That is how the next correction gets caught.{" "}
          <Link href="/chat">Ask Demeter a question</Link>, or tell us what we got
          wrong through the <Link href="/supporters">organizations supporting this work</Link>.
        </p>
      </section>
      </main>
      {/* THE SAME GRAPHITE FOOTER AS EVERY OTHER SURFACE. This page ended on
          the paper it started on, which read as running out rather than
          finishing — and it was the one page missing the obligations band. */}
      <DemeterFooter />
    </>
  );
}
