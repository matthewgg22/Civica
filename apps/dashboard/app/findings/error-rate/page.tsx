// Error-rate credibility one-pager — live page (/findings/error-rate).
//
// PUBLIC route (static segment under /findings, in FULLY_PUBLIC_PREFIXES; a real
// folder takes precedence over the sibling [id] dynamic segment). The dashboard
// page that operates as the one-pager: the perfect-application ethos + the live
// truth point, in one shareable surface, legible to a caseworker (no data-science
// background needed).
//
// Reads the LIVE snapshot via getErrorRateTruthPoint() (server-only, service-role
// client). Degrades to a "pending" state when unpopulated. See
// docs/findings/2026-05-29-error-rate-truth-point.md.

import type { Metadata } from "next";
import Link from "next/link";
import { getErrorRateTruthPoint } from "../../../lib/analytics/error-rate-snapshot";
import ErrorRateOnePager from "../../../components/findings/ErrorRateOnePager";

// Live data — revalidate every 5 minutes (the snapshot refreshes daily + on demand).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Where SNAP errors come from · Civica",
  description:
    "The best thing an applicant can submit is a perfect application. Here is where California SNAP applications go wrong, who it hits, and how Civica perfects each part — mapped from federal data before we built the product.",
  openGraph: {
    title: "Civica — where SNAP errors come from, and how to get them right",
    description:
      "A perfect application is the goal; the error rate is the scoreboard. Where errors live, who has them, and the verification that removes each.",
    type: "article",
  },
};

export default async function ErrorRatePage() {
  const truthPoint = await getErrorRateTruthPoint();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <nav className="mb-8 text-sm">
        <Link
          href="/findings"
          className="text-graphite underline-offset-2 hover:text-pine hover:underline"
        >
          ← All findings
        </Link>
      </nav>

      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wider text-graphite">
          The error surface
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Where California&rsquo;s SNAP errors come from
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-graphite">
          The best thing an applicant can submit is a <strong className="font-semibold text-ink">perfect application</strong> —
          complete, correct, verified, approved at the right amount with nothing
          to fix later. Every error is just a piece that came out wrong. So before
          we built anything, we mapped exactly where applications go wrong, who it
          hits, and why — to perfect each piece. This is that map.
        </p>
      </header>

      <ErrorRateOnePager truthPoint={truthPoint} />
    </main>
  );
}
