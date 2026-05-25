import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import OpsHeroStrip from "../../components/ops/OpsHeroStrip";
import EBTBalancePanel from "../../components/ops/EBTBalancePanel";
import PlacementMapPanel from "../../components/ops/PlacementMapPanel";
import NotificationOutlayPanel from "../../components/ops/NotificationOutlayPanel";
import CohortRetentionPanel from "../../components/ops/CohortRetentionPanel";
import TTFDPanel from "../../components/ops/TTFDPanel";
import PartnerPnLPanel from "../../components/ops/PartnerPnLPanel";
import MedicareAdvantagePanel from "../../components/ops/MedicareAdvantagePanel";
import EligibilityQueuePanel from "../../components/ops/EligibilityQueuePanel";
import RevenueLinesPanel from "../../components/ops/RevenueLinesPanel";
import LTVPanel from "../../components/ops/LTVPanel";
import DistressOverlayPanel from "../../components/ops/DistressOverlayPanel";
import {
  fetchEbtAggregate,
  fetchPlacements,
  fetchNotificationOutlay,
  fetchCohorts,
  fetchTTFD,
  fetchPartnerPnL,
  fetchMedicareAdvantage,
  fetchEligibilityQueue,
  fetchRevenueLines,
  fetchLTV,
  fetchDistressOverlay,
} from "../../lib/ops-fetchers";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all panel data in parallel. Each fetcher catches missing-relation
  // errors and returns `{ available: false, ... }` so the page renders
  // cleanly when migrations haven't been applied locally.
  const [ebt, placements, notifications, cohorts, ttfd, medicareAdvantage, eligibilityQueue, revenueLines, ltv, distressOverlay] = await Promise.all([
    fetchEbtAggregate(),
    fetchPlacements(),
    fetchNotificationOutlay(),
    fetchCohorts(),
    fetchTTFD(),
    fetchMedicareAdvantage(),
    fetchEligibilityQueue(),
    fetchRevenueLines(),
    fetchLTV(),
    fetchDistressOverlay(),
  ]);

  // P&L denominator depends on the active-tracker count from Panel 1.
  const pnl = await fetchPartnerPnL(30, ebt.active_tracker_count);

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="ops" />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-3">
        {/* Page header */}
        <div className="flex items-end justify-between gap-6 pb-3">
          <div>
            <p className="eyebrow mb-1">Pulse · Civica operator console</p>
            <h2 className="text-[26px] font-bold tracking-tight leading-none text-ink">
              Live corporate health
            </h2>
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

        {/* Hero strip — animated headline KPIs across the top */}
        <OpsHeroStrip ebt={ebt} pnl={pnl} notifications={notifications} ttfd={ttfd} />

        {/* LTV headline — the fundability metric. "Every tracked HH is worth
            $X/yr" — composite of every monetization line, with projected
            ceiling shown as roadmap headroom. */}
        <LTVPanel data={ltv} />

        {/* Revenue rollup — "where the money comes from" headline panel,
            anchors the page by surfacing every monetization line at once. */}
        <RevenueLinesPanel data={revenueLines} />

        {/* Opportunity queue — workflow-defining "what's next" view, sits above
            the reporting panels so operators see actionable work first. */}
        <EligibilityQueuePanel data={eligibilityQueue} />

        {/* Headline panels */}
        <EBTBalancePanel data={ebt} />
        <PlacementMapPanel data={placements} />

        {/* Operational metrics */}
        <NotificationOutlayPanel data={notifications} />
        <CohortRetentionPanel data={cohorts} />
        <TTFDPanel data={ttfd} />

        {/* Monetization — visually distinct (pine border) and clearly operator-gated */}
        <PartnerPnLPanel data={pnl} />
        <MedicareAdvantagePanel data={medicareAdvantage} />

        {/* Distress honor flag — political defense layer. For every
            monetization line, surface how many HHs were excluded because
            they're in active distress (denial appeal / OBBBA §10102
            distress prompt / recert lapse). Sits at the bottom and closes
            the page on a trust beat. */}
        <DistressOverlayPanel data={distressOverlay} />
      </div>

      <footer className="border-t border-hairline px-8 py-5 flex justify-between items-center text-[11px] text-muted font-mono tracking-wide mt-8">
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
