/**
 * ErrorReductionProjectionPanel — headline of /qc.
 *
 * Ties the existing three panels (ApiCoverage / Scoring / Baseline) into a
 * single narrative: for households where Civica's full verification stack
 * is engaged, projected PER drops from California's 10.98% baseline to
 * ~5.5% — driven by the two pillars Civica actually addresses: wire-verified
 * income (Argyle, Strong) and deterministic shelter logic (SUA engine + lease
 * OCR + phantom recert, Moderate).
 *
 * Honest framing: this is a projection, not a measured outcome. Caveat is
 * surfaced inline. As the served cohort grows, swap projection for observed
 * PER from qc_outcomes (T8 instrumentation).
 *
 * Source: docs/plans/civica-error-reduction-thesis.md
 * Element attribution: CA_ELEMENT_ATTRIBUTION_FY23 from snap-qc-engine.
 */

// ---------------------------------------------------------------------------
// Constants — pinned to FY24 CA PER + FY23 CA element attribution.
// These are statutory/published figures, not heuristics. Update on annual
// USDA QC release.
// ---------------------------------------------------------------------------

const CA_BASELINE_PER = 10.98; // FY24, USDA FNS-380
const PROJECTED_CIVICA_PER = 5.5; // see docs/plans/civica-error-reduction-thesis.md §4

// Per-axis share of the CA error surface that each pillar addresses.
// Income = wages + self-employment.
// Shelter = shelter deduction + SUA + shared-lease portion of shelter.
const INCOME_AXIS_SHARE = 26.51;
const SHELTER_AXIS_SHARE = 51.0; // shelter (39.94) + SUA (4.49) + shared-lease (~7.3 when classifier ships)
const CALC_AXIS_SHARE = 3.94;
const UNCOVERED_SHARE = 100 - INCOME_AXIS_SHARE - SHELTER_AXIS_SHARE - CALC_AXIS_SHARE; // ~18.6%

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorReductionProjectionProps {
  totalPackets: number;
  argyleConnected: number;
  /** Packets with at least one SUA utility-flag answered (heating / electric / phone). */
  suaAnswered: number;
  /** Packets with a lease or mortgage document uploaded. */
  shelterDocUploaded: number;
}

// ---------------------------------------------------------------------------
// Token palette — mirrors the existing /qc panels for visual consistency
// ---------------------------------------------------------------------------

const TEAL = "#2A6F66"; // Civica wins
const BRICK = "#9C3A24"; // baseline / exposure
const BRICK_DEEP = "#5C1F11"; // exposure callouts
const GRAPHITE = "#5A544D";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function ErrorReductionProjectionPanel({
  totalPackets,
  argyleConnected,
  suaAnswered,
  shelterDocUploaded,
}: ErrorReductionProjectionProps) {
  // Coverage rates per pillar, derived from real packet data.
  const incomeCoveragePct = totalPackets > 0
    ? Math.round((argyleConnected / totalPackets) * 100)
    : 0;

  // Shelter coverage = both SUA flags answered AND a shelter doc uploaded.
  // Use the lower of the two as a conservative coverage proxy until we wire
  // an explicit per-packet stack-engaged signal.
  const shelterEvidence = Math.min(suaAnswered, shelterDocUploaded);
  const shelterCoveragePct = totalPackets > 0
    ? Math.round((shelterEvidence / totalPackets) * 100)
    : 0;

  // Absolute reduction in PER points (10.98 → 5.5 = 5.48 pts saved).
  const reductionPts = CA_BASELINE_PER - PROJECTED_CIVICA_PER;
  const reductionPct = Math.round((reductionPts / CA_BASELINE_PER) * 100);

  return (
    <section className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">Headline · projected error rate for Civica-served households</p>
          <h3 className="text-[20px] font-semibold tracking-tight text-ink leading-tight">
            What it looks like from Civica: half the California baseline error rate
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            For an applicant whose Civica packet engages the full stack — Argyle income wire,
            lease OCR, deterministic SUA logic, calc engine — projected payment-error rate is
            roughly half the statewide FY24 baseline. Income and shelter together drive the
            reduction; the residual is structurally outside Civica&apos;s flows (RSDI, SSI, medical).
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-amber/10 text-amber shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          projection · not yet observed
        </span>
      </div>

      {/* Hero comparison — baseline vs Civica */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-5 mb-6 items-stretch">
        {/* Baseline */}
        <div
          className="rounded-[4px] p-5 bg-paper border-l-4"
          style={{ borderColor: BRICK }}
        >
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-1">
            California FY24 baseline
          </p>
          <p
            className="text-[44px] font-bold tabular-nums leading-none mt-1"
            style={{ color: BRICK }}
          >
            {CA_BASELINE_PER.toFixed(2)}%
          </p>
          <p className="text-[11px] text-graphite mt-1.5">
            Payment-error rate · USDA FNS-380 · published June 2025
          </p>
          <p className="text-[11px] text-muted mt-3 leading-snug">
            9.26% overpayment · 1.67% underpayment.
            Statewide rate across all CA SNAP cases.
          </p>
        </div>

        {/* Delta arrow */}
        <div className="flex items-center justify-center px-2">
          <div className="text-center">
            <div
              className="text-[28px] font-bold tabular-nums leading-none"
              style={{ color: TEAL }}
            >
              −{reductionPts.toFixed(1)}
            </div>
            <p
              className="text-[10px] uppercase tracking-[0.12em] font-semibold mt-1"
              style={{ color: TEAL }}
            >
              pts ({reductionPct}% lower)
            </p>
            <svg width="60" height="14" viewBox="0 0 60 14" className="mx-auto mt-3">
              <line x1="2" y1="7" x2="52" y2="7" stroke={TEAL} strokeWidth="1.5" />
              <path d="M52 2 L58 7 L52 12 Z" fill={TEAL} />
            </svg>
          </div>
        </div>

        {/* Civica projection */}
        <div
          className="rounded-[4px] p-5 bg-paper border-l-4"
          style={{ borderColor: TEAL }}
        >
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-1">
            Civica-served household · projected
          </p>
          <p
            className="text-[44px] font-bold tabular-nums leading-none mt-1"
            style={{ color: TEAL }}
          >
            ~{PROJECTED_CIVICA_PER.toFixed(1)}%
          </p>
          <p className="text-[11px] text-graphite mt-1.5">
            With full stack engaged · per-flow defensibility shift
          </p>
          <p className="text-[11px] text-muted mt-3 leading-snug">
            Halves the statewide rate. Residual driven by elements outside
            Civica&apos;s flows: RSDI, SSI, medical, child support.
          </p>
        </div>
      </div>

      {/* Two-pillar breakdown */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-3">
          The two pillars · what Civica actually wire-verifies
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <PillarCard
            label="Income axis"
            tool="Argyle payroll connection"
            statusTier="Strong · Live"
            surfaceShare={INCOME_AXIS_SHARE}
            defensibilityShift="Weak (80% err prob) → Strong (5%)"
            currentCoveragePct={incomeCoveragePct}
            currentCoverageN={argyleConnected}
            totalN={totalPackets}
            elementsCovered={["Wages (21.35%)", "Self-employment (5.16%)"]}
            color={TEAL}
          />
          <PillarCard
            label="Shelter axis"
            tool="SUA engine + lease OCR + sublease classifier"
            statusTier="Moderate · Live (classifier planned)"
            surfaceShare={SHELTER_AXIS_SHARE}
            defensibilityShift="Weak (80% err prob) → Moderate (35%)"
            currentCoveragePct={shelterCoveragePct}
            currentCoverageN={shelterEvidence}
            totalN={totalPackets}
            elementsCovered={[
              "Shelter deduction (39.94%)",
              "SUA (4.49%)",
              "Shared lease (~7.3%, when classifier ships)",
            ]}
            color={TEAL}
          />
        </div>

        {/* Residual surface */}
        <div className="rounded-[3px] border border-hairline/60 bg-paper p-4 flex gap-4 items-start">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-mono text-[12px] font-bold tabular-nums"
            style={{ background: "rgba(90,84,77,0.08)", color: GRAPHITE }}
          >
            {UNCOVERED_SHARE.toFixed(0)}%
          </div>
          <div>
            <p className="text-[12px] font-semibold text-ink leading-tight">
              Residual error surface — structurally outside Civica&apos;s flows
            </p>
            <p className="text-[11px] text-graphite mt-1 leading-snug">
              RSDI (11%), SSI (7.6%), other unearned income (6.3%), medical deduction (3.9%),
              child support, unemployment. These don&apos;t move with Civica&apos;s verification stack —
              they are the irreducible floor for a Civica-served household. Counted in the
              projected ~{PROJECTED_CIVICA_PER}% PER.
            </p>
          </div>
        </div>
      </div>

      {/* Honest caveat */}
      <div className="flex gap-3 items-start bg-amber/7 border border-amber/20 rounded-[3px] p-4 mt-5">
        <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0">
          <path d="M8 1.5 L15 14 L1 14 Z" fill="none" stroke="#9A5A14" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 6.5 V 10" stroke="#9A5A14" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.8" fill="#9A5A14" />
        </svg>
        <p className="text-[12px] text-graphite leading-relaxed">
          <strong className="text-ink font-semibold">Projection, not measurement.</strong>{" "}
          The ~{PROJECTED_CIVICA_PER}% figure is computed from per-flow defensibility error
          probabilities applied to CA&apos;s FY23 element-attribution shares. It is the expected
          outcome <em>if</em> Civica&apos;s served-cohort sample were large enough to measure.
          Today the panels below show actual per-flow coverage and any logged QC sampling.
          Once the cohort exceeds the QC sampling threshold, this card swaps projection for
          observed PER from <code className="font-mono text-[11px] bg-paper rounded px-1">qc_outcomes</code>.
        </p>
      </div>

      {/* Provenance footer */}
      <div className="flex justify-between items-center text-[10px] text-muted font-mono tracking-wide mt-4 pt-3 border-t border-hairline/50">
        <span>Baseline: USDA FNS-380 FY24 CA · attribution: CA QC microdata FY23</span>
        <span>Method: docs/plans/civica-error-reduction-thesis.md §4</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PillarCard — one of the two pillars (income or shelter)
// ---------------------------------------------------------------------------

interface PillarCardProps {
  label: string;
  tool: string;
  statusTier: string;
  surfaceShare: number;
  defensibilityShift: string;
  currentCoveragePct: number;
  currentCoverageN: number;
  totalN: number;
  elementsCovered: string[];
  color: string;
}

function PillarCard({
  label,
  tool,
  statusTier,
  surfaceShare,
  defensibilityShift,
  currentCoveragePct,
  currentCoverageN,
  totalN,
  elementsCovered,
  color,
}: PillarCardProps) {
  return (
    <article
      className="rounded-[4px] p-5 border border-hairline bg-surface flex flex-col gap-3"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted">
            {label}
          </p>
          <p className="text-[15px] font-semibold text-ink leading-tight mt-0.5">
            {tool}
          </p>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
          style={{ color, background: `${color}1A` }}
        >
          {statusTier}
        </span>
      </div>

      {/* Surface share */}
      <div className="flex items-baseline gap-2">
        <span className="text-[32px] font-bold tabular-nums leading-none" style={{ color }}>
          {surfaceShare.toFixed(1)}%
        </span>
        <span className="text-[12px] text-graphite leading-snug">
          of CA error surface addressed
        </span>
      </div>

      {/* Defensibility shift */}
      <div className="text-[11px] leading-snug">
        <span className="text-muted font-semibold uppercase tracking-wider text-[10px]">
          Defensibility shift
        </span>
        <p className="text-graphite mt-0.5">{defensibilityShift}</p>
      </div>

      {/* Live coverage rate */}
      <div className="pt-3 border-t border-hairline/50">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted">
            Current coverage on active packets
          </span>
          <span className="text-[14px] font-bold tabular-nums" style={{ color }}>
            {currentCoveragePct}%
          </span>
        </div>
        <div className="h-1.5 bg-paper border border-hairline rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${currentCoveragePct}%`, background: color }}
          />
        </div>
        <p className="text-[11px] text-graphite font-mono tracking-wide mt-1.5">
          {currentCoverageN.toLocaleString()}/{totalN.toLocaleString()} packets
        </p>
      </div>

      {/* Elements covered */}
      <div className="pt-3 border-t border-hairline/50">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-1.5">
          USDA elements addressed
        </p>
        <ul className="space-y-0.5">
          {elementsCovered.map((el) => (
            <li key={el} className="flex items-start gap-1.5 text-[11px] text-graphite">
              <span
                className="mt-[5px] w-1 h-1 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <span>{el}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
