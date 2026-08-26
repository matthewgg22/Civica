// The /states page body, shared by the canonical route and the localized ones.
//
// Everything reader-facing is resolved HERE, on the server, and handed to
// StateDirectory as finished strings: the client component never sees a pack,
// so the model-facing program/agency/portal.name fields cannot reach a reader
// through it (#931). The display forms come from the pack itself now — see
// scripts/backfill-pack-display-fields.ts — rather than from text surgery run
// on every render.

import Link from "next/link";
import { VERIFIED_STATES, type AnswerLang } from "@civica/demeter-engine/packs";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { hasLocalProgramName } from "../lib/program-name";
import { stateName } from "../lib/state-names";
import { StateDirectory, type DirectoryCopy, type DirectoryRow } from "./StateDirectory";
import { DemeterFooter } from "./DemeterFooter";

/** Alphabetical by the state's NAME, not its code — someone scanning for
 *  "Washington" is not looking under W-A, and DC belongs under D rather than
 *  under its code. Derived, so a pack merged tomorrow lands in the right place
 *  without anyone remembering to re-sort. */
export function directoryRows(lang: AnswerLang = "en"): DirectoryRow[] {
  const c = PAGE_COPY[lang].directory;
  return [...VERIFIED_STATES]
    .sort((a, b) => stateName(a.code).localeCompare(stateName(b.code), "en"))
    .map((s) => ({
      code: s.code,
      name: stateName(s.code),
      // Null on the 44 packs that just say "SNAP": that is the page's own
      // subject, and printing it 44 times down a column hid the nine states
      // that actually have a local name.
      programLabel: hasLocalProgramName(s.programShort) ? s.programShort : null,
      agencyLabel: s.agencyShort,
      countyAdministered: s.adminModel === "county",
      portal: s.portal
        ? {
            url: s.portal.url,
            label: s.portal.short,
            note: s.portal.note ?? null,
            // Resolved here, on the server: the copy's per-row formatters are
            // functions, and a function passed to a client component is a
            // prerender error rather than a type error.
            applyLabel: c.applyIn(s.portal.short, stateName(s.code)),
          }
        : null,
      applyNote: s.applyNote ?? null,
      askLabel: c.askAbout(stateName(s.code)),
    }));
}

/** The client component's copy, listed FIELD BY FIELD rather than spread from
 *  PAGE_COPY[lang].directory.
 *
 *  Spreading it compiles, typechecks and passes every unit test, then fails
 *  the production build: the full object still carries askAbout and applyIn,
 *  which are functions, and a function cannot cross into a client component.
 *  DirectoryCopy being a structural subset is exactly what hides that — the
 *  extra keys ride along invisibly. Naming them is the only version that
 *  cannot silently regain a formatter. */
function directoryCopy(lang: AnswerLang): DirectoryCopy {
  const c = PAGE_COPY[lang].directory;
  return {
    searchLabel: c.searchLabel,
    searchPlaceholder: c.searchPlaceholder,
    clear: c.clear,
    countyTag: c.countyTag,
    ask: c.ask,
    noMatch: c.noMatch,
    noMatchAsk: c.noMatchAsk,
    countedAll: c.countedAll,
    countedSome: c.countedSome,
  };
}

export function StateDirectoryPage({ lang = "en" }: { lang?: AnswerLang }) {
  const c = PAGE_COPY[lang].directory;
  const rows = directoryRows(lang);
  const chatHref = lang === "en" ? "/chat" : `/${lang}/chat`;
  // The citation renders verbatim and never translates (DEMETER-DESIGN §2.1),
  // so the copy carries a placeholder and each language decides where in the
  // sentence it goes.
  const [beforeRule, afterRule] = c.sources.split("{rule}");

  return (
    <>
      {/* NO SITE NAV, owner's call — the same one made for /chat (2026-08-22).
          The bar carried a brand, two tabs and four language links above a page
          whose entire job is one list, and on a phone that was most of the
          first screen. What a reader needs here is the way back, so that is
          all there is.

          It is also the FIRST focusable element, which is why this page needs
          no skip link: there is nothing to skip. */}
      <main className="vpage vpage--states" id="main-content">
        <header className="vpage__head">
          <Link className="vback" href={chatHref}>
            <span className="vback__arrow" aria-hidden>
              ←
            </span>
            {c.back}
          </Link>
          <h1 className="vpage__title">{c.h1}</h1>
          {/* ONE SENTENCE, then the sources line. The reader is here to find a
              row, not to read a page — every sentence above the list is a
              sentence between them and their agency, and on a phone a longer
              version filled the screen before a single state appeared. */}
          <p className="vpage__lede vpage__lede--lead">{c.lede}</p>
          <p className="vpage__lede">
            {beforeRule}
            <a
              className="vpage__srclink"
              href="https://www.ecfr.gov/current/title-7/part-273"
              target="_blank"
              rel="noopener noreferrer"
            >
              7 CFR Part 273
            </a>
            {afterRule}
          </p>
        </header>

        <StateDirectory rows={rows} copy={directoryCopy(lang)} chatHref={chatHref} />

        {/* THE ONLY CTA ON THE PAGE, and the one thing a list cannot do:
            answer a question. Wheat, per the palette rule of one in-content
            next action — which is also why the 53 row links are plain text
            rather than 53 buttons. */}
        <section className="vstates__ask">
          <p className="vstates__askbody">{c.ctaBody}</p>
          <Link className="vstates__askcta" href={chatHref}>
            {c.ctaLink} <span aria-hidden>→</span>
          </Link>
        </section>
      </main>
      <DemeterFooter lang={lang} />
    </>
  );
}
