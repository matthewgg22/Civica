// Per-county compliance brief — /compliance/county/[slug]
//
// PUBLIC route. Read by:
//   • a procurement officer who wants to forward Council a single-county
//     view of CA's §10105 / §10102 exposure rather than the full /compliance
//     scoreboard. Linkable, OG-card'd, no auth required.
//   • a county director landing here from a Civica outbound email; viewing
//     the page is the lead-intelligence signal that drives the B2G follow-up.
//
// Public access is enforced in middleware.ts via FULLY_PUBLIC_PREFIXES
// (see apps/dashboard/lib/roleRouting.ts). The route renders to anyone —
// no Supabase round-trip, no AppHeader (the header implies authenticated
// nav and a sign-out button that would mislead unauthenticated viewers).
//
// Data: pulls entirely from apps/dashboard/lib/countyExposure.ts (compiled
// in JS, no DB). The 58 CA county slugs are pre-rendered via
// generateStaticParams so every URL maps to a static page.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCountyExposure,
  listSupportedCounties,
  rankedByExposure,
} from "../../../../lib/countyExposure";
import CountyLeaderboard from "../../../../components/CountyLeaderboard";
import StatePerTrendRibbon from "../../../../components/StatePerTrendRibbon";

// Re-render at most hourly. Page is static-ish (countyExposure.ts is
// compiled in) but the hourly window leaves room for future data refresh
// without an explicit deploy.
export const revalidate = 3600;

// TODO(procurement-inbox): swap to the real Civica B2G inbox once domain
// is live. Used in the bottom CTA mailto: link.
const PROCUREMENT_INBOX = "hello@civica.app";

// Pre-render every supported county slug at build time. Cleaner caching +
// gives Next.js's OG image generator a stable URL list to crawl.
export async function generateStaticParams() {
  return listSupportedCounties().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const county = getCountyExposure(slug);
  if (!county) return { title: "County not found · Civica compliance" };

  const title = `${county.displayName} · SNAP §10105 exposure · Civica`;
  const description = `${county.displayName} faces an estimated ${county.estimatedExposureLabel} in cumulative §10105 federal admin-match exposure over FY2026–FY2028 (~${county.caseloadSharePctLabel} of California's CalFresh caseload).`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CountyCompliancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const county = getCountyExposure(slug);
  if (!county) {
    notFound();
  }

  // Pre-compute the county's overall rank so the page can tell the reader
  // how their county compares to the rest of the state without re-running
  // the sort in the JSX.
  const ranked = rankedByExposure();
  const overallRank = ranked.findIndex((c) => c.slug === county.slug) + 1;
  const totalCounties = ranked.length;
  const inTop20 = overallRank > 0 && overallRank <= 20;

  const mailtoSubject = encodeURIComponent(
    `Civica review for ${county.displayName}`,
  );
  const mailtoHref = `mailto:${PROCUREMENT_INBOX}?subject=${mailtoSubject}`;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8 space-y-6">
        {/* Lightweight wordmark — no nav, no sign-out. Page is public so
            we don't surface authenticated chrome. */}
        <div className="flex items-center justify-between gap-4 mb-2">
          <Link href="/compliance" className="flex items-center gap-2.5 group" prefetch={false}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/civica-mark.svg"
              alt="Civica"
              width={28}
              height={28}
              className="w-7 h-7 rounded-[6px] ring-1 ring-hairline"
            />
            <div>
              <p className="text-[14px] font-semibold tracking-tight text-ink leading-none">
                Civica
              </p>
              <p className="text-[9px] text-muted mt-0.5 uppercase tracking-wider font-semibold">
                Compliance brief
              </p>
            </div>
          </Link>
          <p className="text-[10px] text-muted font-mono tracking-wide">
            Public · §10105 measurement window FY2026–FY2028
          </p>
        </div>

        {/* Header card — eyebrow + H1 + subtitle. Mirrors the /cdss header
            structure but tuned for a per-county artifact. */}
        <header className="rounded-[4px] border border-hairline bg-paper p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5">
            Civica · Compliance brief · {county.displayName}
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink leading-tight">
            SNAP enrollment exposure for {county.displayName}
          </h1>
          <p className="text-[14px] text-graphite mt-2 max-w-3xl leading-relaxed">
            §10105 federal admin-match liability under OBBBA. Cumulative
            FY2026–FY2028 measurement window. Caseload share derived from
            CDSS CF 296 application volume (Jul 2025 – Feb 2026, 8-month
            rolling).
          </p>
          <p className="text-[11px] text-muted font-mono tracking-wide mt-3">
            {county.displayName} · rank {overallRank} of {totalCounties}{" "}
            by estimated exposure
          </p>
        </header>

        {/* KPI row — three cards. Match /cdss KpiCard visual weight. */}
        <section
          aria-label={`${county.displayName} key exposure metrics`}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <KpiCard
            label="Caseload share"
            value={county.caseloadSharePctLabel}
            subtext={`Share of statewide CalFresh applications (CF 296, 8-month rolling)`}
            variant="neutral"
          />
          <KpiCard
            label="Est. §10105 exposure"
            value={county.estimatedExposureLabel}
            subtext={`Cumulative FY2026–FY2028 federal admin-match exposure attributable to ${county.displayName}`}
            variant="warning"
          />
          <KpiCard
            label="§10102 age-band gap"
            value={`~${county.ageGapLabel.replace(/^~/, "")}`}
            subtext="Adults newly in scope for ABAWD work rules (ages 55–64). Per design-doc midpoint."
            variant="neutral"
          />
        </section>

        {/* Notable context — only render if the county has a hand-curated
            note in countyExposure.ts. Long-tail counties have no context. */}
        {county.notableContext && (
          <section
            className="rounded-[4px] border border-hairline bg-surface p-5 md:p-6"
            style={{ borderLeft: "3px solid var(--color-warning)" }}
          >
            <p className="eyebrow mb-2">Notable context</p>
            <p className="text-[14px] text-graphite leading-relaxed max-w-3xl">
              {county.notableContext}
            </p>
          </section>
        )}

        {/* Statewide PER trend ribbon — anchors the county's number to the
            CA / national curve. Same component as /cdss. */}
        <section
          aria-label="Statewide PER trend"
          className="space-y-2"
        >
          <p className="text-[13px] text-graphite leading-snug px-1">
            {county.displayName}&apos;s §10105 exposure scales with the
            statewide Payment Error Rate. Here&apos;s where CA sits relative
            to the federal threshold.
          </p>
          <StatePerTrendRibbon />
        </section>

        {/* Statewide leaderboard — embed the same component /cdss uses,
            capped at the top 20. If this county isn't in the top 20,
            we append its row separately below. */}
        <section
          aria-label="Top 20 California counties by §10105 exposure"
          className="space-y-3"
        >
          <p className="text-[13px] text-graphite leading-snug px-1">
            Here&apos;s how {county.displayName} ranks against the largest
            CA counties.
          </p>
          <CountyLeaderboard
            limit={20}
            title="Top 20 counties statewide"
            subtitle="Estimated cumulative §10105 federal admin-match exposure FY2026–FY2028, ranked. Real per-county PER is FOIA-only; swap when it lands."
          />
          {!inTop20 && (
            <div className="border border-hairline rounded-[4px] bg-surface p-4 md:p-5">
              <p className="eyebrow mb-2">{county.displayName} (this brief)</p>
              <div className="overflow-x-auto -mx-1">
                <table
                  className="w-full text-sm border-collapse"
                  aria-label={`${county.displayName}'s row in the statewide ranking`}
                >
                  <tbody>
                    <tr>
                      <td className="py-2.5 pr-3 pl-1 text-graphite tabular-nums w-12">
                        <span className="font-semibold text-ink">
                          {overallRank}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-ink">
                          {county.displayName}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-graphite tabular-nums">
                        {county.caseloadSharePctLabel}
                      </td>
                      <td
                        className="py-2.5 pr-4 text-right tabular-nums font-semibold"
                        style={{ color: "var(--color-ink)" }}
                      >
                        {county.estimatedExposureLabel}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                {county.displayName} ranks {overallRank} of {totalCounties}{" "}
                statewide — outside the top 20 above, included here so the
                brief reads cleanly.
              </p>
            </div>
          )}
        </section>

        {/* Methodology — adapted from the CountyLeaderboard footnote, but
            scoped to the per-county artifact. */}
        <section
          aria-label="Methodology and sources"
          className="border border-hairline rounded-[4px] bg-surface p-5 md:p-6"
        >
          <p className="eyebrow mb-3">Methodology &amp; sources</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-[12px] text-graphite leading-relaxed max-w-4xl">
            <div>
              <p className="font-semibold text-ink mb-0.5">Caseload share</p>
              <p>
                County share of CalFresh applications, rolling 8-month average
                from CDSS CF 296 (&quot;CalFresh Monthly Caseload&quot;), Jul
                2025 – Feb 2026. Application volume is a proxy for active
                caseload share; CF 358 (active caseload) replaces it when that
                ingest lands.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-0.5">Estimated exposure</p>
              <p>
                Caseload share × $510M (CA&apos;s cumulative §10105 FY2026–
                FY2028 federal admin-match exposure). Assumes county PER
                tracks state PER proportionally. Real per-county PER is FOIA-
                only — replace when CDSS / FNS publishes the breakdown.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-0.5">§10102 age gap</p>
              <p>
                Caseload share × 325,000 (midpoint of the design-doc
                250K–400K statewide newly-in-scope estimate under OBBBA
                §10102 age-band changes).
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-0.5">Sources</p>
              <p>
                CDSS CF 296 (FY 2025-26 export). USDA FNS QC payment-error
                reports. OBBBA §10102 / §10105 statutory text. CA federal
                admin-cost estimate ~$850M/yr.
              </p>
            </div>
          </div>
        </section>

        {/* Procurement CTA — the page's reason for existing. Mailto link;
            real Civica B2G inbox once domain is live. */}
        <section
          aria-label="Request authenticated review"
          className="rounded-[4px] bg-pine overflow-hidden"
        >
          <div className="px-7 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-2">
              For {county.displayName} leadership
            </p>
            <h3 className="text-[20px] font-bold tracking-tight leading-tight text-white mb-3">
              See the authenticated view of your enrollment pipeline
            </h3>
            <p className="text-[14px] text-white/75 leading-relaxed max-w-2xl mb-5">
              This page is generated from public CDSS + FNS data. For an
              authenticated view of {county.displayName}&apos;s enrollment
              pipeline — live navigator queue, applicant outcomes, and the
              per-applicant §10105 attribution — request a 15-minute review.
            </p>
            <a
              href={mailtoHref}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[4px] bg-white/10 hover:bg-white/15 transition-colors text-[13px] font-semibold text-white border border-white/20"
            >
              Request a 15-minute review
              <span aria-hidden="true">→</span>
            </a>
            <p className="text-[10px] text-white/30 font-mono mt-4">
              Contact address is a placeholder — swap with the real Civica
              inbox once the domain is live.
            </p>
          </div>
        </section>

        <footer className="border-t border-hairline pt-5 pb-2 flex justify-between items-center text-[11px] text-muted font-mono tracking-wide">
          <span>
            Civica · compliance brief · {county.displayName} · public
          </span>
          <Link
            href="/compliance"
            className="hover:text-pine transition-colors"
            prefetch={false}
          >
            Full /compliance scoreboard →
          </Link>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card — matches the /cdss KpiCard footprint so the brief reads as a
// natural per-county slice of the same dashboard.
// ---------------------------------------------------------------------------
function KpiCard({
  label,
  value,
  subtext,
  variant,
}: {
  label: string;
  value: string;
  subtext: string;
  variant: "neutral" | "warning";
}) {
  const accentColor =
    variant === "warning" ? "var(--color-warning)" : "var(--color-ink)";
  const borderStyle =
    variant === "warning"
      ? { borderColor: "color-mix(in srgb, var(--color-warning) 30%, transparent)" }
      : {};

  return (
    <div
      className="bg-surface rounded-[4px] border border-hairline p-5"
      style={borderStyle}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className="text-3xl font-semibold tabular-nums mt-2 leading-none"
        style={{ color: accentColor }}
      >
        {value}
      </p>
      <p className="text-[12px] text-graphite mt-1.5 leading-relaxed">
        {subtext}
      </p>
    </div>
  );
}
