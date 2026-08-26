// URL shape for the localized entry pages, in one place so the route, the
// metadata, the sitemap and the hreflang set cannot disagree.
//
//   English  →  /screen/ask          (canonical, un-prefixed)
//   Others   →  /es/screen/ask, /vi/screen/ask, /zh/screen/ask
//
// English stays un-prefixed deliberately: it is the existing indexed URL, and
// moving it to /en/ would throw away whatever ranking it has for a purely
// cosmetic symmetry.

import { ANSWER_LANGS, LANG_TAG, type AnswerLang } from "@civica/demeter-engine/packs";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "");

/** Path for a page in a given language. */
export function askPath(lang: AnswerLang): string {
  return lang === "en" ? "/screen/ask" : `/${lang}/screen/ask`;
}

/** Absolute URL, or the path when no canonical host is configured — the same
 *  "never train Google on a preview hostname" rule the sitemap already follows. */
export function askUrl(lang: AnswerLang): string {
  return SITE_URL ? `${SITE_URL}${askPath(lang)}` : askPath(lang);
}

/** Same shape for /questions, which carries the form-question cards moved off
 *  the ask page. Its own hreflang SET, not the ask page's — pointing a
 *  /questions alternate at /screen/ask would annotate two different pages as
 *  translations of each other, which is worse than no annotation. */
export function questionsPath(lang: AnswerLang): string {
  return lang === "en" ? "/questions" : `/${lang}/questions`;
}

export function questionsUrl(lang: AnswerLang): string {
  return SITE_URL ? `${SITE_URL}${questionsPath(lang)}` : questionsPath(lang);
}

/** The hreflang set every localized page must carry — all four languages plus
 *  x-default. Every page in the set links to EVERY page in the set (including
 *  itself); a partial set is the most common way hreflang silently stops
 *  working, because search engines require the annotations to be reciprocal.
 *
 *  Takes the URL builder so each page family annotates its OWN set. */
export function alternateLanguages(
  url: (lang: AnswerLang) => string = askUrl,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of ANSWER_LANGS) out[LANG_TAG[l]] = url(l);
  out["x-default"] = url("en");
  return out;
}

/** Languages that get a prefixed route (everything except the canonical). */
export const PREFIXED_LANGS = ANSWER_LANGS.filter((l): l is Exclude<AnswerLang, "en"> => l !== "en");

/** Same shape again for /states, the jurisdiction directory.
 *
 *  It was /verify, a page about our verification pipeline, and it is now a
 *  list of every state's programme, agency and application link. The old URL
 *  redirects (next.config.ts) rather than 404ing, because it is indexed and
 *  linked from the chat, the landing page and the footer.
 *
 *  Unlike /verify, this one HAS localized routes — which is what makes it safe
 *  for the footer to prefix the link by language again. */
export function statesPath(lang: AnswerLang): string {
  return lang === "en" ? "/states" : `/${lang}/states`;
}

export function statesUrl(lang: AnswerLang): string {
  return SITE_URL ? `${SITE_URL}${statesPath(lang)}` : statesPath(lang);
}
