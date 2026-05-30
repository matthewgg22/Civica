/**
 * FormulaHero — the central operable equation for /qc Error Rate Intelligence.
 *
 * Two halves of the same formula:
 *   1. Projected at full pillar engagement (the thesis: ~5.5% PER)
 *   2. Engagement-implied at observed coverage today (what the formula says
 *      given current applicant data — NOT a measured PER)
 *
 * One hero metric: ENGAGEMENT REALIZATION GAP = engagement-implied - projected.
 * Tracks coverage adoption, not thesis falsification. The page does not claim
 * measurement until QC outcomes >= 30 sampled cases (CalibrationPanel territory).
 *
 * Math via packages/snap-qc-engine — single source of truth for pillar weights,
 * defensibility shifts, and the THESIS_CALIBRATION_FACTOR that anchors the
 * formula to the published 5.5% projection.
 *
 * Plan §3.1 + eng review CMT2 + cross-model tension #2 (2026-05-25).
 */

import {
  CA_BASELINE_PER,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  PILLAR_SHARES_UNNORMALIZED,
  RESIDUAL_FLOOR_SHARE,
  computeProjectedPER,
  computeEngagementImpliedPER,
  pillarContribution,
  type PillarCoverage,
} from "@civica/snap-qc-engine";

// Full-engagement coverage per pillar (the thesis input that lands 5.5%).
// All addressable pillars at 1.0 — the engine's THESIS_CALIBRATION_FACTOR
// anchors the formula at this coverage level. Assets stays at 0 (no Civica
// integration; max-defensibility-shift is 0 anyway, so this is a no-op).
//
// "Full engagement" here means: every applicant who could benefit from a
// pillar IS benefiting. The 5.5% projection is reached when adoption is
// complete across the cohort.
const FULL_ENGAGEMENT: PillarCoverage = {
  utility_sua: 1.0,
  gig_income: 1.0,
  shared_lease: 1.0,
  assets: 0,           // shift=0 anyway; engagement is moot
  benefit_impact: 1.0,
};

// Pillar display metadata. Order matches formula §3.1 in PER-contribution descending.
const PILLAR_DISPLAY = [
  {
    key: "utility_sua" as const,
    label: "Shelter axis",
    sublabel: "SUA engine + lease OCR",
  },
  {
    key: "gig_income" as const,
    label: "Income axis",
    sublabel: "Argyle payroll wire",
  },
  {
    key: "shared_lease" as const,
    label: "Shared-lease axis",
    sublabel: "Sublease classifier (UI pending)",
  },
  {
    key: "benefit_impact" as const,
    label: "Calc engine",
    sublabel: "CDSS deterministic rules",
  },
];

export interface FormulaHeroProps {
  totalPackets: number;
  argyleConnected: number;
  shelterDocCount: number;
  suaAnswered: number;
}

export default function FormulaHero({
  totalPackets,
  argyleConnected,
  shelterDocCount,
  suaAnswered,
}: FormulaHeroProps) {
  // Observed coverage rates per pillar. Engine clamps NaN / out-of-range to 0
  // (CQ2), so the n=0 case renders predictably as baseline PER.
  const observedCoverage: PillarCoverage = {
    utility_sua:
      totalPackets > 0
        ? Math.min(suaAnswered, shelterDocCount) / totalPackets
        : 0,
    gig_income: totalPackets > 0 ? argyleConnected / totalPackets : 0,
    shared_lease: 0, // classifier UI pending — Phase 2 wires this from packet data
    assets: 0,
    benefit_impact: 1.0,
  };

  const projectedPER = computeProjectedPER(FULL_ENGAGEMENT);
  const engagementImpliedPER = computeEngagementImpliedPER(observedCoverage);
  const realizationGap = engagementImpliedPER - projectedPER;

  // Gap trend coloring: brick widening, teal narrowing, graphite within ±0.5pts.
  const gapColor =
    Math.abs(realizationGap) < 0.5
      ? "#5A544D" // graphite
      : realizationGap > 0
        ? "#9C3A24" // brick (widening)
        : "#2A6F66"; // teal (narrowing, gap is negative)

  return (
    <section
      aria-labelledby="formula-hero-title"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7"
    >
      {/* Header */}
      <div className="mb-6">
        <p className="eyebrow mb-1.5">
          Thesis realization · formula and current data
        </p>
        <h2
          id="formula-hero-title"
          className="text-[20px] font-semibold tracking-tight text-ink leading-tight"
        >
          How the projected payment-error rate moves with engagement
        </h2>
        <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
          The formula projects PER by applying per-pillar defensibility shifts
          to USDA FY2023 element-attribution shares. Top half: at full stack
          engagement (the thesis target). Bottom half: at observed coverage
          today. The realization gap tracks coverage adoption, not measurement.
        </p>
      </div>

      {/* Formula table */}
      <table
        className="w-full text-[13px] tabular-nums"
        aria-label="Civica error-rate thesis · projected vs engagement-implied"
      >
        <caption className="sr-only">
          Civica error-rate thesis · projected vs engagement-implied population
          PER, derived from USDA FY2023 element-attribution shares applied to
          per-pillar defensibility shifts.
        </caption>

        {/* TOP HALF — projected at full engagement */}
        <tbody className="bg-paper/40">
          <tr className="border-b border-hairline">
            <td
              className="px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-graphite"
              colSpan={4}
            >
              Projected · at full stack engagement
            </td>
          </tr>
          <FormulaRow
            sign=""
            label="CA FY24 baseline PER · USDA FNS-380"
            weight="—"
            value={`${CA_BASELINE_PER.toFixed(2)}%`}
            tone="baseline"
          />
          {PILLAR_DISPLAY.map((p) => {
            const contribution = pillarContribution(
              p.key,
              FULL_ENGAGEMENT[p.key],
            );
            return (
              <FormulaRow
                key={`projected-${p.key}`}
                sign="−"
                label={`${p.label} @ ${(FULL_ENGAGEMENT[p.key] * 100).toFixed(0)}% full engagement`}
                sublabel={p.sublabel}
                weight={`${(PILLAR_SHARES_UNNORMALIZED[p.key] * 100).toFixed(1)}%`}
                value={`−${contribution.toFixed(2)} pts`}
              />
            );
          })}
          <FormulaRow
            sign=""
            label="Residual · RSDI / SSI / medical / child support (outside Civica's stack)"
            weight={`${(RESIDUAL_FLOOR_SHARE * 100).toFixed(1)}%`}
            value="irreducible floor"
            tone="muted"
          />
          <tr className="border-t border-hairline font-semibold">
            <th
              scope="row"
              className="px-3 py-2.5 text-left text-[14px] text-ink"
              colSpan={2}
            >
              <span className="text-[11px] text-graphite mr-2 font-bold">=</span>
              PROJECTED PER · at full stack engagement
            </th>
            <td className="px-3 py-2.5 text-right text-[10px] text-graphite font-medium">
              sums to 100%
            </td>
            <td className="px-3 py-2.5 text-right text-[18px] font-bold text-ink">
              ~{projectedPER.toFixed(2)}%
            </td>
          </tr>
        </tbody>

        {/* Spacer */}
        <tbody>
          <tr>
            <td colSpan={4} className="py-3" />
          </tr>
        </tbody>

        {/* BOTTOM HALF — engagement-implied at observed coverage */}
        <tbody className="bg-paper/40">
          <tr className="border-b border-hairline">
            <td
              className="px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-graphite"
              colSpan={4}
            >
              Engagement-implied · at observed coverage today
            </td>
          </tr>
          {PILLAR_DISPLAY.map((p) => {
            const obs = observedCoverage[p.key];
            const contribution = pillarContribution(p.key, obs);
            return (
              <FormulaRow
                key={`observed-${p.key}`}
                sign="−"
                label={`${p.label} @ ${(obs * 100).toFixed(0)}% observed engagement`}
                sublabel={p.sublabel}
                weight={`${(PILLAR_SHARES_UNNORMALIZED[p.key] * 100).toFixed(1)}%`}
                value={`−${contribution.toFixed(2)} pts`}
              />
            );
          })}
          <FormulaRow
            sign=""
            label="Residual · irreducible floor"
            weight={`${(RESIDUAL_FLOOR_SHARE * 100).toFixed(1)}%`}
            value="(constant)"
            tone="muted"
          />
          <tr className="border-t border-hairline font-semibold">
            <th
              scope="row"
              className="px-3 py-2.5 text-left text-[14px] text-ink"
              colSpan={2}
            >
              <span className="text-[11px] text-graphite mr-2 font-bold">=</span>
              ENGAGEMENT-IMPLIED PER · at observed coverage
            </th>
            <td />
            <td className="px-3 py-2.5 text-right text-[18px] font-bold text-ink">
              ~{engagementImpliedPER.toFixed(2)}%
            </td>
          </tr>
        </tbody>

        {/* GAP — the single hero number on the page */}
        <tbody>
          <tr aria-live="polite" aria-atomic="true">
            <th
              scope="row"
              className="px-3 pt-5 pb-2 text-left text-[10px] uppercase tracking-[0.14em] font-bold text-ink"
              colSpan={2}
            >
              Engagement realization gap
            </th>
            <td
              className="px-3 pt-5 pb-2 text-right text-[10px] text-graphite font-medium"
              aria-hidden="true"
            >
              {realizationGap > 0.5
                ? "▲ widening"
                : realizationGap < -0.5
                  ? "▼ narrowing"
                  : "≈ flat"}
            </td>
            <td
              className="px-3 pt-5 pb-2 text-right text-[32px] font-bold leading-none tabular-nums"
              style={{ color: gapColor }}
              aria-label={`Engagement realization gap: ${realizationGap >= 0 ? "positive" : "negative"} ${Math.abs(realizationGap).toFixed(2)} percentage points, ${
                realizationGap > 0.5
                  ? "widening"
                  : realizationGap < -0.5
                    ? "narrowing"
                    : "approximately flat"
              }`}
            >
              {realizationGap >= 0 ? "+" : ""}
              {realizationGap.toFixed(2)} pts
            </td>
          </tr>
        </tbody>
      </table>

      {/* Honest framing footer */}
      <div className="flex gap-3 items-start bg-amber/7 border border-amber/20 rounded-[3px] p-4 mt-5">
        <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0">
          <path
            d="M8 1.5 L15 14 L1 14 Z"
            fill="none"
            stroke="var(--color-amber-dark)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M8 6.5 V 10"
            stroke="var(--color-amber-dark)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="8" cy="12" r="0.8" fill="var(--color-amber-dark)" />
        </svg>
        <p className="text-[12px] text-graphite leading-relaxed">
          <strong className="text-ink font-semibold">
            Engagement-implied, not measured.
          </strong>{" "}
          Both halves are projections from the same formula. The bottom half
          substitutes today&apos;s observed coverage rates for the thesis&apos;s
          required-engagement assumptions. True measured PER requires the
          calibration card below (n ≥ 30 QC outcomes from{" "}
          <code className="font-mono text-[11px] bg-paper rounded px-1">
            qc_outcomes
          </code>
          ). The realization gap above tracks coverage adoption against the
          thesis target, not thesis falsification.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Internal row primitive
// ---------------------------------------------------------------------------

interface FormulaRowProps {
  sign: string;
  label: string;
  sublabel?: string;
  weight: string;
  value: string;
  tone?: "default" | "baseline" | "muted";
}

function FormulaRow({
  sign,
  label,
  sublabel,
  weight,
  value,
  tone = "default",
}: FormulaRowProps) {
  const valueColor =
    tone === "baseline"
      ? "#9C3A24" // brick — anchor / exposure
      : tone === "muted"
        ? "#5A544D" // graphite — passive constant
        : "#1A1714"; // ink — active reduction

  return (
    <tr className="border-b border-hairline/50">
      <td className="px-3 py-2 text-[11px] text-graphite font-bold w-6 align-top">
        {sign}
      </td>
      <td className="px-1 py-2 text-[12px] text-graphite leading-snug">
        <div>{label}</div>
        {sublabel && (
          <div className="text-[10px] text-graphite font-mono tracking-wide mt-0.5">
            {sublabel}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right text-[11px] text-graphite font-mono tracking-wide whitespace-nowrap">
        {weight}
      </td>
      <td
        className="px-3 py-2 text-right text-[13px] font-medium whitespace-nowrap"
        style={{ color: valueColor }}
      >
        {value}
      </td>
    </tr>
  );
}
