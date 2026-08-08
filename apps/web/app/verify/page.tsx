// /verify — the public "How we verify" page (CEO scope item 6; the
// credibility artifact no competitor can copy). Fully static: rendered at
// build from the pack verification blocks; a pack merge redeploys and
// regenerates. Client-safe packs entry only — never the corpus barrel.

import type { Metadata } from "next";
import Link from "next/link";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

export const metadata: Metadata = {
  title: "How Demeter verifies its answers",
  description:
    "Every state in Demeter is built from primary sources and adversarially fact-checked before it ships — here is the verification trail, state by state.",
};

export default function VerifyPage() {
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
