// /ops — operator console.
//
// Per-section Suspense streaming (T4 from /plan-design-review + locked in
// /plan-eng-review D1/D2 + /plan-ceo-review D9). The page-level fetch is
// now narrow: just the auth check for the header. Each panel owns its own
// fetcher inside a <Suspense> boundary, matching the /qc template.
//
// Streaming flow:
//   1. Shell + header + PeriodPicker paint immediately (no async data).
//   2. OpsHeroStripSection streams in (Promise.all of 4 fetchers).
//   3. Each panel section streams in independently as its fetcher resolves.
//
// Per /plan-eng-review D2 + T4-a: fetchPartnerPnL no longer depends on a
// caller-provided activeTrackers; it fetches its own EBT aggregate
// internally. Full decoupling means PartnerPnLSection can run in parallel
// with EBTBalanceSection rather than serially after it.

import { Suspense } from "react";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import {
  OpsHeroStripSection,
  OpsHeroStripSkeleton,
  EligibilityQueueSection,
  EBTBalanceSection,
  PlacementMapSection,
  NotificationOutlaySection,
  CohortRetentionSection,
  TTFDSection,
  RevenueLinesSection,
  PartnerPnLSection,
  MedicareAdvantageSection,
  LTVSection,
  DistressOverlaySection,
  OpsPanelSkeleton,
} from "../../components/ops/sections";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  // The page-level fetch is now narrow: just the auth check for the header.
  // All data-bound sections own their own fetches inside Suspense boundaries.
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="ops" />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-3">
        {/* Page header (static — paints in the first chunk) */}
        <div className="flex items-end justify-between gap-6 pb-3">
          <div>
            <p className="eyebrow mb-1">Civica operator console</p>
            <h1 className="text-[26px] font-bold tracking-tight leading-none text-ink">
              Performance
            </h1>
            <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
              SNAP dollars under app, where partner offers are placed, what we&apos;ve spent on
              outbound, who&apos;s still tracking, and how fast new enrollments hit their first
              deposit — refreshed every 30 seconds.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PeriodPicker />
          </div>
        </div>

        {/* Hero strip — animated headline KPIs across the top. Streams as a
            unit so partial headlines never paint. */}
        <Suspense fallback={<OpsHeroStripSkeleton />}>
          <OpsHeroStripSection />
        </Suspense>

        {/* Opportunity queue — workflow-defining "what's next" view, sits
            right under the hero so operators see actionable work first
            (before any reporting panels). */}
        <Suspense fallback={<OpsPanelSkeleton height={220} />}>
          <EligibilityQueueSection />
        </Suspense>

        {/* Operational metrics — the "is the engine running" middle of the
            page. Balance + map + outbound + retention + speed-to-deposit. */}
        <Suspense fallback={<OpsPanelSkeleton />}>
          <EBTBalanceSection />
        </Suspense>
        <Suspense fallback={<OpsPanelSkeleton height={300} />}>
          <PlacementMapSection />
        </Suspense>
        <Suspense fallback={<OpsPanelSkeleton />}>
          <NotificationOutlaySection />
        </Suspense>
        <Suspense fallback={<OpsPanelSkeleton />}>
          <CohortRetentionSection />
        </Suspense>
        <Suspense fallback={<OpsPanelSkeleton />}>
          <TTFDSection />
        </Suspense>

        {/* Monetization arc — the "money story" cluster at the bottom.
            Rollup ("where the money comes from") opens, per-line panels
            in the middle, LTV closes with the per-user kicker, then the
            distress overlay caps the page with the trust-defense beat. */}
        <Suspense fallback={<OpsPanelSkeleton height={240} />}>
          <RevenueLinesSection />
        </Suspense>
        <Suspense fallback={<OpsPanelSkeleton />}>
          <PartnerPnLSection />
        </Suspense>
        <Suspense fallback={<OpsPanelSkeleton />}>
          <MedicareAdvantageSection />
        </Suspense>
        <Suspense fallback={<OpsPanelSkeleton />}>
          <LTVSection />
        </Suspense>
        <Suspense fallback={<OpsPanelSkeleton />}>
          <DistressOverlaySection />
        </Suspense>
      </div>

      <footer className="border-t border-hairline px-8 py-5 flex justify-between items-center text-[11px] text-graphite font-mono tracking-wide mt-8">
        <span>Civica · ops dashboard · internal · operator-gated</span>
        <span>see ceo-plans/2026-05-25-ebt-monetization-dashboard.md</span>
      </footer>
    </div>
  );
}

function PeriodPicker() {
  const options = ["30d", "90d", "FY26"];
  return (
    <div className="inline-flex p-0.5 bg-paper border border-hairline rounded-[4px]">
      {options.map((p) => (
        <button
          key={p}
          className={`px-3 py-1.5 rounded-[3px] text-[12px] font-semibold transition-colors ${
            p === "30d" ? "bg-surface border border-hairline text-ink shadow-sm" : "text-graphite hover:text-ink"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
