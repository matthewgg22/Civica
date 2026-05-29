// Retention readout — page (/findings/retention).
//
// PUBLIC route (static segment under /findings, in FULLY_PUBLIC_PREFIXES; a real
// folder takes precedence over the sibling [id] dynamic segment). The companion
// to /findings/error-rate: the error page covers the APPLICATION side; this covers
// the RENEWAL side — where eligible Californians lose benefits at reporting time.
//
// Static — renders published CDSS CF-18 data via the cited const
// lib/analytics/cf18-churn. See docs/findings/2026-05-29-cdss-cf18-churn.md.

import type { Metadata } from "next";
import Link from "next/link";
import RetentionReadout from "../../../components/findings/RetentionReadout";

// Published state data; revalidate hourly (it changes monthly).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Where SNAP benefits are lost at renewal · Civica",
  description:
    "A perfect application is only half the job. Using California's own CF-18 churn data, here is where eligible households lose CalFresh at renewal — and why it is an operational problem, not an eligibility one.",
  openGraph: {
    title: "Civica — where SNAP benefits are lost at renewal",
    description:
      "Eligible Californians lose benefits at recertification and semi-annual reporting. CDSS CF-18 shows how much, where it is worst, and why a tool fixes it.",
    type: "article",
  },
};

export default function RetentionPage() {
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
          The retention surface
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Where benefits are lost at renewal
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-graphite">
          Getting approved is only half the job. The other half is the{" "}
          <strong className="font-semibold text-ink">perfect renewal</strong> —
          because thousands of eligible California families lose CalFresh every
          month not at the application, but at the report and recertification that
          come after. California publishes exactly how often, county by county. This
          is that map.
        </p>
      </header>

      <RetentionReadout />
    </main>
  );
}
