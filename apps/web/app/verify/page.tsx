// /verify — SNAP, state by state. Who runs it where you live, what it is
// called there, where you actually apply, and a way to ask about it.
//
// THIS PAGE USED TO BE A BUILD SHEET. It opened with three paragraphs about
// our own pipeline and a live grounded-rate readout, then rendered 53 state
// cards, each carrying a "Verified" badge, a source count, a corrections
// count and a verification date. That is internal provenance wearing a public
// page — and it made the one thing a reader came for, "what happens in MY
// state", the hardest thing to find: 53 boxes of unequal height, in ship order
// rather than alphabetical.
//
// DELIBERATELY GONE, and not to be re-added "just one line" at a time: the
// certainty-rate figure, per-state source counts, correction counts,
// verification dates, and the description of the pipeline. None of it helps a
// person find their agency.
//
// WHAT A ROW PRINTS IS NOW A SUBTRACTION, TOO. The packs carry more than this
// and the earlier pass showed all of it: the program name on all 53 rows even
// though 44 of them just say "SNAP", and the full agency string even where
// that runs to 211 characters of division and sub-division. Both are filtered
// at the display edge (lib/program-name.ts) so the corpus the model reads
// stays exactly as verified while the page shows only what varies.

import type { Metadata } from "next";
import Link from "next/link";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import {
  hasLocalProgramName,
  primaryAgency,
  programDisplayName,
  splitPortalName,
} from "../../lib/program-name";
import { StateFlag } from "../../components/StateFlag";
import { DemeterNav } from "../../components/DemeterNav";
import { DemeterFooter } from "../../components/DemeterFooter";
import { stateName } from "../../lib/state-names";

const TITLE = "SNAP by state — the agency that runs it, and where to apply";
const DESCRIPTION =
  "Every state and territory Demeter covers, alphabetically: the local name for SNAP where there is one, the agency that administers it, and a direct link to that agency's own application.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
};

/** Alphabetical by the state's NAME, not its code — someone scanning for
 *  "Washington" is not looking under W-A, and DC belongs under D rather than
 *  under its code. Grouped by initial so the eye can jump rather than read 53
 *  rows in sequence. Derived, so a pack merged tomorrow lands in the right
 *  place without anyone remembering to re-sort. */
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
      <main className="vpage vpage--states" id="main-content">
        <header className="vpage__head">
          <h1 className="vpage__title">SNAP in your state</h1>
          {/* TWO SENTENCES. The reader is here to find a row, not to read a
              page — every sentence above the list is a sentence between them
              and their agency. */}
          <p className="vpage__lede vpage__lede--lead">
            SNAP is one federal program, but every state runs it under its own
            name, through its own agency, with its own application.
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

        {/* WAYFINDING, not decoration. 53 rows is roughly four phone screens of
            scrolling to reach Wyoming; this is the difference between a list
            you scan and a list you endure. It replaced an all-caps label that
            said "53 states and territories, alphabetically" — a sentence
            describing what the reader could already see. */}
        <nav className="vjump" aria-label="Jump to a letter">
          {groups.map(({ letter }) => (
            <a className="vjump__letter" key={letter} href={`#letter-${letter}`}>
              {letter}
            </a>
          ))}
        </nav>

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
              {packs.map((s) => {
                const portal = s.portal ? splitPortalName(s.portal.name) : null;
                return (
                  <li className="vrow" key={s.code}>
                    <div className="vrow__id">
                      <StateFlag code={s.code} size={34} />
                      <span className="vrow__name">
                        {stateName(s.code)}{" "}
                        <span className="vrow__code">({s.code})</span>
                      </span>
                    </div>

                    <div className="vrow__prog">
                      {/* Only where the state calls it something else. On the
                          44 rows that just say "SNAP", the line is the page's
                          own title repeated, and printing it 44 times hid the
                          nine names that actually distinguish a state. */}
                      {hasLocalProgramName(s.program) && (
                        <span className="vrow__program">{programDisplayName(s.program)}</span>
                      )}
                      <span className="vrow__agency">
                        {primaryAgency(s.agency)}
                        {/* Recovers, as data, the "administered locally by the
                            County Departments of…" clause trimmed off the
                            agency string — and says the operative thing: in
                            these states you deal with your county. */}
                        {s.adminModel === "county" && (
                          <span className="vrow__admin"> · county-administered</span>
                        )}
                      </span>
                    </div>

                    <div className="vrow__links">
                      {s.portal && portal && (
                        <span className="vrow__portal">
                          <a
                            className="vrow__link vrow__link--portal"
                            href={s.portal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            // 53 links announcing "Apply" tells a screen reader
                            // user nothing about which row they are in.
                            aria-label={`${s.portal.name} — apply in ${stateName(s.code)} (opens in a new tab)`}
                          >
                            {/* Text and arrow in ONE inline box: the link is an
                                inline-flex (for its 44px target), so as two flex
                                items a wrapped portal name left the arrow
                                stranded against the right edge. */}
                            <span className="vrow__linktext">
                              {portal.label} <span aria-hidden>↗</span>
                            </span>
                          </a>
                          {/* KEPT, not dropped. Some of these parentheticals
                              expand an acronym and some carry the only warning
                              on the row — New York's "statewide EXCEPT NYC",
                              Wyoming's "paper application only". Nothing here
                              is safe to throw away on a page about where to
                              file an application. */}
                          {portal.note && <span className="vrow__note">{portal.note}</span>}
                        </span>
                      )}
                      {/* The VISIBLE label is one word: 53 rows of "Ask Demeter
                          about Rhode Island" is a wall, and the nav tab and the
                          CTA at the foot both already say the long form. The
                          accessible name carries the state, because 53 links
                          announcing "Ask" is 53 indistinguishable
                          destinations. */}
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
                );
              })}
            </ul>
          </section>
        ))}

        {/* THE ONLY CTA ON THE PAGE, and the one thing the list cannot do:
            answer a question. Wheat, per the palette rule of one in-content
            next action — which is also why the 53 row links above are plain
            text rather than 53 buttons. */}
        <section className="vstates__ask">
          <p className="vstates__askbody">
            A list can tell you who runs SNAP. It can&apos;t tell you whether you
            qualify.
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
