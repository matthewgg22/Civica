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
  verify: "/verify",
  questions: "/questions",
  privacy: "/privacy",
  terms: "/terms",
  safety: "/safety",
  supporters: "/supporters",
  feedback: "/feedback",
} as const;

/** Paths with no localized route — always linked canonically. The three legal
 *  documents are published in English only for now, so a /es/terms would 404;
 *  when a translated one ships, drop it from here and add the [lang] route in
 *  the SAME change. */
const UNLOCALIZED: readonly string[] = [
  LINK_PATHS.privacy,
  LINK_PATHS.terms,
  LINK_PATHS.safety,
  LINK_PATHS.feedback,
  LINK_PATHS.supporters,
];

/** English is un-prefixed; everything else lives under /es|/vi|/zh. Privacy,
 *  feedback and supporters are exceptions — none has a localized route, so
 *  all three always point at the canonical page rather than a URL that would
 *  404. Supporters joined the list when #837 was picked up: the prefixed link
 *  had been 404ing from every localized page. If a localized supporters page
 *  ever ships, remove it from this list and add the [lang] route in the same
 *  change. */
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
            {/* The mission, in one line, in the reader's language. Reuses the
                orientation bar's own product sentence rather than inventing a
                second description that would drift from it. */}
            <p className="dmft__mission">{c.productLede}</p>
          </div>
        </div>

        <nav className="dmft__nav" aria-label="Footer">
          <Link className="dmft__link" href={href(LINK_PATHS.verify, lang)}>
            {c.statesLink}
          </Link>
          <Link className="dmft__link" href={href(LINK_PATHS.questions, lang)}>
            {c.questionsLink}
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
          <Link className="dmft__link" href={href(LINK_PATHS.supporters, lang)}>
            {c.footerSupporters}
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
