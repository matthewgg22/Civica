/**
 * PillarTracking — four pillar strips (Shelter, Income, Lease, Calc) +
 * residual footer. Sits between FormulaHero and OBBBAReadinessStrip on /qc.
 *
 * Each strip answers three questions for one pillar:
 *   1. Where the pillar can land at full engagement (its PER contribution).
 *   2. Where the cohort is today (observed engagement vs target).
 *   3. What's slowing adoption (bottleneck) and what unlocks it (lever).
 *
 * Per arch-finding A3 (eng review 2026-05-25): OBBBA is NOT a pillar in this
 * component. Regulatory readiness lives in a separate OBBBAReadinessStrip
 * (T4b) because OBBBA-correctness prevents a new error rather than reducing
 * the CA FY24 baseline.
 *
 * Plan §3.2.
 */

import {
  CA_BASELINE_PER,
  PILLAR_SHARES_UNNORMALIZED,
  PILLAR_MAX_DEFENSIBILITY_SHIFT,
  RESIDUAL_FLOOR_SHARE,
  pillarContribution,
  type PillarCoverage,
} from "@civica/snap-qc-engine";

// Per-pillar shipping state + diagnostic copy. The bottleneck + lever strings
// are hand-curated — they describe known adoption blockers, not derivable
// from the data alone. Update when shipping state changes.
type PillarKey = keyof PillarCoverage;

interface PillarMeta {
  key: PillarKey;
  label: string;
  tool: string;
  /** What the pillar can achieve TODAY (1.0 if signal shipped, 0 if dormant). */
  achievableToday: number;
  /** Cohort adoption target needed for pillar's contribution to fully land. */
  targetEngagement: number;
  bottleneck: string;
  lever: string;
}

const PILLAR_META: PillarMeta[] = [
  {
    key: "utility_sua",
    label: "Shelter axis",
    tool: "SUA engine + lease OCR",
    achievableToday: 1.0,
    targetEngagement: 1.0,
    bottleneck:
      "Lease upload adoption during intake — applicants without a saved PDF skip the step.",
    lever:
      "Pre-fill intake step from BenefitsCal saved documents where consent allows.",
  },
  {
    key: "gig_income",
    label: "Income axis",
    tool: "Argyle payroll wire",
    achievableToday: 1.0,
    targetEngagement: 1.0,
    bottleneck:
      "Argyle connect prompt placement; W2 + gig-platform mix is opaque to applicants.",
    lever:
      "Elevate Argyle CTA above income self-report in intake step 3 + plain-English coverage list.",
  },
  {
    key: "shared_lease",
    label: "Shared-lease axis",
    tool: "Sublease classifier (UI pending)",
    achievableToday: 0,
    targetEngagement: 1.0,
    bottleneck:
      "Classifier logic shipped; navigator-facing UI integration is Phase 2.",
    lever:
      "Wire classifier output into navigator review queue; auto-flag sublease + shared-tenancy.",
  },
  {
    key: "benefit_impact",
    label: "Calc engine",
    tool: "CDSS deterministic rules",
    achievableToday: 1.0,
    targetEngagement: 1.0,
    bottleneck: "—",
    lever: "—",
  },
];

export interface PillarTrackingProps {
  totalPackets: number;
  argyleConnected: number;
  shelterDocCount: number;
  suaAnswered: number;
}

export default function PillarTracking({
  totalPackets,
  argyleConnected,
  shelterDocCount,
  suaAnswered,
}: PillarTrackingProps) {
  // Per-pillar observed engagement rates. Engine clamps NaN/out-of-range so
  // n=0 renders as 0% across the board.
  const observed: Record<PillarKey, number> = {
    utility_sua:
      totalPackets > 0
        ? Math.min(suaAnswered, shelterDocCount) / totalPackets
        : 0,
    gig_income: totalPackets > 0 ? argyleConnected / totalPackets : 0,
    shared_lease: 0,
    assets: 0,
    benefit_impact: 1.0,
  };

  return (
    <section
      aria-labelledby="pillar-tracking-title"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7"
    >
      <div className="mb-5">
        <p className="eyebrow mb-1.5">
          Pillar tracking · per-axis adoption against thesis target
        </p>
        <h3
          id="pillar-tracking-title"
          className="text-[20px] font-semibold tracking-tight text-ink leading-tight"
        >
          Where each pillar sits today vs full engagement
        </h3>
        <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
          Four pillars contribute to the projected PER reduction. Each strip
          shows the pillar&apos;s PER contribution at full engagement, how far
          the cohort is today, the named bottleneck, and the next lever.
        </p>
      </div>

      <div className="border border-hairline rounded-[3px] overflow-hidden">
        {PILLAR_META.map((meta, i) => (
          <PillarStrip
            key={meta.key}
            meta={meta}
            observed={observed[meta.key]}
            isLast={i === PILLAR_META.length - 1}
          />
        ))}
      </div>

      <ResidualFooter />
    </section>
  );
}

// ---------------------------------------------------------------------------
// One pillar strip
// ---------------------------------------------------------------------------

interface PillarStripProps {
  meta: PillarMeta;
  observed: number;
  isLast: boolean;
}

function PillarStrip({ meta, observed, isLast }: PillarStripProps) {
  const isDormant = meta.achievableToday === 0;
  const contributionAtTarget = pillarContribution(meta.key, meta.targetEngagement);
  const contributionToday = pillarContribution(meta.key, observed);
  const realizationPct =
    meta.targetEngagement > 0
      ? (observed / meta.targetEngagement) * 100
      : 0;

  // Color: brick if dormant (Phase 2), teal if shipped + fully realized,
  // warning amber if shipped + partially realized.
  const tierColor = isDormant
    ? "var(--color-warning)" // warning — Phase 2 not engaged
    : realizationPct >= 90
      ? "#2A6F66" // teal — at target
      : realizationPct >= 50
        ? "var(--color-amber-dark)" // warning — moderate gap
        : "#9C3A24"; // brick — large gap

  return (
    <article
      className={`p-5 ${isLast ? "" : "border-b border-hairline"} bg-surface`}
    >
      {/* Header: label, tool, contribution */}
      <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-graphite">
            {meta.label}
          </p>
          <p className="text-[15px] font-semibold text-ink leading-tight mt-0.5">
            {meta.tool}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-graphite">
            PER contribution at full engagement
          </p>
          <p
            className="text-[20px] font-bold tabular-nums leading-none mt-0.5"
            style={{ color: tierColor }}
          >
            −{contributionAtTarget.toFixed(2)} pts
          </p>
        </div>
      </div>

      {/* Target vs observed bar pair */}
      {!isDormant && (
        <div className="grid grid-cols-[140px_1fr_60px] items-center gap-3 mb-2">
          <span className="text-[11px] text-graphite">
            Target engagement
          </span>
          <div className="h-2 bg-paper border border-hairline rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-graphite/40"
              style={{ width: `${meta.targetEngagement * 100}%` }}
              role="img"
              aria-label={`Target engagement ${(meta.targetEngagement * 100).toFixed(0)} percent`}
            />
          </div>
          <span className="text-[11px] text-graphite font-mono tabular-nums tracking-wide text-right">
            {(meta.targetEngagement * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {!isDormant && (
        <div className="grid grid-cols-[140px_1fr_60px] items-center gap-3">
          <span className="text-[11px] font-semibold" style={{ color: tierColor }}>
            Observed today
          </span>
          <div className="h-2 bg-paper border border-hairline rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(observed, 1) * 100}%`,
                background: tierColor,
              }}
              role="img"
              aria-label={`Observed engagement ${(observed * 100).toFixed(0)} percent`}
            />
          </div>
          <span
            className="text-[11px] font-bold font-mono tabular-nums tracking-wide text-right"
            style={{ color: tierColor }}
          >
            {(observed * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {isDormant && (
        <div className="rounded-[3px] bg-warning/8 border border-warning/20 px-3 py-2 mb-2 flex items-baseline gap-2">
          <span
            className="text-[10px] uppercase tracking-[0.12em] font-semibold"
            style={{ color: "var(--color-warning)" }}
          >
            Phase 2
          </span>
          <span className="text-[12px] text-graphite leading-snug">
            Pillar dormant in current build · contribution materializes when
            classifier UI ships.
          </span>
        </div>
      )}

      {/* Realization + currently-realized contribution */}
      {!isDormant && (
        <div className="flex items-baseline justify-between text-[11px] mt-3 pt-3 border-t border-hairline/50">
          <span className="text-graphite">
            Realization:{" "}
            <span className="font-semibold text-ink tabular-nums">
              {realizationPct.toFixed(0)}%
            </span>{" "}
            of target · currently realizing{" "}
            <span
              className="font-semibold tabular-nums"
              style={{ color: tierColor }}
            >
              −{contributionToday.toFixed(2)} pts
            </span>
          </span>
          <span className="text-[10px] text-graphite font-mono tracking-wide">
            USDA weight {(PILLAR_SHARES_UNNORMALIZED[meta.key] * 100).toFixed(1)}% · max
            shift {(PILLAR_MAX_DEFENSIBILITY_SHIFT[meta.key] * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* Bottleneck + lever */}
      {meta.bottleneck !== "—" && (
        <div className="mt-3 pt-3 border-t border-hairline/50 grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-graphite">
            Bottleneck
          </span>
          <p className="text-[12px] text-graphite leading-snug">
            {meta.bottleneck}
          </p>
          <span
            className="text-[10px] uppercase tracking-[0.12em] font-semibold"
            style={{ color: "#2D5A45" }}
          >
            Lever
          </span>
          <p className="text-[12px] text-graphite leading-snug">{meta.lever}</p>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Residual footer — irreducible floor outside Civica's stack
// ---------------------------------------------------------------------------

function ResidualFooter() {
  return (
    <div className="mt-4 px-4 py-3 rounded-[3px] bg-paper border border-hairline/60 flex items-baseline gap-3">
      <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-graphite shrink-0">
        Residual
      </span>
      <p className="text-[12px] text-graphite leading-snug flex-1">
        <span className="font-semibold text-ink tabular-nums">
          {(RESIDUAL_FLOOR_SHARE * 100).toFixed(1)}%
        </span>{" "}
        of CA error surface is structurally outside Civica&apos;s stack — RSDI,
        SSI, medical deduction, child support, unemployment, dependent care.
        These don&apos;t move with pillar engagement; they are the irreducible
        floor for PER on a Civica-served household.
      </p>
      <span
        className="text-[18px] font-bold tabular-nums shrink-0"
        style={{ color: "#5A544D" }}
      >
        ≈ {(CA_BASELINE_PER * RESIDUAL_FLOOR_SHARE).toFixed(2)} pts
      </span>
    </div>
  );
}
