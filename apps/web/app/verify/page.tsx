// /verify — SNAP, state by state. Who runs it where you live, what it is
// called there, where you actually apply, and a way to ask about it.
//
// THIS PAGE USED TO BE A BUILD SHEET. It opened with three paragraphs about
// our own pipeline and a live grounded-rate readout, then rendered 53 state
// cards, each carrying a "Verified" badge, a source count, a corrections
// count and a verification date. That is our internal provenance wearing a
// public page — and it made the one thing a reader came for, "what happens in
// MY state", the hardest thing on the page to find: 53 boxes of unequal
// height, in ship order rather than alphabetical.
//
// What people reach this page from is the link beside the state picker. They
// are looking for their state. So: a short orientation, then every state in
// alphabetical order, one scannable row each — flag, name, program, agency,
// the agency's own application link, and a way into the chat scoped to it.
//
// DELIBERATELY GONE, and not to be re-added "just one line" at a time: the
// certainty-rate figure, per-state source counts, correction counts,
// verification dates, and the description of the pipeline. None of that helps
// a person find their agency, and a page that leads with how hard we worked is
// talking about us rather than to them. The verification claim survives as one
// sentence in the lede, which is the part a reader actually needs.

import type { Metadata } from "next";
import Link from "next/link";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { agencyDisplayName, programDisplayName } from "../../lib/program-name";
import { StateFlag } from "../../components/StateFlag";
import { DemeterNav } from "../../components/DemeterNav";
import { DemeterFooter } from "../../components/DemeterFooter";
import { stateName } from "../../lib/state-names";

const TITLE = "SNAP by state — who runs it, what it's called, where to apply";
const DESCRIPTION =
  "Every state and territory Demeter covers, alphabetically: the local name for SNAP, the agency that administers it, and a direct link to that agency's own application.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
};

/** Alphabetical by the state's NAME, not its code — someone scanning for
 *  "Washington" is not looking under W-A, and the old ship-order list meant
 *  there was no way to scan for it at all. Grouped by initial so the eye can
 *  jump rather than read 53 rows in sequence. */
function alphabetical() {
  const sorted = [...VERIFIED_STATES].sort((a, b) =>
    stateName(a.code).localeCompare(stateName(b.code), "en"),
  );
  const groups: { letter: string; packs: typeof sorted }[] = [];
  for (const pack of sorted) {
    const letter = stateName(pack.code)[0].toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.packs.push(pack);
    else groups.push({ letter, packs: [pack] });
  }
  return groups;
}

export default function VerifyPage() {
  const groups = alphabetical();
  return (
    <>
      <DemeterNav path="/verify" />
      <main className="vpage" id="main-content">
        <header className="vpage__head">
          <h1 className="vpage__title">SNAP in your state</h1>
          {/* TWO SENTENCES, THEN A CREDIT LINE. The reader is here to find a
              row, not to read a page — every sentence above the list is a
              sentence between them and their agency, and on a phone the
              earlier four-sentence version filled the screen before a single
              state appeared. */}
          <p className="vpage__lede vpage__lede--lead">
            SNAP is one federal program, but every state runs it under its own
            name, through its own agency, with its own application. Find yours
            below.
          </p>
          <p className="vpage__lede">
            Each row is built from that state&apos;s own published rules, and from{" "}
            <a
              className="vpage__srclink"
              href="https://www.ecfr.gov/current/title-7/part-273"
              target="_blank"
              rel="noopener noreferrer"
            >
              7 CFR Part 273
            </a>
            .
          </p>
        </header>

        <p className="vstates__count">
          {VERIFIED_STATES.length} states and territories, alphabetically.
        </p>

        {groups.map(({ letter, packs }) => (
          <section
            className="vstates__group"
            key={letter}
            aria-labelledby={`letter-${letter}`}
          >
            <h2 className="vstates__letter" id={`letter-${letter}`}>
              {letter}
            </h2>
            <ul className="vstates__list">
              {packs.map((s) => (
                <li className="vrow" key={s.code}>
                  <div className="vrow__id">
                    <StateFlag code={s.code} size={34} />
                    <span className="vrow__name">
                      {stateName(s.code)}{" "}
                      <span className="vrow__code">({s.code})</span>
                    </span>
                  </div>

                  <div className="vrow__prog">
                    {/* Program first: it is what the state calls SNAP, and the
                        name on the form is what a reader is trying to match. */}
                    <span className="vrow__program">{programDisplayName(s.program)}</span>
                    <span className="vrow__agency">{agencyDisplayName(s.agency)}</span>
                  </div>

                  <div className="vrow__links">
                    {s.portal && (
                      <a
                        className="vrow__link vrow__link--portal"
                        href={s.portal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        // 53 links announcing "BenefitsCal" tells a screen
                        // reader user nothing about which row they are in.
                        aria-label={`${s.portal.name} — apply in ${stateName(s.code)} (opens in a new tab)`}
                      >
                        {/* Text and arrow in ONE inline box: the link is an
                            inline-flex (for its 44px target), so as two flex
                            items a wrapped portal name left the arrow stranded
                            against the right edge, a line below its own text. */}
                        <span className="vrow__linktext">
                          {s.portal.name} <span aria-hidden>↗</span>
                        </span>
                      </a>
                    )}
                    {/* The VISIBLE label is one word: 53 rows of "Ask Demeter
                        about Rhode Island" is a wall, and the nav tab and the
                        CTA at the foot both already say the long form. The
                        accessible name carries the state, because 53 links
                        announcing "Ask" is 53 indistinguishable destinations. */}
                    <Link
                      className="vrow__link vrow__link--ask"
                      href={`/chat?state=${s.code}`}
                      aria-label={`Ask Demeter about ${stateName(s.code)}`}
                    >
                      <span className="vrow__linktext">
                        Ask <span aria-hidden>→</span>
                      </span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* THE ONLY CTA ON THE PAGE, and the one thing the list cannot do:
            answer a question. Wheat, per the palette rule of one in-content
            next action — which is also why the 53 row links above are plain
            text rather than 53 buttons. */}
        <section className="vstates__ask">
          <p className="vstates__askbody">
            Not sure which rule applies to you, or your state isn&apos;t answering the
            question you actually have?
          </p>
          <Link className="vstates__askcta" href="/chat">
            Ask Demeter <span aria-hidden>→</span>
          </Link>
        </section>
      </main>
      <DemeterFooter />
    </>
  );
}
