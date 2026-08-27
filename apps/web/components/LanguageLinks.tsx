// The four language links, on the front door only.
//
// EXTRACTED FROM THE NAV RATHER THAN DELETED WITH IT. The site nav is gone
// from every page (owner, 2026-08-27) and these went with it — but they were
// put there to fix a specific failure, recorded in e2e/smoke.spec.ts: "a
// Spanish speaker arriving on the English page had no way across". Removing
// the bar was the request; recreating that failure was not.
//
// FRONT DOOR ONLY, because that is where it bites. `/` redirects to
// /screen/ask in English, so first contact is the one moment a reader has no
// other route to their language. Everywhere else the language is already
// carried: the back link, the footer and every in-page link are built from
// the lang the reader is on, so a Spanish reader stays in Spanish without
// ever touching a switcher.
//
// Real links to real routes, not client state — a crawler follows them, which
// is how the localized pages are reachable at all.

import Link from "next/link";
import { ANSWER_LANGS, LANG_NATIVE_NAME, type AnswerLang } from "@civica/demeter-engine/packs";

export function LanguageLinks({
  lang = "en",
  path = "/screen/ask",
}: {
  lang?: AnswerLang;
  path?: string;
}) {
  return (
    <nav className="dmlangs" aria-label="Language">
      {ANSWER_LANGS.map((l) => (
        <Link
          key={l}
          className="dmlangs__link"
          href={l === "en" ? path : `/${l}${path}`}
          hrefLang={l}
          aria-current={l === lang ? "true" : undefined}
        >
          {LANG_NATIVE_NAME[l]}
        </Link>
      ))}
    </nav>
  );
}
