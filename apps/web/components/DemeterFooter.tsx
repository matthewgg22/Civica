// The graphite footer. Every Demeter surface ends here.
//
// The page had no footer at all: it ran out of content and stopped on the same
// paper background it started on, which is why the bottom read as unfinished
// rather than closed. A dark band is the cheapest possible signal that a page
// has an end, and it is where the obligations live — who runs this, what it is
// not, where the privacy policy is.
//
// Dark on a light site is a deliberate break, not decoration. It marks the
// footer as a different KIND of content: everything above is the product
// talking to you, everything here is the organization disclosing.

import Link from "next/link";
import { DemeterMark } from "./DemeterMark";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import type { AnswerLang } from "@civica/demeter-engine/packs";

const LINK_PATHS = {
  states: "/states",
  privacy: "/privacy",
  terms: "/terms",
  safety: "/safety",
  feedback: "/feedback",
} as const;

/** Paths with no localized route — always linked canonically. The three legal
 *  documents are published in English only for now, so a /es/terms would 404;
 *  when a translated one ships, drop it from here and add the [lang] route in
 *  the SAME change.
 *
 *  /verify was on this list, because there was no app/[lang]/verify route and
 *  its link 404'd from every Spanish, Vietnamese and Chinese page — the same
 *  defect supporters had in #837. It is off the list again now that the page
 *  is /states and app/[lang]/states EXISTS: a path belongs here only while it
 *  has no localized route, and comes off the day it gets one. FEEDBACK came off
 *  the same way (launch audit 2026-08-28): app/[lang]/feedback now exists, so
 *  the prefixed link resolves in every language. */
const UNLOCALIZED: readonly string[] = [
  LINK_PATHS.privacy,
  LINK_PATHS.terms,
  LINK_PATHS.safety,
];

/** English is un-prefixed; everything else lives under /es|/vi|/zh. The three
 *  legal documents are the exceptions — none has a localized route, so each
 *  points at the canonical page rather than a URL that would 404.
 *
 *  The rule was learned three times, from links that are all handled now:
 *  supporters (#837), verify, and feedback — each was once prefixed into a
 *  route that did not exist, or held canonical after its route shipped. Keep
 *  the list honest in BOTH directions — a path goes on it the day it loses its
 *  localized route and comes off the day it gets one. */
function href(path: string, lang: AnswerLang): string {
  if (UNLOCALIZED.includes(path)) return path;
  return lang === "en" ? path : `/${lang}${path}`;
}

export function DemeterFooter({ lang = "en" }: { lang?: AnswerLang }) {
  const c = PAGE_COPY[lang];
  return (
    <footer className="dmft">
      <div className="dmft__inner">
        <div className="dmft__brand">
          <DemeterMark size={32} />
          <div>
            <p className="dmft__name">Demeter</p>
            {/* ONE LINE. It used to reuse the orientation bar's product lede
                — the same sentence, three lines of serif — which is what left
                a tall brand block with nothing under it. A footer mission is a
                caption, not a pitch. */}
            <p className="dmft__mission">{c.footerMission}</p>
          </div>
        </div>

        {/* ONE ROW OF FIVE, not three named groups.
            The groups earned their place at seven links with mixed registers.
            "Application questions" and "Supporters" are gone, and five short
            nouns do not need headings to be scannable — a heading per group
            would be more chrome than content. */}
        <nav className="dmft__nav" aria-label="Footer">
          <Link className="dmft__link" href={href(LINK_PATHS.states, lang)}>
            {c.footerStates}
          </Link>
          <Link className="dmft__link" href={LINK_PATHS.privacy}>
            {c.footerPrivacy}
          </Link>
          <Link className="dmft__link" href={LINK_PATHS.terms}>
            {c.footerTerms}
          </Link>
          <Link className="dmft__link" href={LINK_PATHS.safety}>
            {c.footerSafety}
          </Link>
          <Link className="dmft__link" href={href(LINK_PATHS.feedback, lang)}>
            {c.footerFeedback}
          </Link>
        </nav>

        {/* The disclosures. Not fine print in the legal sense — these are the
            two things someone acting on an answer most needs to know, so they
            are set at readable size rather than hidden at 10px. */}
        <div className="dmft__legal">
          <p>{c.footerDisclaimer}</p>
          <p className="dmft__org">{c.footerOrg}</p>
        </div>
      </div>
    </footer>
  );
}
