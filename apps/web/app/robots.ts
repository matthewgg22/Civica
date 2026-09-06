// robots.txt
//
// Two deliberate choices:
//
// 1. /api/* is disallowed. Those routes stream answers and cost real money per
//    request; a crawler walking them would burn the monthly spend ceiling on
//    nobody. The gate would shed the load, but the honest fix is to not invite
//    it.
//
// 2. Until a canonical domain is configured we tell crawlers to stay out
//    entirely. Indexing a per-deployment Vercel hostname trains Google on URLs
//    that die on the next push, and those stale results outlive the mistake by
//    months. Set NEXT_PUBLIC_SITE_URL and the site opens itself.

import type { MetadataRoute } from "next";
import { absoluteUrl, hasCanonicalDomain } from "../lib/site-url";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  if (!hasCanonicalDomain()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Metered answer endpoints — a crawler here burns the spend ceiling.
          "/api/",
          // Sentry's same-origin envelope tunnel (withSentryConfig tunnelRoute).
          "/monitoring",
          // Parked Civica applicant portal (the "CalFresh for CA college
          // students" enrollment flow). Not the Demeter product; kept out of
          // the index. Each route also carries a noindex meta as a backstop.
          "/welcome",
          "/why-civica",
          "/apply",
          "/status",
          "/documents/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
