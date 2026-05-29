/**
 * Per-section async server components for /ops.
 *
 * Each section owns its own fetcher call so /ops can stream each panel
 * independently via Suspense. The page shell + header paint immediately;
 * panels resolve in whatever order their fetchers complete. Matches the
 * canonical /qc per-section Suspense pattern.
 *
 * Per /plan-ceo-review D9 + /plan-eng-review D1/D2: the deliverable here
 * is perceived progress (shell paints first, panels stream) rather than
 * raw LCP improvement. Sections are intentionally per-fetcher, not
 * per-derivation — /ops fetchers were already independent before this
 * refactor, so this is true streaming, not theater.
 *
 * Per /plan-eng-review D2 + T4-a: fetchPartnerPnL fetches its own EBT
 * aggregate internally, so PartnerPnLSection has no dependency on
 * EbtBalanceSection. The duplicate-query cost (~5ms) buys full
 * per-panel decoupling.
 */
import { Skeleton } from "../Skeleton";
import OpsHeroStrip from "./OpsHeroStrip";
import EBTBalancePanel from "./EBTBalancePanel";
import PlacementMapPanel from "./PlacementMapPanel";
import NotificationOutlayPanel from "./NotificationOutlayPanel";
import CohortRetentionPanel from "./CohortRetentionPanel";
import TTFDPanel from "./TTFDPanel";
import PartnerPnLPanel from "./PartnerPnLPanel";
import MedicareAdvantagePanel from "./MedicareAdvantagePanel";
import EligibilityQueuePanel from "./EligibilityQueuePanel";
import RevenueLinesPanel from "./RevenueLinesPanel";
import LTVPanel from "./LTVPanel";
import DistressOverlayPanel from "./DistressOverlayPanel";
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

/**
 * Generic panel-sized skeleton. Rounded card + a few skeleton lines, sized
 * to roughly match the typical panel silhouette so the layout doesn't jump
 * when content streams in.
 */
export function OpsPanelSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div
      className="bg-surface border border-hairline rounded-[4px] p-6 space-y-4"
      style={{ minHeight: height }}
    >
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-3 w-96" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

/**
 * Hero strip skeleton — wider + shorter than a panel; matches the warm-gray
 * surface so the visual register stays consistent during the stream.
 */
export function OpsHeroStripSkeleton() {
  return (
    <section
      className="rounded-[6px] overflow-hidden mb-4 border border-hairline"
      style={{ backgroundColor: "#E7E5E2", minHeight: 140 }}
    >
      <div className="px-6 pt-5 pb-3 space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-5 gap-6 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Sections ───────────────────────────────────────────────────────────────

/**
 * Hero strip needs 4 fetchers in parallel; renders as one unit so partial
 * headlines never paint. PnL fetches its own EBT internally (T4-a), so the
 * parallel batch here is genuinely independent.
 */
export async function OpsHeroStripSection() {
  const [ebt, pnl, notifications, ttfd] = await Promise.all([
    fetchEbtAggregate(),
    fetchPartnerPnL(),
    fetchNotificationOutlay(),
    fetchTTFD(),
  ]);
  return <OpsHeroStrip ebt={ebt} pnl={pnl} notifications={notifications} ttfd={ttfd} />;
}

export async function EligibilityQueueSection() {
  const data = await fetchEligibilityQueue();
  return <EligibilityQueuePanel data={data} />;
}

export async function EBTBalanceSection() {
  const data = await fetchEbtAggregate();
  return <EBTBalancePanel data={data} />;
}

export async function PlacementMapSection() {
  const data = await fetchPlacements();
  return <PlacementMapPanel data={data} />;
}

export async function NotificationOutlaySection() {
  const data = await fetchNotificationOutlay();
  return <NotificationOutlayPanel data={data} />;
}

export async function CohortRetentionSection() {
  const data = await fetchCohorts();
  return <CohortRetentionPanel data={data} />;
}

export async function TTFDSection() {
  const data = await fetchTTFD();
  return <TTFDPanel data={data} />;
}

export async function RevenueLinesSection() {
  const data = await fetchRevenueLines();
  return <RevenueLinesPanel data={data} />;
}

export async function PartnerPnLSection() {
  const data = await fetchPartnerPnL();
  return <PartnerPnLPanel data={data} />;
}

export async function MedicareAdvantageSection() {
  const data = await fetchMedicareAdvantage();
  return <MedicareAdvantagePanel data={data} />;
}

export async function LTVSection() {
  const data = await fetchLTV();
  return <LTVPanel data={data} />;
}

export async function DistressOverlaySection() {
  const data = await fetchDistressOverlay();
  return <DistressOverlayPanel data={data} />;
}
