// /guides/[state] — SEO state guide pages, generated at BUILD TIME from the
// verified packs (eng decision 7A: SSG via generateStaticParams; a pack merge
// redeploys and regenerates). These are the acquisition surface (CEO T2):
// indexable, fast, honest — and every one ends in the chat box.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QUESTIONS } from "../../../lib/guide-questions";
import { absoluteUrl } from "../../../lib/site-url";
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
    alternates: { canonical: absoluteUrl(`/guides/${pack.code.toLowerCase()}`) },
    title: `SNAP in ${pack.code} — ${pack.program} | verified ${pack.verification.verified_on}`,
    description: `How SNAP works in ${pack.code}: ${pack.program}, run by ${pack.agency}. Verified from primary sources ${pack.verification.verified_on} — ask Demeter anything about it.`,
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state } = await params;
  const pack = packFor(state);
  if (!pack) notFound();

  const questions = QUESTIONS[pack.code] ?? [];

  // FAQPage structured data built from the SAME questions the page links to —
  // no invented Q&A, and nothing claimed here that the page doesn't show. The
  // answer text points at Demeter rather than asserting a policy figure,
  // because a rich result is a promise and state dollar amounts move.
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text:
          `Demeter answers this from ${pack.code}'s own SNAP policy sources, with citations you ` +
          `can check. ${pack.program} is run by ${pack.agency}. Verified from primary sources on ` +
          `${pack.verification.verified_on}.`,
      },
    })),
  };

  return (
    <main className="gpage">
      <script
        type="application/ld+json"
        // Content is built from our own pack data, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
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
