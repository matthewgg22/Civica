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
    { url: absoluteUrl("/screen"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/verify"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/supporters"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  // One entry per verified state; lastModified is the pack's own verification
  // date, so a re-verified pack legitimately signals freshness to crawlers.
  const guides: MetadataRoute.Sitemap = VERIFIED_STATES.map((s) => ({
    url: absoluteUrl(`/guides/${s.code.toLowerCase()}`),
    lastModified: new Date(s.verification.verified_on),
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  return [...core, ...guides];
}
