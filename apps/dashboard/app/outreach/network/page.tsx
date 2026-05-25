import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";
import AppHeader from "../../../components/AppHeader";
import OutreachTabs from "../../../components/outreach/OutreachTabs";
import EntityKPIStrip from "../../../components/outreach/EntityKPIStrip";
import PendingApprovalQueue from "../../../components/outreach/PendingApprovalQueue";
import EntityAttributionTable from "../../../components/outreach/EntityAttributionTable";
import {
  DEMO_OUTREACH_ENTITIES,
  PENDING_ENTITIES_LIST,
  APPROVED_ENTITIES,
  SUSPENDED_ENTITIES_LIST,
  computeOutreachNetworkKPIs,
} from "../../../lib/demo-outreach-entities";

export const dynamic = "force-dynamic";

/**
 * /outreach/network — entity attribution + approval surface.
 *
 * Answers two governance questions:
 *   1. Who is currently enrolling individuals through Civica? (attribution)
 *   2. Who is allowed to do that? (approval workflow)
 *
 * Above the fold:
 *   - KPI strip: approved/pending/suspended counts + monthly enrollment total
 *   - Pending approval queue (visible only when entities await review)
 *   - Main attribution table sorted by this-month enrollment volume
 *
 * Demo uses DEMO_OUTREACH_ENTITIES fixture (~30 realistic CA entities).
 * Live system reads from a future `outreach_entities` table + joins to
 * `snap_packets.outreach_entity_id` for attribution.
 */
export default async function OutreachNetworkPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  // Live DB will replace these fixtures once the outreach_entities table ships.
  const entities = DEMO_OUTREACH_ENTITIES;
  const kpis = computeOutreachNetworkKPIs(entities);
  const tableEntities = [...APPROVED_ENTITIES, ...SUSPENDED_ENTITIES_LIST];

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="outreach" />

      <div className="max-w-6xl mx-auto px-8 py-8">
        <OutreachTabs active="network" pendingCount={PENDING_ENTITIES_LIST.length} />

        {/* Page header */}
        <div className="flex items-end justify-between gap-6 pb-3 mb-2">
          <div>
            <p className="eyebrow mb-1">Outreach · attribution + governance</p>
            <h2 className="text-[26px] font-bold tracking-tight leading-none text-ink">
              Outreach network
            </h2>
            <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
              Every enrollment recorded through Civica is attributed to an approved entity —
              a CBO, an internal employee, a labor union, a gig-platform partner, or a county
              referrer. New entities must be vetted (references, BCP, W-9, MOU) before they
              can attribute enrollments. Suspended entities cannot submit packets.
            </p>
          </div>
        </div>

        <EntityKPIStrip kpis={kpis} />

        <PendingApprovalQueue entities={PENDING_ENTITIES_LIST} />

        <EntityAttributionTable entities={tableEntities} />
      </div>

      <footer className="border-t border-hairline px-8 py-5 flex justify-between items-center text-[11px] text-muted font-mono tracking-wide mt-8">
        <span>Civica · outreach network · operator console</span>
        <span>attribution recorded via outreach_entities table + snap_packets.outreach_entity_id</span>
      </footer>
    </div>
  );
}
