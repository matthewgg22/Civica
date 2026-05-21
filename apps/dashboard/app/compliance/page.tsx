// TODO(tests): next PR adds vitest coverage for the three sub-panels and the
// obbba.ts static data shape. This page intentionally ships test-free per
// scaffolding scope.
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import RulesFrameworkPanel from "../../components/compliance/RulesFrameworkPanel";
import CoverageMapPanel from "../../components/compliance/CoverageMapPanel";
import ObbbaReadinessPanel from "../../components/compliance/ObbbaReadinessPanel";
import VerificationStackPanel from "../../components/compliance/VerificationStackPanel";
import OutcomesPanel from "../../components/compliance/OutcomesPanel";
import DataSourcesPanel from "../../components/compliance/DataSourcesPanel";
import PillarNav from "../../components/compliance/PillarNav";
import { obbbaProvisions, publicDataSources } from "../../lib/analytics/obbba";
import {
  eligibilityGates,
  federalCalculationSteps,
  californiaOverlays,
  underEnrolledPopulations,
  frameworkCoverageSummary,
} from "../../lib/analytics/snap-framework";
import {
  verificationTools,
  verificationStackSummary,
} from "../../lib/analytics/verification-stack";
import {
  civicaOutcomes,
  foiaPendingOutcomes,
  effectIsolation,
  outcomesSummary,
} from "../../lib/analytics/civica-outcomes";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  // Auth is enforced by middleware (staff-only). No additional role gate —
  // mirrors /qc, which is operator-facing.

  const provisions = obbbaProvisions();
  const sources = publicDataSources();
  const gates = eligibilityGates();
  const calcSteps = federalCalculationSteps();
  const caOverlays = californiaOverlays();
  const underEnrolled = underEnrolledPopulations();
  const frameworkSummary = frameworkCoverageSummary();
  const tools = verificationTools();
  const stackSummary = verificationStackSummary();
  const outcomes = civicaOutcomes();
  const foiaOutcomes = foiaPendingOutcomes();
  const effectIsolationRows = effectIsolation();
  const outcomesHeadline = outcomesSummary();

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="compliance" />
      <PillarNav />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-3">

        {/* ── Dark pine hero card — one per page, wheat-gold key metrics ── */}
        <div className="rounded-[4px] bg-pine overflow-hidden mb-1">
          <div className="px-7 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-2.5">
              Compliance · nationwide framework
            </p>
            <h1 className="text-[26px] font-bold tracking-tight leading-tight text-white mb-3 max-w-2xl">
              QC framework &amp; OBBBA readiness
            </h1>
            <p className="text-[13px] text-white/65 max-w-2xl leading-relaxed mb-6">
              Five pillars: the rules behind every Civica estimate (P1), what the
              OBBBA provisions cost if we get it wrong (P2), where the $13B in errors
              comes from (P3), the verification tools that address it (P4), and the
              outcomes Civica&apos;s enrolled cohort actually produces (P5). For
              today&apos;s packet cohort, see{" "}
              <code className="font-mono text-[11px] bg-white/10 rounded px-1 py-0.5 text-white/75">/qc</code>.
            </p>
            {/* Wheat-gold key metrics */}
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-[26px] font-bold tabular-nums leading-none text-wheat">
                  {frameworkSummary.gates}
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-0.5 text-white/40">
                  eligibility gates
                </p>
              </div>
              <div>
                <p className="text-[26px] font-bold tabular-nums leading-none text-wheat">
                  {frameworkSummary.calcSteps}
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-0.5 text-white/40">
                  calc steps
                </p>
              </div>
              <div>
                <p className="text-[26px] font-bold tabular-nums leading-none text-wheat">
                  {provisions.length}
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-0.5 text-white/40">
                  OBBBA provisions
                </p>
              </div>
              <div>
                <p className="text-[26px] font-bold tabular-nums leading-none text-wheat">
                  {stackSummary.liveTools}
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-0.5 text-white/40">
                  verification tools live
                </p>
              </div>
              <div className="ml-auto self-end">
                <p className="text-[11px] font-mono text-white/25">
                  {frameworkSummary.fiscalYear}
                </p>
              </div>
            </div>
          </div>
        </div>

        <section id="pillar-1">
        <RulesFrameworkPanel
          gates={gates}
          calcSteps={calcSteps}
          caOverlays={caOverlays}
          underEnrolled={underEnrolled}
          summary={frameworkSummary}
        />
        </section>
        <section id="pillar-2">
        <ObbbaReadinessPanel provisions={provisions} />
        </section>
        <section id="pillar-3">
        <CoverageMapPanel />
        </section>

        {/* Bridge P3→P4: identifies risk → shows how it's addressed */}
        <div className="flex items-center gap-3 py-0.5">
          <div className="flex-1 h-px bg-hairline" />
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted whitespace-nowrap">
            above: where risk lives · below: how it&apos;s addressed
          </p>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        <section id="pillar-4">
        <VerificationStackPanel tools={tools} summary={stackSummary} />
        </section>

        {/* Bridge P4→P5: addresses risk → shows results */}
        <div className="flex items-center gap-3 py-0.5">
          <div className="flex-1 h-px bg-hairline" />
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted whitespace-nowrap">
            above: how it&apos;s addressed · below: what it produces
          </p>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        <section id="pillar-5">
        <OutcomesPanel
          rows={outcomes}
          summary={outcomesHeadline}
          foiaOutcomes={foiaOutcomes}
          effectIsolationRows={effectIsolationRows}
        />
        </section>
        <DataSourcesPanel sources={sources} />
      </div>

      <footer className="border-t border-hairline px-8 py-5 flex justify-between items-center text-[11px] text-muted font-mono tracking-wide mt-8">
        <span>Civica · compliance framework · operator view</span>
        <span>OBBBA windows: §10102 Jun 2026 · §10105 FY2026→FY2028 · §10106 Oct 2026</span>
      </footer>
    </div>
  );
}
