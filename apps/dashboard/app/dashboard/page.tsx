// /dashboard — navigator's morning console.
//
// Per-section Suspense streaming. Each section in
// components/dashboard/sections.tsx owns its own request-cached fetcher;
// the page shell + header paint immediately, sections stream in as their
// data resolves. React.cache() dedupes shared fetches (packets, history,
// docs) so per-section independence costs zero duplicate queries.
//
// Greenlit in PR4 D2 (real per-section streaming, the /qc template) over
// the earlier "shared fetch + Suspense for derivations" approach the
// outside-voice eng review correctly flagged as theater — wrapping
// synchronous derivations in Suspense while the page-level Promise.all
// still blocks every paint.
//
// Visual reorder (CEO D9): UrgentBanner > Funnel > ImpactCounter >
// Map + Activity (2-up) > TimeToHandoff + Language (2-up) > QC > DocAI.
// Morning-routine wins land before the brand celebration.
//
// Mobile responsive (Pass 6 finding 6E): md: prefix on the grids so the
// page stacks cleanly on 375px viewports.

import { Suspense } from "react";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import FirstVisitCallout from "../../components/FirstVisitCallout";
import {
  UrgentBannerSection,
  UrgentBannerSkeleton,
  FunnelSection,
  FunnelSectionSkeleton,
  ImpactCounterSection,
  ImpactCounterSkeleton,
  MapSection,
  ActivityTickerSection,
  TimeToHandoffSection,
  LanguageEquitySection,
  QCOutcomesSection,
  DocumentAISection,
  CardSectionSkeleton,
} from "../../components/dashboard/sections";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Only the auth check happens at the page level. Everything else streams.
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="dashboard" />
      <main className="max-w-6xl mx-auto px-8 py-8 space-y-5">
        {/* Compact header — H1 (page landmark) + subtitle inline */}
        <div className="flex items-baseline justify-between gap-6 flex-wrap pb-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-[26px] font-bold tracking-tight leading-none text-ink">
              SNAP Enrollment Overview
            </h1>
            <span className="eyebrow">California</span>
          </div>
          <p className="text-[13px] text-graphite">Live picture of every family Civica is helping enroll.</p>
        </div>

        {/* First-visit callout — explains the morning-briefing pattern */}
        <FirstVisitCallout />

        {/* UrgentBanner — morning triage surface; promoted to the lede
            (CEO D9). Section returns null when nothing urgent + no personal
            activity, preserving the original hide-when-empty behavior. */}
        <Suspense fallback={<UrgentBannerSkeleton />}>
          <UrgentBannerSection />
        </Suspense>

        {/* Funnel — primary operational view, above ImpactCounter (D9). */}
        <Suspense fallback={<FunnelSectionSkeleton />}>
          <FunnelSection />
        </Suspense>

        {/* ImpactCounter — brand strip, demo-friendly. Below the work
            surfaces per CEO D9 (work-first, celebration-after). */}
        <Suspense fallback={<ImpactCounterSkeleton />}>
          <ImpactCounterSection />
        </Suspense>

        {/* Map + Activity (2-up). md: prefix so the layout stacks on mobile
            (Pass 6 finding 6E). items-start so each card sizes independently. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          <div className="md:col-span-2">
            <Suspense fallback={<CardSectionSkeleton minHeight={360} />}>
              <MapSection />
            </Suspense>
          </div>
          <Suspense fallback={<CardSectionSkeleton minHeight={360} />}>
            <ActivityTickerSection />
          </Suspense>
        </div>

        {/* Time-to-Handoff + Language donut — md: prefix so they stack on
            mobile (Pass 6 finding 6E). */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Suspense fallback={<CardSectionSkeleton />}>
            <TimeToHandoffSection />
          </Suspense>
          <Suspense fallback={<CardSectionSkeleton />}>
            <LanguageEquitySection />
          </Suspense>
        </div>

        {/* QC Outcomes */}
        <Suspense fallback={<CardSectionSkeleton minHeight={220} />}>
          <QCOutcomesSection />
        </Suspense>

        {/* Doc AI panel */}
        <Suspense fallback={<CardSectionSkeleton minHeight={220} />}>
          <DocumentAISection />
        </Suspense>
      </main>
    </div>
  );
}
