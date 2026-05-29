// TODO(tests): next PR adds vitest coverage for the three sub-panels and the
// obbba.ts static data shape. This page intentionally ships test-free per
// scaffolding scope.
//
// ─────────────────────────────────────────────────────────────────────────
// /compliance design token scale — keep panels visually consistent.
// Established by cross-pillar design audit, 2026-05-20.
//
// PADDING SCALE
//   p-7  → part shell (the 7 main panels)
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
// NUMBERED CIRCLES (Parts 1, 5, 6 — Part 2 intentionally uses §-labels)
//   w-7 h-7 rounded-full bg-paper border border-hairline
//   font-mono text-[10px] font-semibold text-graphite tabular-nums
//   "01" / "02" / "03" zero-padded
// ─────────────────────────────────────────────────────────────────────────
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import RulesFrameworkPanel from "../../components/compliance/RulesFrameworkPanel";
import CoverageMapPanel from "../../components/compliance/CoverageMapPanel";
import ObbbaReadinessPanel from "../../components/compliance/ObbbaReadinessPanel";
import LandscapePanel from "../../components/compliance/LandscapePanel";
import VerificationStackPanel from "../../components/compliance/VerificationStackPanel";
import OutcomesPanel from "../../components/compliance/OutcomesPanel";
import BusinessModelPanel from "../../components/compliance/BusinessModelPanel";
import PillarNav from "../../components/compliance/PillarNav";
import { obbbaProvisions } from "../../lib/analytics/obbba";
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
  outcomesSummary,
} from "../../lib/analytics/civica-outcomes";

export const dynamic = "force-dynamic";

// Page metadata — overrides the layout-level defaults so /compliance has
// its own title, description, and OG/Twitter cards when shared. Next.js
// auto-detects ./opengraph-image.tsx and wires the generated PNG into
// <meta property="og:image"> and twitter:image (because card="summary_large_image").
export const metadata: Metadata = {
  title: "Civica · SNAP enrollment infrastructure",
  description:
    "35.5M Americans qualify for SNAP. Civica enrolls the 16M who don't. The rules engine, verification stack, and revenue model behind SNAP enrollment at scale.",
  openGraph: {
    title: "Civica · SNAP enrollment infrastructure",
    description: "35.5M Americans qualify for SNAP. Civica enrolls the 16M who don't.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Civica · SNAP enrollment infrastructure",
    description: "35.5M Americans qualify for SNAP. Civica enrolls the 16M who don't.",
  },
};

// Pilot status — flip the stage + detail string as the program progresses.
// Stage controls the pill's border + text color in the hero.
//   RECRUITING → amber  (pre-pilot · channel work in progress)
//   LIVE       → wheat  (cohort enrolled · packets in flight)
//   POST_PILOT → pine   (results published · counties signed)
// Detail is freeform — keep it short enough to fit beside the fiscal-year tag.
const PILOT_STATUS: {
  stage: "RECRUITING" | "LIVE" | "POST_PILOT";
  detail: string;
} = {
  stage: "LIVE",
  detail: "campus cohort-of-10 underway",
};

const PILOT_STATUS_META = {
  RECRUITING: { border: "rgba(232,165,71,0.65)",  text: "#E8A547", label: "RECRUITING" },
  LIVE:       { border: "rgba(232,197,71,0.75)",  text: "#E8C547", label: "LIVE" },
  POST_PILOT: { border: "rgba(80,180,168,0.70)",  text: "#50B4A8", label: "POST-PILOT" },
} as const;

export default async function CompliancePage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  // Auth is enforced by middleware (staff-only). No additional role gate —
  // mirrors /qc, which is operator-facing.

  const provisions = obbbaProvisions();
  const gates = eligibilityGates();
  const calcSteps = federalCalculationSteps();
  const caOverlays = californiaOverlays();
  const underEnrolled = underEnrolledPopulations();
  const frameworkSummary = frameworkCoverageSummary();
  const tools = verificationTools();
  const stackSummary = verificationStackSummary();
  const outcomes = civicaOutcomes();
  const foiaOutcomes = foiaPendingOutcomes();
  const outcomesHeadline = outcomesSummary();

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="compliance" />
      <PillarNav />

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-3">

        {/* ── Dark pine hero card — stakes-first headline + TL;DR strip ──
            The four numbers below are the page's investor / mission read.
            $13B = the problem · 16M = the gap · 3 layers = the model · $1B+/yr = CA pilot value.
            The seven parts below trace HOW Civica closes the gap. */}
        <div className="rounded-[4px] bg-pine overflow-hidden mb-3">
          <div className="px-7 py-7">
            <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Civica · SNAP enrollment infrastructure · CA pilot
              </p>
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-[0.10em] border"
                  style={{
                    borderColor: PILOT_STATUS_META[PILOT_STATUS.stage].border,
                    color: PILOT_STATUS_META[PILOT_STATUS.stage].text,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: PILOT_STATUS_META[PILOT_STATUS.stage].text }}
                  />
                  CA · {PILOT_STATUS_META[PILOT_STATUS.stage].label} · {PILOT_STATUS.detail}
                </span>
                <p className="text-[11px] font-mono text-white/25">
                  {frameworkSummary.fiscalYear}
                </p>
              </div>
            </div>

            <h1 className="text-[30px] font-bold tracking-tight leading-[1.15] text-white mb-3 max-w-3xl">
              35.5M Americans qualify for SNAP.{" "}
              <span className="text-white/65">Civica enrolls the 16M who don&apos;t.</span>
            </h1>

            <p className="text-[13px] text-white/60 max-w-2xl leading-relaxed mb-7">
              <span className="text-white/90 font-medium">Mission:</span>{" "}
              <span className="text-white/85">every eligible household enrolled in every program they qualify for, every recertification met, every appeal won.</span>{" "}
              SNAP is the entry point; CalAIM ECM, Medicare Savings, LIS, and SSI are the next modules.
              The seven parts below trace how the engine actually closes the gap. For pre-pilot
              telemetry as the first cohort closes, see{" "}
              <code className="font-mono text-[11px] bg-white/10 rounded px-1 py-0.5 text-white/75">/qc</code>.
            </p>

            {/* TL;DR strip — the four numbers a YC reader / collaborator wants in 5 seconds */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-5 pt-5 border-t border-white/10">
              <div className="md:pr-6">
                <p className="text-[32px] font-bold tabular-nums leading-none" style={{ color: "#E8C547" }}>
                  $13B<span className="text-[14px] font-mono text-white/35 ml-1">/yr</span>
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-1.5 text-white/55">
                  SNAP payment errors
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  the problem
                </p>
              </div>
              <div className="md:pl-6 md:pr-6 md:border-l md:border-white/10">
                <p className="text-[32px] font-bold tabular-nums leading-none" style={{ color: "#E8C547" }}>
                  16M
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-1.5 text-white/55">
                  eligible · not enrolled
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  the gap Civica closes
                </p>
              </div>
              <div className="md:pl-6 md:pr-6 md:border-l md:border-white/10">
                <p className="text-[32px] font-bold tabular-nums leading-none" style={{ color: "#E8C547" }}>
                  3<span className="text-[14px] font-mono text-white/35 ml-1">layers</span>
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-1.5 text-white/55">
                  operator · gov · adjacency
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  the revenue model
                </p>
              </div>
              <div className="md:pl-6 md:border-l md:border-white/10">
                <p className="text-[32px] font-bold tabular-nums leading-none" style={{ color: "#E8C547" }}>
                  $1B+<span className="text-[14px] font-mono text-white/35 ml-1">/yr</span>
                </p>
                <p className="text-[10px] uppercase tracking-[0.12em] mt-1.5 text-white/55">
                  CA reachable household value
                </p>
                <p className="text-[10px] text-white/35 mt-0.5 font-mono">
                  544K reachable × $1.9K/yr SNAP value
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Origin — founder + the moment that started this */}
        <div
          className="rounded-[4px] border border-hairline bg-paper p-7 mb-3"
          style={{ borderLeft: "3px solid #5C1F11" }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1.5"
            style={{ color: "#5C1F11" }}
          >
            Origin · why this exists
          </p>
          <h2 className="text-[20px] font-semibold tracking-tight text-ink leading-tight mb-3">
            The hospital attendant who walked away
          </h2>
          <p className="text-[14px] text-graphite leading-relaxed max-w-3xl">
            I built Civica after watching a hospital attendant try BenefitsCal,
            get denied on a self-defeating question, and walk away convinced she
            didn&apos;t qualify for SNAP. She does qualify. She&apos;s not
            enrolled. There are roughly 35.5 million Americans like her — and
            every other tool in this space exits before the part of the
            application that decides whether she ever receives benefits.
          </p>
          <p className="text-[11px] text-muted font-mono tracking-wide mt-3">
            Built by Matthew Greer-Gentis · solo on /codex/rebuild-feb18
          </p>
        </div>

        {/* Market sizing — TAM / SAM / SOM explicit roll-up. Numbers anchor
            to the under-enrolled chart in Pillar 1 and the $1B+/yr CA stat
            in the hero TL;DR strip. */}
        <div className="rounded-[4px] border border-hairline bg-paper p-7 mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5">
            Market sizing · the addressable arc
          </p>
          <h3 className="text-[20px] font-semibold tracking-tight text-ink leading-tight mb-1">
            16M nationally eligible · 2M in California · 544K reachable today
          </h3>
          <p className="text-[13px] text-graphite mt-1 leading-relaxed max-w-3xl mb-5">
            The page implies these numbers but never adds them up. Here they
            are explicitly, so a reader doesn&apos;t have to do the math.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* TAM */}
            <div className="rounded-[4px] bg-surface border border-hairline p-4">
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted">
                  TAM
                </p>
                <p className="text-[9px] uppercase tracking-[0.10em] font-semibold text-muted">
                  national
                </p>
              </div>
              <p className="text-[32px] font-bold tabular-nums leading-none text-ink">
                ~16M
              </p>
              <p className="text-[10px] text-muted mt-0.5">
                households · out of 35.5M total US eligible
              </p>
              <p className="text-[12px] text-graphite mt-3 leading-snug">
                Sum of the four under-enrolled populations in Pillar 1 (students 2.3M
                + gig 3.0M + 60+ 8.1M + home care 2.6M). USDA FNS participation-gap
                data, US-wide. Populations overlap; figure is illustrative.
              </p>
            </div>

            {/* SAM */}
            <div className="rounded-[4px] bg-surface border border-hairline p-4">
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted">
                  SAM
                </p>
                <p className="text-[9px] uppercase tracking-[0.10em] font-semibold text-muted">
                  california
                </p>
              </div>
              <p className="text-[32px] font-bold tabular-nums leading-none text-ink">
                ~2M
              </p>
              <p className="text-[10px] text-muted mt-0.5">
                households · CA eligible-but-unenrolled
              </p>
              <p className="text-[12px] text-graphite mt-3 leading-snug">
                California carries the largest single-state gap. SB 1090 (no asset
                test) + BBCE 200% FPL create the rules conditions where a
                navigator-led path works. Active CA CalFresh caseload: 4.7M
                households · CDSS estimated participation-gap rate ~30%.
              </p>
            </div>

            {/* SOM */}
            <div
              className="rounded-[4px] border p-4"
              style={{
                background: "rgba(42,111,102,0.06)",
                borderColor: "rgba(42,111,102,0.30)",
              }}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <p
                  className="text-[10px] uppercase tracking-[0.12em] font-bold"
                  style={{ color: "#2A6F66" }}
                >
                  SOM
                </p>
                <p
                  className="text-[9px] uppercase tracking-[0.10em] font-semibold"
                  style={{ color: "#2A6F66" }}
                >
                  reachable now
                </p>
              </div>
              <p
                className="text-[32px] font-bold tabular-nums leading-none"
                style={{ color: "#2A6F66" }}
              >
                ~544K
              </p>
              <p className="text-[10px] text-muted mt-0.5">
                CA households · 3 confirmed channels
              </p>
              <p className="text-[12px] text-graphite mt-3 leading-snug">
                Primary wedge (duty-of-care facility operators, RCFE + Section 202 + PACE):
                ~112K households via 3,500 CA-licensed facilities. Labor union channel
                (SEIU 2015 IHSS + UFW): ~240K. Gig-platform onboarding partnerships:
                ~192K. At ~$1.9K/yr avg CalFresh benefit, ~$1B/yr in unlocked
                household value.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted italic mt-4 max-w-3xl leading-relaxed">
            TAM → SAM → SOM is the standard investor frame: total addressable, serviceable available, serviceable obtainable.
            All figures are pre-pilot estimates; numbers tighten as the first cohort closes and channel partnerships sign.
          </p>
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

        {/* Bridge P1→P2 */}
        <div className="flex items-center gap-4 py-3">
          <div className="flex-1 h-px bg-hairline" />
          <p className="text-[13px] text-graphite leading-snug text-center max-w-md">
            Civica learns the rules.{" "}
            <span className="text-ink font-semibold">Now: the law&apos;s price tag when nobody does.</span>
          </p>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        <section id="pillar-2" className="space-y-1.5">
          <p className="text-[12px] text-muted italic px-1">
            <a href="#pillar-1" className="text-graphite hover:text-pine font-medium not-italic">
              ← Part 1
            </a>{" "}
            walked the rules. Now: $13B in exposure under OBBBA.
          </p>
          <ObbbaReadinessPanel provisions={provisions} />
        </section>

        {/* Bridge P2→P3 — elevated pine treatment. Biggest narrative pivot
            on the page: regulatory exposure → operational diagnostic. */}
        <div className="flex items-center gap-4 py-4">
          <div className="flex-1 h-0.5 bg-pine/25" />
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-pine" />
            <p className="text-[14px] text-pine font-semibold leading-snug text-center max-w-md">
              The law just put $13B on the line.{" "}
              <span className="text-ink">Now: where the $13B comes from.</span>
            </p>
            <span className="w-2 h-2 rounded-full bg-pine" />
          </div>
          <div className="flex-1 h-0.5 bg-pine/25" />
        </div>

        <section id="pillar-3" className="space-y-1.5">
          <p className="text-[12px] text-muted italic px-1">
            <a href="#pillar-2" className="text-graphite hover:text-pine font-medium not-italic">
              ← Part 2
            </a>{" "}
            named the $13B exposure. Now: where the leak originates.
          </p>
          <CoverageMapPanel />
        </section>

        {/* Bridge P3→Landscape */}
        <div className="flex items-center gap-4 py-3">
          <div className="flex-1 h-px bg-hairline" />
          <p className="text-[13px] text-graphite leading-snug text-center max-w-md">
            We found the $13B leak.{" "}
            <span className="text-ink font-semibold">Now: who else is trying to plug it?</span>
          </p>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        <section id="landscape" className="space-y-1.5">
          <p className="text-[12px] text-muted italic px-1">
            <a href="#pillar-3" className="text-graphite hover:text-pine font-medium not-italic">
              ← Part 3
            </a>{" "}
            mapped the leak. Now: who&apos;s already in the space.
          </p>
          <LandscapePanel />
        </section>

        {/* Bridge Landscape→P4 */}
        <div className="flex items-center gap-4 py-3">
          <div className="flex-1 h-px bg-hairline" />
          <p className="text-[13px] text-graphite leading-snug text-center max-w-md">
            Nobody serves the household side.{" "}
            <span className="text-ink font-semibold">Now: how Civica does.</span>
          </p>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        <section id="pillar-4" className="space-y-1.5">
          <p className="text-[12px] text-muted italic px-1">
            <a href="#landscape" className="text-graphite hover:text-pine font-medium not-italic">
              ← Part 4
            </a>{" "}
            shows nobody owns the household side. Now: how Civica does.
          </p>
          <VerificationStackPanel tools={tools} summary={stackSummary} />
        </section>

        {/* Bridge P4→P5 */}
        <div className="flex items-center gap-4 py-3">
          <div className="flex-1 h-px bg-hairline" />
          <p className="text-[13px] text-graphite leading-snug text-center max-w-md">
            Civica ships the tools.{" "}
            <span className="text-ink font-semibold">Now: what they produce in the wild.</span>
          </p>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        <section id="pillar-5" className="space-y-1.5">
          <p className="text-[12px] text-muted italic px-1">
            <a href="#pillar-4" className="text-graphite hover:text-pine font-medium not-italic">
              ← Part 5
            </a>{" "}
            ships the tools. Now: what they produce in the wild.
          </p>
          <OutcomesPanel
            rows={outcomes}
            summary={outcomesHeadline}
            foiaOutcomes={foiaOutcomes}
          />
        </section>
        {/* Bridge P5→Model */}
        <div className="flex items-center gap-4 py-3">
          <div className="flex-1 h-px bg-hairline" />
          <p className="text-[13px] text-graphite leading-snug text-center max-w-md">
            The engine works.{" "}
            <span className="text-ink font-semibold">Now: why three constituencies pay for it.</span>
          </p>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        <section id="model" className="space-y-1.5">
          <p className="text-[12px] text-muted italic px-1">
            <a href="#pillar-5" className="text-graphite hover:text-pine font-medium not-italic">
              ← Part 6
            </a>{" "}
            proves the engine works. Now: who pays for it and why.
          </p>
          <BusinessModelPanel />

          {/* Unit economics — modeled · pre-pilot. CAC + payback + LTV close
              the financial story: BusinessModel shows revenue, this shows
              cost-and-return. Numbers tighten when the first cohort closes. */}
          <div className="rounded-[4px] border border-hairline bg-paper p-7">
            <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5">
                  Unit economics · modeled · pre-pilot
                </p>
                <h3 className="text-[20px] font-semibold tracking-tight text-ink leading-tight">
                  What one enrolled household costs, earns, and pays back
                </h3>
                <p className="text-[13px] text-graphite mt-1.5 max-w-3xl leading-relaxed">
                  BusinessModel above shows the revenue pools. The story&apos;s other half — cost
                  to acquire, payback period, and lifetime value — is here. CAC varies sharply by
                  channel; the rest is steady-state across all three pools.
                </p>
              </div>
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold shrink-0"
                style={{ background: "rgba(92,31,17,0.08)", color: "#5C1F11" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                modeled · pre-pilot
              </span>
            </div>

            {/* Stat grid — four headline numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <div className="rounded-[4px] bg-surface border border-hairline p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted mb-1.5">
                  CAC
                </p>
                <p className="text-[26px] font-bold tabular-nums leading-none text-ink">
                  $20–100
                </p>
                <p className="text-[10px] text-muted mt-1">per enrolled household, by channel</p>
              </div>
              <div className="rounded-[4px] bg-surface border border-hairline p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted mb-1.5">
                  Revenue
                </p>
                <p className="text-[26px] font-bold tabular-nums leading-none text-ink">
                  $171<span className="text-[12px] font-mono text-muted ml-1">/yr</span>
                </p>
                <p className="text-[10px] text-muted mt-1">per enrolled · steady state, 3 pools</p>
              </div>
              <div className="rounded-[4px] bg-surface border border-hairline p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted mb-1.5">
                  Payback
                </p>
                <p className="text-[26px] font-bold tabular-nums leading-none text-ink">
                  2–12<span className="text-[12px] font-mono text-muted ml-1">mo</span>
                </p>
                <p className="text-[10px] text-muted mt-1">CAC ÷ gross profit per period</p>
              </div>
              <div
                className="rounded-[4px] border p-4"
                style={{ background: "rgba(42,111,102,0.06)", borderColor: "rgba(42,111,102,0.30)" }}
              >
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold mb-1.5" style={{ color: "#2A6F66" }}>
                  3-yr LTV / CAC
                </p>
                <p className="text-[26px] font-bold tabular-nums leading-none" style={{ color: "#2A6F66" }}>
                  4–15×
                </p>
                <p className="text-[10px] text-muted mt-1">$360 LTV · varies by CAC band</p>
              </div>
            </div>

            {/* Channel breakdown */}
            <div className="mt-5 rounded-[4px] border border-hairline/60 bg-surface p-4">
              <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-3">
                CAC by channel — why the range is wide
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-2.5">
                <div>
                  <p className="text-[11px] font-bold text-ink mb-0.5">
                    Duty-of-care facility operator
                  </p>
                  <p className="text-[12px] font-mono tabular-nums text-graphite">~$50–125/enrolled</p>
                  <p className="text-[11px] text-graphite mt-0.5 leading-snug">
                    Multi-property SaaS sales cycle 3–6 months. Anchor of the primary wedge.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-ink mb-0.5">
                    Union / gig-platform channel
                  </p>
                  <p className="text-[12px] font-mono tabular-nums text-graphite">~$20–40/enrolled</p>
                  <p className="text-[11px] text-graphite mt-0.5 leading-snug">
                    Lowest CAC because the partner brings the audience (SEIU 2015, UFW, gig onboarding).
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-ink mb-0.5">
                    Direct consumer (iOS)
                  </p>
                  <p className="text-[12px] font-mono tabular-nums text-graphite">~$30–80/enrolled</p>
                  <p className="text-[11px] text-graphite mt-0.5 leading-snug">
                    Mobile acquisition in CA. Validates the funnel; rarely the cheapest route.
                  </p>
                </div>
              </div>
            </div>

            {/* Math footnote */}
            <p className="text-[11px] text-muted italic mt-4 max-w-3xl leading-relaxed">
              Math: $171 revenue/yr × 70% gross margin = ~$120 gross profit/enrolled/yr.
              At a $50 mid-band CAC, payback ≈ 5 months. 3-year LTV assumes typical SNAP
              retention across one full recertification cycle (~75% retain through year 2).
              All figures pre-pilot; the cost-side numbers replace with measured CAC once
              the first 10 households close and channel-specific spend lands.
            </p>
          </div>
        </section>

        {/* From the founder — personal voice signs off the argument before
            the sources chip. Humanizes the page for mission / YC reads.
            DRAFT COPY: rewrite the paragraph below in your own words.
            REAL PHOTO: replace the initials circle with
              <Image src="/founder.jpg" alt="Matthew" width={56} height={56}
                     className="rounded-full object-cover" />
            (drop the file in apps/dashboard/public/ first). */}
        <div className="rounded-[4px] bg-paper border border-hairline p-6 mt-4">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted mb-4">
            From the founder
          </p>
          <div className="flex items-start gap-4">
            <div
              aria-hidden="true"
              className="flex-shrink-0 w-14 h-14 rounded-full bg-pine flex items-center justify-center text-white text-[20px] font-bold tracking-tight"
            >
              M
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-graphite leading-relaxed max-w-2xl">
                I started Civica after watching the household side of SNAP
                enrollment up close — families who qualified, gave up, and
                never came back because the paperwork was harder than the
                rules. The system approves $13B a year that never reaches
                households. Civica is the layer that closes that gap,
                packet by packet.
              </p>
              <p className="text-[12px] text-ink font-semibold mt-3">
                Matthew
                <span className="text-muted font-normal"> · Founder, Civica</span>
              </p>
            </div>
          </div>
        </div>

        {/* Sources chip — moved out of the main scroll so the emotional close
            is the BusinessModel panel, not a footnote table. Full provenance
            lives at /compliance/sources. */}
        <div className="flex justify-center pt-4">
          <Link
            href="/compliance/sources"
            className="inline-flex items-center gap-2 text-[12px] text-graphite hover:text-pine font-medium px-4 py-2 border border-hairline rounded-full transition-colors"
          >
            <span className="text-muted">View</span>
            Sources &amp; provenance
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Three-fork CTA — what happens next depends on who's reading */}
        <div className="rounded-[4px] bg-pine overflow-hidden mt-3">
          <div className="px-7 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-2">
              If you read this far
            </p>
            <h3 className="text-[20px] font-bold tracking-tight leading-tight text-white mb-5">
              What happens next depends on who you are
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <a
                href="mailto:hello@civica.app?subject=Foundation%20%2F%20investor%20inquiry"
                className="block rounded-[4px] bg-white/5 hover:bg-white/10 transition-colors p-4 border border-white/10"
              >
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-white/40 mb-1.5">
                  Foundation / investor
                </p>
                <p className="text-[13px] text-white/85 leading-snug mb-2">
                  Let&apos;s talk thesis, traction, and the path to first paying contract.
                </p>
                <p className="text-[11px] font-mono" style={{ color: "#E8C547" }}>
                  hello@civica.app →
                </p>
              </a>
              <a
                href="mailto:hello@civica.app?subject=State%20%2F%20county%20demo"
                className="block rounded-[4px] bg-white/5 hover:bg-white/10 transition-colors p-4 border border-white/10"
              >
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-white/40 mb-1.5">
                  State / county partner
                </p>
                <p className="text-[13px] text-white/85 leading-snug mb-2">
                  Demo the navigator dashboard. See the §10105 / §10106 exposure attribution flow.
                </p>
                <p className="text-[11px] font-mono" style={{ color: "#E8C547" }}>
                  hello@civica.app →
                </p>
              </a>
              <a
                href="mailto:hello@civica.app?subject=Facility%20pilot%20inquiry"
                className="block rounded-[4px] bg-white/5 hover:bg-white/10 transition-colors p-4 border border-white/10"
              >
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-white/40 mb-1.5">
                  Facility operator
                </p>
                <p className="text-[13px] text-white/85 leading-snug mb-2">
                  Pilot inquiry for RCFE / Section 202 / PACE operators. ~$168K/yr in unlocked resident income per 100 residents.
                </p>
                <p className="text-[11px] font-mono" style={{ color: "#E8C547" }}>
                  hello@civica.app →
                </p>
              </a>
            </div>
            <p className="text-[10px] text-white/30 font-mono mt-4">
              Contact address is a placeholder — swap with the real Civica inbox once the domain is live.
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-hairline px-8 py-5 flex justify-between items-center text-[11px] text-muted font-mono tracking-wide mt-8">
        <span>Civica · compliance framework · operator view</span>
        <span>OBBBA windows: §10102 Jun 2026 · §10105 FY2026→FY2028 · §10106 Oct 2026</span>
      </footer>
    </div>
  );
}
