// Error-rate credibility one-pager — live page (/findings/error-rate).
//
// PUBLIC route (static segment under /findings, in FULLY_PUBLIC_PREFIXES; a real
// folder takes precedence over the sibling [id] dynamic segment). This is the
// "dashboard page that operates as the one-pager": the credibility narrative AND
// the live truth point, in one shareable surface.
//
// Reads the LIVE snapshot via getErrorRateTruthPoint() (server-only, service-role
// client) — so the numbers are current. Degrades to a "pending" state when the
// snapshot is unpopulated or the service key is absent. See
// docs/findings/2026-05-29-error-rate-truth-point.md.

import type { Metadata } from "next";
import Link from "next/link";
import { getErrorRateTruthPoint } from "../../../lib/analytics/error-rate-snapshot";
import ErrorRateOnePager from "../../../components/findings/ErrorRateOnePager";

// Live data — revalidate every 5 minutes (the snapshot refreshes daily + on demand).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Error-rate credibility · Civica findings",
  description:
    "Why Civica's SNAP error-rate claims are auditable: a pre-registered regression, a canonical truth point, and an honest guardrail — with the live numbers and the published reference layer in one place.",
  openGraph: {
    title: "Civica — why you can audit our error-rate claims",
    description:
      "Pre-registered regression + canonical truth point + honest guardrail, with the live snapshot and USDA reference layer.",
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
          Credibility
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Why you can audit our error-rate claims
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-graphite">
          Every vendor says it cuts the error rate. Civica instruments the claim
          honestly — the plan locked before the data, one engine-computed number,
          and a guardrail that refuses to dress up a non-signal as a result. Here
          is the method, the live reading, and what the published data already
          supports.
        </p>
      </header>

      <ErrorRateOnePager truthPoint={truthPoint} />
    </main>
  );
}
