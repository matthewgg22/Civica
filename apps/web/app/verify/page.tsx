// /verify — the public "How we verify" page (CEO scope item 6; the
// credibility artifact no competitor can copy). The state cards come from the
// pack verification blocks at build time; the grounded-rate readout is a live
// count, so the page is ISR rather than fully static. Client-safe packs entry
// only — never the corpus barrel.

import type { Metadata } from "next";
import Link from "next/link";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { certaintyStats, REASON_LABEL } from "../../lib/certainty-stats";

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

      <section className="vpage__grid" aria-label="Verified states">
        {VERIFIED_STATES.map((s) => (
          <article key={s.code} className="vcard">
            <div className="vcard__head">
              <h2 className="vcard__state">
                {s.code} <span className="vcard__badge">✓ Verified</span>
              </h2>
              <p className="vcard__program">{s.program}</p>
            </div>
            <dl className="vcard__facts">
              <dt>Agency</dt>
              <dd>{s.agency}</dd>
              <dt>Verified</dt>
              <dd>{s.verification.verified_on}</dd>
              <dt>Method</dt>
              <dd>{s.verification.method}</dd>
              <dt>Gate results</dt>
              <dd>{s.verification.gates}</dd>
              <dt>Primary sources</dt>
              <dd>
                <ul className="vcard__sources">
                  {s.verification.sources.map((src) => (
                    <li key={src}>{src}</li>
                  ))}
                </ul>
              </dd>
            </dl>
            <Link className="vcard__cta" href={`/demeter?state=${s.code}`}>
              Ask about {s.code} →
            </Link>
          </article>
        ))}
      </section>

      <footer className="vpage__foot">
        <p>
          New states are verified and added continuously — each one ships only after its
          refute gate passes. <Link href="/demeter">Ask Demeter a question</Link> or see
          the <Link href="/supporters">organizations supporting this work</Link>.
        </p>
      </footer>
    </main>
  );
}
