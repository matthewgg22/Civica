// Pre-registered PER regression — flagship analysis page (/findings/regression).
//
// PUBLIC route (static segment under /findings, which is in
// FULLY_PUBLIC_PREFIXES; a real folder takes precedence over the sibling
// [id] dynamic segment, so this never collides with a finding named
// "regression"). Read by partners / counsel / funders as the shareable
// proof that Civica's "we cut the error rate" claim is measured by a plan
// fixed before the data — and by the Civica team to sanity-check the fit.
//
// All numbers come from apps/dashboard/lib/analytics/per-regression-results.json
// (emitted by tools/per-regression) via the pure loader in
// lib/analytics/per-regression.ts. No Supabase, no auth round-trip.

import type { Metadata } from "next";
import Link from "next/link";
import { getRegressionReport } from "../../../lib/analytics/per-regression";
import { getPolicyRegressionReport } from "../../../lib/analytics/policy-regression";
import RegressionEvidencePanel from "../../../components/findings/RegressionEvidencePanel";
import RegressionReplicationPanel from "../../../components/findings/RegressionReplicationPanel";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pre-registered error-rate analysis · Civica findings",
  description:
    "A regression plan locked before the data — does enrolling via Civica lower the SNAP payment error rate, speed decisions, and lift completion? Five pre-registered outcomes, fitted with statsmodels.",
  openGraph: {
    title: "Civica — pre-registered error-rate analysis",
    description:
      "Five pre-registered outcomes, OLS / logistic / Poisson, with confidence intervals. The measurement plan was fixed before the data.",
    type: "article",
    publishedTime: "2026-05-28",
  },
};

export default function RegressionFindingPage() {
  const report = getRegressionReport();
  const policyReport = getPolicyRegressionReport();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      {/* Breadcrumb back to the ledger index. */}
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
          Flagship analysis
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Does Civica cut the error rate?
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-graphite">
          A regression whose plan was locked before the data. Five
          pre-registered outcomes — payment error, decision speed, handoff and
          recertification completion, navigator throughput — each estimated
          with controls held constant, reported with a confidence interval and
          a p-value.
        </p>
        <p className="mt-3 text-sm text-graphite">
          The plan of record is finding{" "}
          <Link
            href="/findings/2026-05-28-per-regression-preregistration"
            className="text-pine underline-offset-2 hover:underline"
          >
            per-regression pre-registration
          </Link>
          .
        </p>
      </header>

      <RegressionEvidencePanel report={report} />

      {/* External replication on real public data — the mechanism test that
          stands while Civica's own production data is still pending. */}
      <div className="my-14 border-t border-graphite/15" />
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wider text-graphite">
          External replication
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Does lower burden actually raise enrollment?
        </h2>
        <p className="mt-3 text-base leading-relaxed text-graphite">
          The plan above measures Civica directly, but waits on production data.
          So here is the mechanism, measured now on 25 years of public
          state-panel data: when states cut the paperwork — simplified
          reporting, call centers, broad-based categorical eligibility — does
          participation rise? It does, and the effect is the kind a perfect,
          low-friction application is built to capture.
        </p>
      </header>

      <RegressionReplicationPanel report={policyReport} />
    </main>
  );
}
