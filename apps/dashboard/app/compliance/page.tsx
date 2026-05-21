// TODO(tests): next PR adds vitest coverage for the three sub-panels and the
// obbba.ts static data shape. This page intentionally ships test-free per
// scaffolding scope.
//
// ─────────────────────────────────────────────────────────────────────────
// /compliance design token scale — keep panels visually consistent.
// Established by cross-pillar design audit, 2026-05-20.
//
// PADDING SCALE
//   p-7  → pillar shell (the 5 main panels + DataSources)
//   p-5  → primary inner card (hero scoreboard, monetization framework)
//   p-4  → secondary inner card (per-row cards, posture chips)
//   p-3  → tertiary inner element (matrix cells, mini cards)
//
// HERO NUMERAL TIERS — two sizes only
//   44px → flagship single number per pillar (P2 OBBBA hero, P5 scoreboard)
//   32px → secondary stat (P1 totals, P3 funnel layer 1, cohort gaps)
//   26px → dark hero card composition exception (page-level hero only)
//
// BORDER-RADIUS
//   rounded-[4px]  → all card surfaces (pillar shells + inner cards)
//   rounded-full   → pills, status chips, numbered circles
//   rounded-sm     → tiny inline decorations only
//
// HAIRLINES
//   border-hairline      → structural borders (panel shells, sub-section dividers)
//   border-hairline/50   → nested-card borders, secondary dividers
//   hairline/30          → faint background dividers only
//
// WARM TOKENS — three roles, not three drift colors
//   #E8C547 wheat  → dark-bg context only (hero card stats)
//   #C9922A amber  → chip backgrounds + accent borders on paper
//   #9A5A14 brown  → text + numbers on paper (darker for readability)
//
// COHORT vs STATUS TOKENS — never reuse warning colors for identifiers
//   #2A6F66 teal   → STU cohort tag + Pillar 5 wins (Civica positive)
//   #5C1F11 brick  → OBBBA hero exposure + 60+ cohort tag
//
// NUMBERED CIRCLES (Pillars 1, 4, 5 — Pillar 2 intentionally uses §-labels)
//   w-7 h-7 rounded-full bg-paper border border-hairline
//   font-mono text-[10px] font-semibold text-graphite tabular-nums
//   "01" / "02" / "03" zero-padded
// ─────────────────────────────────────────────────────────────────────────
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
        <div className="rounded-[4px] bg-pine overflow-hidden mb-3">
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
                <p className="text-[26px] font-bold tabular-nums leading-none text-white/85">
                  {frameworkSummary.gates}
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-0.5 text-white/40">
                  eligibility gates
                </p>
              </div>
              <div>
                <p className="text-[26px] font-bold tabular-nums leading-none text-white/85">
                  {frameworkSummary.calcSteps}
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-0.5 text-white/40">
                  calc steps
                </p>
              </div>
              <div>
                <p className="text-[26px] font-bold tabular-nums leading-none text-white/85">
                  {provisions.length}
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-0.5 text-white/40">
                  OBBBA provisions
                </p>
              </div>
              <div>
                <p className="text-[26px] font-bold tabular-nums leading-none text-white/85">
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

        {/* Bridge P1→P2: the rules → what the law charges when they fail */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-hairline" />
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted whitespace-nowrap">
            above: the rules · below: what the law charges when they fail
          </p>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        <section id="pillar-2">
        <ObbbaReadinessPanel provisions={provisions} />
        </section>

        {/* Bridge P2→P3: dollar exposure → where the loss actually lives.
            Elevated treatment vs the other 3 bridges — this is the page's
            biggest narrative pivot, regulatory exposure → operational diagnostic. */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-0.5 bg-pine/25" />
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-pine" />
            <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-pine whitespace-nowrap">
              above: the dollars at stake · below: where the dollars come from
            </p>
            <span className="w-1.5 h-1.5 rounded-full bg-pine" />
          </div>
          <div className="flex-1 h-0.5 bg-pine/25" />
        </div>

        <section id="pillar-3">
        <CoverageMapPanel />
        </section>

        {/* Bridge P3→P4: identifies risk → shows how it's addressed */}
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
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
