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
import { programDisplayName } from "../../lib/program-name";
import { StateFlag } from "../../components/StateFlag";

// The measured rate refreshes without a deploy; the pack cards don't move.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "How Demeter verifies its answers",
  description:
    "Every state in Demeter is built from primary sources and adversarially fact-checked before it ships — here is the verification trail, state by state.",
};

export default async function VerifyPage() {
  const stats = await certaintyStats(30);
  return (
    <main className="vpage">
      <header className="vpage__head">
        <h1 className="vpage__title">How we verify</h1>
        <p className="vpage__lede">
          Demeter answers from the actual rules: the federal SNAP regulations (7 CFR 273,
          vendored and dated) plus per-state policy packs built from each state&apos;s own
          primary sources. Before a state ships, its pack goes through an adversarial
          pipeline — independent cross-checking, an eval suite, and a refute gate whose
          only job is to prove the draft wrong. Corrections are applied before
          publication, and every answer carries citations you can check.
        </p>
        <section className="vstat" aria-label="Measured grounded rate">
          {stats.measured ? (
            <>
              <div className="vstat__figure">
                <span className="vstat__pct">{stats.groundedRate}%</span>
                <span className="vstat__unit">
                  of the last {stats.totalAnswers.toLocaleString()} answers were marked{" "}
                  <strong>CERTAIN</strong>
                </span>
              </div>
              <p className="vstat__note">
                Measured over the past {stats.windowDays} days from Demeter&apos;s own
                answer log — not a target, not a claim. An answer only counts as
                certain when every rule it cites is backed by regulation text pulled
                for that specific question. Answers where Demeter fell back to quoting
                sources verbatim count as <em>failures</em> here ({stats.degraded} of
                them), so the number can&apos;t flatter itself.
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
                30 days. It stays blank until there are real answers to count — we&apos;d
                rather show nothing than a number with no observations behind it.
              </p>
            </>
          )}
        </section>

        <p className="vpage__lede">
          States without a verified pack get <strong>federal guidance only</strong> — and
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
      <section className="vpage__grid" aria-label="Verified states">
        {VERIFIED_STATES.map((s) => {
          const v = publicVerification(s);
          return (
            <article key={s.code} className="vcard">
              <div className="vcard__head">
                {/* StateFlag renders the code itself — the heading IS the flag
                    and its code, not the flag plus a second copy of it. */}
                <h2 className="vcard__state">
                  <StateFlag code={s.code} size={34} />
                </h2>
                <span className="vcard__badge">Verified</span>
              </div>
              <p className="vcard__program">{programDisplayName(s.program)}</p>
              <dl className="vcard__facts">
                <div>
                  <dt>Administered by</dt>
                  <dd>{s.agency}</dd>
                </div>
                <div>
                  <dt>Built from</dt>
                  <dd>
                    {v.sourceCount} primary {v.sourceCount === 1 ? "source" : "sources"}, read
                    from the agency&apos;s own published rules
                  </dd>
                </div>
                <div>
                  <dt>Before it shipped</dt>
                  <dd>
                    {/* A number is credibility. The list of what each correction
                        was is a map of where the hard parts are. */}
                    {v.corrections === null
                      ? "Passed an adversarial refute gate."
                      : `Passed an adversarial refute gate, which forced ${v.corrections} ${
                          v.corrections === 1 ? "correction" : "corrections"
                        } before publication.`}
                  </dd>
                </div>
                <div>
                  <dt>Last verified</dt>
                  <dd>{v.verifiedOn}</dd>
                </div>
              </dl>
              <Link className="vcard__cta" href={`/screen/ask?state=${s.code}`}>
                Ask about {s.code} →
              </Link>
            </article>
          );
        })}
      </section>

      <footer className="vpage__foot">
        <p>
          This page counts the sources behind each state rather than listing them,
          because a citation is worth something when it is attached to the claim it
          supports. Ask a question and the answer names the specific rule it used —
          the federal regulation, and your state&apos;s own manual where we have
          verified one — linked, so you can read it yourself.
        </p>
        <p>
          New states are verified and added continuously — each one ships only after its
          refute gate passes. <Link href="/screen/ask">Ask Demeter a question</Link> or see
          the <Link href="/supporters">organizations supporting this work</Link>.
        </p>
      </footer>
    </main>
  );
}
