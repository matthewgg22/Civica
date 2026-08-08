// /guides/[state] — SEO state guide pages, generated at BUILD TIME from the
// verified packs (eng decision 7A: SSG via generateStaticParams; a pack merge
// redeploys and regenerates). These are the acquisition surface (CEO T2):
// indexable, fast, honest — and every one ends in the chat box.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

export const dynamicParams = false;

export function generateStaticParams() {
  return VERIFIED_STATES.map((s) => ({ state: s.code.toLowerCase() }));
}

function packFor(state: string) {
  return VERIFIED_STATES.find((s) => s.code === state.toUpperCase());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state } = await params;
  const pack = packFor(state);
  if (!pack) return {};
  return {
    title: `SNAP in ${pack.code} — ${pack.program} | verified ${pack.verification.verified_on}`,
    description: `How SNAP works in ${pack.code}: ${pack.program}, run by ${pack.agency}. Verified from primary sources ${pack.verification.verified_on} — ask Demeter anything about it.`,
  };
}

export const QUESTIONS: Record<string, string[]> = {
  CA: [
    "What income limit applies to my CalFresh household?",
    "Do I have to do an interview for CalFresh?",
    "How fast can I get emergency CalFresh?",
  ],
  WA: [
    "What is the income limit for Basic Food?",
    "Does Washington have an asset test for Basic Food?",
    "What is WASHCAP and do I qualify?",
  ],
  TX: [
    "What is the income limit for SNAP in Texas?",
    "Does my car count against me for Texas SNAP?",
    "How fast can I get emergency food benefits in Texas?",
  ],
  NY: [
    "What income limit applies to my household in New York?",
    "Do I use myBenefits or ACCESS HRA to apply?",
    "Is there a simplified application for seniors in New York?",
  ],
};

export default async function GuidePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state } = await params;
  const pack = packFor(state);
  if (!pack) notFound();

  const questions = QUESTIONS[pack.code] ?? [];
  return (
    <main className="gpage">
      <header className="gpage__head">
        <p className="gpage__crumb">
          <Link href="/demeter">Demeter</Link> / SNAP in {pack.code}
        </p>
        <h1 className="gpage__title">
          SNAP in {pack.code}: {pack.program}
        </h1>
        <p className="gpage__badge">
          ✓ Verified from primary sources · {pack.verification.verified_on} ·{" "}
          <Link href="/verify">how we verify</Link>
        </p>
      </header>

      <section className="gpage__facts">
        <dl>
          <dt>What it&apos;s called</dt>
          <dd>{pack.program}</dd>
          <dt>Who runs it</dt>
          <dd>
            {pack.agency}
            {pack.adminModel === "county"
              ? " — administered by county/local offices, so office practice can vary; state policy is the baseline."
              : " — administered directly by the state."}
          </dd>
          {pack.portal && (
            <>
              <dt>Where to apply</dt>
              <dd>
                <a href={pack.portal.url} rel="noopener noreferrer" target="_blank">
                  {pack.portal.name}
                </a>
              </dd>
            </>
          )}
          <dt>How this page stays honest</dt>
          <dd>{pack.verification.gates}</dd>
        </dl>
      </section>

      <section className="gpage__ask">
        <h2>Ask about SNAP in {pack.code}</h2>
        <p>
          Demeter answers with citations from {pack.code}&apos;s own policy sources —
          free, in English or Spanish, no account needed.
        </p>
        <ul className="gpage__questions">
          {questions.map((q) => (
            <li key={q}>
              <Link href={`/demeter?state=${pack.code}&q=${encodeURIComponent(q)}`}>{q} →</Link>
            </li>
          ))}
        </ul>
        <Link className="gpage__cta" href={`/demeter?state=${pack.code}`}>
          Open the chat →
        </Link>
      </section>

      <footer className="gpage__foot">
        <p>
          Demeter gives information, not legal advice — confirm decisions with your SNAP
          agency. Sources current as of {pack.verification.verified_on}; dollar values
          re-verified on the federal October cycle.
        </p>
      </footer>
    </main>
  );
}
