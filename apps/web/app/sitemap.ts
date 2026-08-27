// Sitemap, generated from the pack registry.
//
// The point of generating rather than hand-listing: every state pack that
// merges from here on indexes itself. Add Ohio's pack, redeploy, and
// /guides/oh is in the sitemap with no one remembering to add it.
//
// Priorities reflect what we actually want found. The guide pages are the
// acquisition surface — someone searching "does my car count for SNAP in
// Georgia" should land on /guides/ga, not the homepage — so they rank with
// the chat, above the supporter wall.

import type { MetadataRoute } from "next";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { absoluteUrl } from "../lib/site-url";
import { PREFIXED_LANGS } from "../lib/i18n/routes";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const core: MetadataRoute.Sitemap = [
    // /demeter 301s to /screen/ask (2026-08-09 merge) — list the real
    // destination so crawlers index the canonical URL directly rather than
    // discovering it only after following a redirect.
    //
    // /screen/ask (the plain chat) is the front door, not /screen (the
    // sign-in-or-guest household-screening tool with saved case files) —
    // deliberately un-tied priorities (2026-08-09, user decision): Demeter's
    // launch surface is the simple chatbot; /screen is a real secondary
    // feature, not what search engines should find first.
    { url: absoluteUrl("/screen/ask"), lastModified: now, changeFrequency: "daily", priority: 1.0 },
    // The form-question cards, moved off /screen/ask so that page could lead
    // with the product instead of a wall. High priority deliberately: this is
    // the page that answers the literal thing people type ("what does purchase
    // and prepare separately mean"), which is the highest-intent query the site
    // can win. Content that moved without a sitemap entry and an inbound link
    // is content that was deleted, as far as discovery is concerned.
    { url: absoluteUrl("/questions"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/screen"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/states"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/supporters"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  // The localized entry pages. Listed at the same priority as the canonical
  // chat: they are not duplicates but the same page in another language, and
  // the whole point of building them was to make the non-English content
  // reachable by crawlers at all.
  const localized: MetadataRoute.Sitemap = PREFIXED_LANGS.flatMap((lang) => [
    {
      url: absoluteUrl(`/${lang}/screen/ask`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    // The localized /questions pages carry MORE translated content than the
    // localized ask pages do — the form-question answers are fully translated,
    // while the ask page's general FAQ is English-only by design.
    {
      url: absoluteUrl(`/${lang}/questions`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    // The localized directory is the MOST translated page on the site: almost
    // all of it is agency and portal names, which are proper nouns and read
    // the same in every language. A Spanish reader gets essentially the whole
    // page, not an English one with a translated heading.
    {
      url: absoluteUrl(`/${lang}/states`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
  ]);

  // One entry per verified state; lastModified is the pack's own verification
  // date, so a re-verified pack legitimately signals freshness to crawlers.
  const guides: MetadataRoute.Sitemap = VERIFIED_STATES.map((s) => ({
    url: absoluteUrl(`/guides/${s.code.toLowerCase()}`),
    lastModified: new Date(s.verification.verified_on),
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  return [...core, ...localized, ...guides];
}
