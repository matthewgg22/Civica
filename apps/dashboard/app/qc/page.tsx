// /qc Error Rate Intelligence — page-level shell.
//
// TODO-QC-SUSPENSE (eng review 2026-05-25): per-section Suspense boundaries.
// Each section is an independent async server component; the page shell
// (header, period picker, OBBBA strip — static obbbaProvisions) paints
// immediately while data-bound sections stream in.
//
// Streaming flow:
//   1. Shell + OBBBAReadinessStrip render synchronously (no async data).
//   2. ThesisAggregatesSection streams in (FormulaHero + PillarTracking).
//   3. IncomingDataFeedSection streams in.
//   4. CalibrationSection streams in.
//
// Each Suspense boundary has a skeleton fallback co-located with its
// section component, so SSR ships an immediate static shell + per-section
// skeletons, then progressive enhancement as data lands.

import { Suspense } from "react";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import OBBBAReadinessStrip from "../../components/qc/OBBBAReadinessStrip";
import ThesisAggregatesSection, {
  ThesisAggregatesSkeleton,
} from "../../components/qc/sections/ThesisAggregatesSection";
import IncomingDataFeedSection, {
  IncomingDataFeedSkeleton,
} from "../../components/qc/sections/IncomingDataFeedSection";
import CalibrationSection, {
  CalibrationSkeleton,
} from "../../components/qc/sections/CalibrationSection";
import SliceErrorRatesSection, {
  SliceErrorRatesSkeleton,
} from "../../components/qc/sections/SliceErrorRatesSection";
import { ENGINE_VERSION } from "@civica/snap-qc-engine";

export const dynamic = "force-dynamic";

export default async function QCPage() {
  // The page-level fetch is now narrow: just the auth check for the header.
  // All data-bound sections own their own fetches inside Suspense boundaries.
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="qc" />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-3">
        {/* Page header (static — paints in the first chunk) */}
        <div className="flex items-end justify-between gap-6 pb-3">
          <div>
            <p className="eyebrow mb-1">QC · Compliance intelligence</p>
            <h2 className="text-[26px] font-bold tracking-tight leading-none text-ink">
              Error Rate Intelligence
            </h2>
            <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
              How well Civica&apos;s evaluation signals cover the USDA
              payment-error categories, and how navigator-logged QC outcomes
              compare to California&apos;s statewide baseline.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PeriodPicker />
            <button className="border border-hairline px-3 py-2 rounded-[3px] text-[13px] font-medium text-ink hover:bg-paper/80 transition-colors">
              Export FNS-380 →
            </button>
          </div>
        </div>

        {/* Streaming section: formula hero + pillar tracking (share data) */}
        <Suspense fallback={<ThesisAggregatesSkeleton />}>
          <ThesisAggregatesSection />
        </Suspense>

        {/* Static section: OBBBA strip reads from obbbaProvisions() — no async */}
        <OBBBAReadinessStrip />

        {/* Streaming section: per-applicant feed */}
        <Suspense fallback={<IncomingDataFeedSkeleton />}>
          <IncomingDataFeedSection />
        </Suspense>

        {/* Streaming section: calibration dumbbell */}
        <Suspense fallback={<CalibrationSkeleton />}>
          <CalibrationSection />
        </Suspense>

        {/* Streaming section: per-slice error rates + Wilson bands (A1) */}
        <Suspense fallback={<SliceErrorRatesSkeleton />}>
          <SliceErrorRatesSection />
        </Suspense>
      </div>

      <footer className="border-t border-hairline px-8 py-5 flex justify-between items-center text-[11px] text-graphite font-mono tracking-wide mt-8">
        <span>
          Civica · error-rate intelligence · qc-engine v{ENGINE_VERSION} · live
        </span>
        <span>
          QC baseline: USDA FNS-380 FY2024 · weights are payment-error contribution
        </span>
      </footer>
    </div>
  );
}

function PeriodPicker() {
  const options = ["30d", "90d", "FY24"];
  return (
    <div className="inline-flex p-0.5 bg-paper border border-hairline rounded-[4px]">
      {options.map((p) => (
        <button
          key={p}
          className={`px-3 py-1.5 rounded-[3px] text-[12px] font-semibold transition-colors ${
            p === "90d"
              ? "bg-surface border border-hairline text-ink shadow-sm"
              : "text-graphite hover:text-ink"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
