// The Demeter header. One bar, present on every Demeter surface.
//
// Until now there was no site header at all: the mark lived inside the chat
// card, so there was nothing above the fold saying you were on a product with
// more than one page, and no way to reach the chat from anywhere except the
// landing page's own card.
//
// Two tabs, deliberately. "Ask" is the tool, "Questions" is the reference. That
// is the whole product, and a nav that lists everything a site technically has
// is how a two-page product starts looking like a directory.

import Link from "next/link";
import { DemeterMark } from "./DemeterMark";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { ANSWER_LANGS, LANG_NATIVE_NAME, type AnswerLang } from "@civica/demeter-engine/packs";

/** Which tab is lit. Passed explicitly rather than read from the pathname so
 *  this stays a server component — a usePathname() here would push the whole
 *  header (and its mark) into the client bundle for a purely static highlight. */
export type DemeterTab = "ask" | "questions" | null;

export function DemeterNav({
  lang = "en",
  active = null,
  /** The un-prefixed path of the page this nav is on, so the language links
   *  keep the reader where they are instead of resetting them to the chat.
   *  Passed in rather than read from usePathname() to keep this a server
   *  component — a hook here would ship the whole header, mark included, to
   *  the client for a static highlight. */
  path = "/screen/ask",
}: {
  lang?: AnswerLang;
  active?: DemeterTab;
  path?: string;
}) {
  const c = PAGE_COPY[lang];
  const p = (route: string) => (lang === "en" ? route : `/${lang}${route}`);
  const currentPath = path;

  return (
    <header className="dmnav">
      {/* FIRST focusable on the page (vercel-guidelines finding 2): a
          keyboard or screen-reader user otherwise walks the brand, two tabs
          and four language links on every page before reaching content — on
          /chat, before reaching the composer. Visible only while focused. */}
      <a className="dmnav__skip" href="#main-content">
        {c.skipToContent}
      </a>
      <div className="dmnav__inner">
        <Link className="dmnav__brand" href={p("/screen/ask")} aria-label="Demeter">
          {/* The mark carries the brand in a bar that is otherwise all text —
              at 30px it sat below the wordmark-plus-subtitle stack it is meant
              to anchor. 44 matches that stack's height. */}
          <DemeterMark size={44} />
          <span className="dmnav__brandtext">
            <span className="dmnav__wordmark" translate="no">Demeter</span>
            {/* A one-line subtitle, so the wordmark alone is not the only thing
                telling a first-time visitor what this is. "Demeter" is a Greek
                harvest goddess; on its own it says nothing about SNAP. */}
            <span className="dmnav__subtitle">{c.brandSubtitle}</span>
          </span>
        </Link>

        <nav className="dmnav__tabs" aria-label="Demeter">
          {/* THE PRODUCT. Everything else in this bar is supporting material,
              and a first-time visitor has no way to know that from a row of
              evenly-weighted text links — the one thing they came to use looked
              exactly like the reference page beside it. Filled, in the logo's
              wheat, so the eye lands on it first. */}
          <Link
            className="dmnav__tab dmnav__tab--primary"
            href={p("/chat")}
            aria-current={active === "ask" ? "page" : undefined}
          >
            {c.navAsk}
          </Link>
          <Link
            className="dmnav__tab"
            href={p("/questions")}
            aria-current={active === "questions" ? "page" : undefined}
          >
            {c.navQuestions}
          </Link>
        </nav>

        {/* LANGUAGE BELONGS HERE, not inside the chat. It used to be a <select>
            in the chat card, which meant the landing page lost the switcher
            entirely the moment the chat moved to /chat — a Spanish speaker
            landing on the English page had no way across.

            Real links to the real localized routes, not client state: a crawler
            follows them, and switching language keeps you on the page you were
            reading rather than resetting you to the chat. */}
        <nav className="dmnav__langs" aria-label="Language">
          {ANSWER_LANGS.map((l) => (
            <Link
              key={l}
              className="dmnav__lang"
              href={l === "en" ? currentPath : `/${l}${currentPath}`}
              hrefLang={l}
              aria-current={l === lang ? "true" : undefined}
            >
              {LANG_NATIVE_NAME[l]}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
