/**
 * OutcomesPanel — pillar 5 of /compliance.
 *
 * The "P&L" closing argument. Three components:
 *   1. HeroScoreboard — three large cards, big numbers + delta bars
 *   2. Outcome rows — numbered list, delta bars on rows that have numeric data
 *   3. FoiaSection — fleshed-out FOIA-pending outcomes (what's coming + impact)
 *
 * Data: `lib/analytics/civica-outcomes.ts`.
 */
import type {
  OutcomeRow,
  OutcomeSourceKind,
  FoiaPendingOutcome,
  EffectIsolationRow,
} from "../../lib/analytics/civica-outcomes";
import { RadialGauges } from "./RadialGauges";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const CIVICA_COLOR = "#2A6F66";     // teal — Civica bars + hero numbers (Pillar 5 is the "wins" closing argument)
const BASELINE_COLOR = "#8E8579";
const DELTA_GOOD_COLOR = "#2A6F66"; // teal — positive delta callouts

const SOURCE_META: Record<OutcomeSourceKind, { label: string; color: string; bg: string }> = {
  live:     { label: "live cohort",         color: "#2A6F66", bg: "rgba(42,111,102,0.10)" },
  modeled:  { label: "modeled · pre-pilot", color: "#5C1F11", bg: "rgba(92,31,17,0.08)"   },
  baseline: { label: "system baseline",     color: "#5A544D", bg: "rgba(90,84,77,0.10)"   },
  foia:     { label: "measurement pending", color: "#B5511E", bg: "rgba(181,81,30,0.10)"  },
};

// Flagship metrics shown in the hero scoreboard (by step index)
const FLAGSHIP_STEPS = [1, 3, 4];

// ---------------------------------------------------------------------------
// DeltaBar — horizontal comparison bar, Civica vs baseline.
// Proportional to whichever value is larger so both bars are visible.
// Civica bar in teal; baseline bar in muted graphite.
// ---------------------------------------------------------------------------

function DeltaBar({
  civicaNumeric,
  baselineNumeric,
  unit,
  size = "row",
}: {
  civicaNumeric: number;
  baselineNumeric: number;
  unit?: string;
  size?: "row" | "hero";
}) {
  const maxValue = Math.max(civicaNumeric, baselineNumeric);
  const civicaWidth = (civicaNumeric / maxValue) * 100;
  const baselineWidth = (baselineNumeric / maxValue) * 100;
  const isHero = size === "hero";
  const barHeight = isHero ? "h-3.5" : "h-2.5";
  const labelClass = isHero ? "text-[12px]" : "text-[11px]";
  const valueClass = isHero ? "text-[14px]" : "text-[12px]";

  const formatVal = (n: number) =>
    `${n % 1 === 0 ? n : n.toFixed(1)}${unit && unit !== "%" ? ` ${unit}` : (unit ?? "")}`;

  return (
    <div className="space-y-1.5">
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className={`${labelClass} font-semibold tracking-wide`} style={{ color: CIVICA_COLOR }}>
            Civica
          </span>
          <span className={`${valueClass} tabular-nums font-bold`} style={{ color: CIVICA_COLOR }}>
            {formatVal(civicaNumeric)}
          </span>
        </div>
        <div className={`${barHeight} rounded-sm overflow-hidden bg-hairline/30`}>
          <div
            className={`${barHeight} rounded-sm`}
            style={{ width: `${civicaWidth}%`, background: CIVICA_COLOR }}
          />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className={`${labelClass} font-semibold tracking-wide text-muted`}>
            Baseline
          </span>
          <span className={`${valueClass} tabular-nums font-bold text-graphite`}>
            {formatVal(baselineNumeric)}
          </span>
        </div>
        <div className={`${barHeight} rounded-sm overflow-hidden bg-hairline/30`}>
          <div
            className={`${barHeight} rounded-sm`}
            style={{ width: `${baselineWidth}%`, background: BASELINE_COLOR }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BentoGrid — compact 2x4 card grid. Lets a YC-style skimmer scan the entire
// P&L (all 7 outcome rows + FOIA summary cell) in 3 seconds. The long-form
// numbered <ol> below remains for the diligence read.
// ---------------------------------------------------------------------------

function BentoGrid({
  rows,
  foiaCount,
}: {
  rows: OutcomeRow[];
  foiaCount: number;
}) {
  const sorted = [...rows].sort((a, b) => a.step - b.step);

  const fmt = (n: number, unit: string | undefined) => {
    const v = n % 1 === 0 ? n.toString() : n.toFixed(1);
    if (!unit) return v;
    if (unit === "%") return `${v}%`;
    return v;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
      {sorted.map((r) => {
        const meta = SOURCE_META[r.civicaSource];
        const hasNumeric = r.civicaNumeric != null;
        return (
          <div
            key={r.step}
            className="bg-paper border border-hairline rounded-[4px] p-3.5 flex flex-col min-h-[136px]"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-[10px] font-mono text-muted tabular-nums font-semibold">
                {r.step.toString().padStart(2, "0")}
              </span>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide whitespace-nowrap"
                style={{ color: meta.color, background: meta.bg }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: meta.color }} />
                {meta.label}
              </span>
            </div>

            {hasNumeric ? (
              <p
                className="text-[24px] font-bold tabular-nums leading-none"
                style={{ color: CIVICA_COLOR }}
              >
                {fmt(r.civicaNumeric as number, r.unit)}
                {r.unit && r.unit !== "%" && (
                  <span className="text-[12px] font-mono text-muted ml-1">{r.unit}</span>
                )}
              </p>
            ) : (
              <p className="text-[13px] text-muted italic leading-tight">
                measurement pending
              </p>
            )}

            {r.deltaLabel && (
              <p className="text-[11px] font-semibold mt-1.5 leading-tight" style={{ color: DELTA_GOOD_COLOR }}>
                {r.deltaLabel}
              </p>
            )}

            <p className="text-[11px] text-graphite mt-auto pt-2 leading-snug">
              {r.flagshipLabel ?? r.metric}
            </p>
          </div>
        );
      })}

      {/* FOIA summary cell — what's still coming */}
      <div className="bg-paper border border-hairline border-dashed rounded-[4px] p-3.5 flex flex-col min-h-[136px]">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[10px] font-mono text-muted font-semibold tracking-wide">
            FOIA
          </span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide"
            style={{ color: SOURCE_META.foia.color, background: SOURCE_META.foia.bg }}
          >
            <span className="w-1 h-1 rounded-full" style={{ background: SOURCE_META.foia.color }} />
            pending
          </span>
        </div>
        <p className="text-[24px] font-bold tabular-nums leading-none text-graphite">
          {foiaCount}
        </p>
        <p className="text-[11px] text-graphite mt-auto pt-2 leading-snug">
          outcomes pending CDSS / USDA FNS returns
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeroScoreboard — three large cards leading the panel
// ---------------------------------------------------------------------------

function HeroScoreboard({ rows }: { rows: OutcomeRow[] }) {
  const flagships = FLAGSHIP_STEPS
    .map((s) => rows.find((r) => r.step === s))
    .filter((r): r is OutcomeRow => r !== undefined);

  if (flagships.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
      {flagships.map((r) => {
        const hasNumeric = r.civicaNumeric != null && r.baselineNumeric != null;
        return (
          <div
            key={r.step}
            className="border-l-4 rounded-r-[3px] p-5 bg-paper"
            style={{ borderColor: CIVICA_COLOR }}
          >
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-1">
              {r.flagshipLabel ?? r.metric}
            </p>

            {/* Hero number */}
            {r.civica && (
              <p
                className="text-[44px] font-bold tabular-nums leading-none mt-1"
                style={{ color: CIVICA_COLOR }}
              >
                {r.civica}
              </p>
            )}
            {r.baseline && (
              <p className="text-[11px] text-muted mt-1.5 leading-snug">
                vs {r.baseline.split("·")[0].trim()}
              </p>
            )}

            {/* Delta bar */}
            {hasNumeric && (
              <div className="mt-4 pt-3 border-t border-hairline/50">
                <DeltaBar
                  civicaNumeric={r.civicaNumeric as number}
                  baselineNumeric={r.baselineNumeric as number}
                  unit={r.unit}
                  size="hero"
                />
              </div>
            )}

            {/* Delta callout */}
            {r.deltaLabel && (
              <div
                className="mt-4 inline-block px-2.5 py-1 rounded-sm text-[12px] font-bold tracking-tight"
                style={{ color: DELTA_GOOD_COLOR, background: "rgba(45,90,69,0.10)" }}
              >
                {r.deltaLabel}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ValueOrPending — text-only value rendering when no bar applies
// ---------------------------------------------------------------------------

function ValueOrPending({
  value,
  source,
}: {
  value: string | null;
  source: OutcomeSourceKind;
}) {
  if (value === null) {
    const meta = SOURCE_META[source];
    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: meta.color, background: meta.bg }}
      >
        {meta.label}
      </span>
    );
  }
  return (
    <span
      className={`text-[14px] tabular-nums font-semibold ${
        source === "live" ? "text-pine" : "text-graphite"
      }`}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Effect isolation — defangs the "cohort bias?" critique. For each flagship
// metric, shows raw cohort gap, modeled engine-attributable effect with CI,
// significance, and the "engine share" — what % of the raw gap survives
// controls for household type, county, and intake channel.
// Marked MODELED · PRE-PILOT so a skeptic grades them as projections.
// ---------------------------------------------------------------------------

function EffectIsolationCard({ rows }: { rows: EffectIsolationRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-8 pt-6 border-t-2 border-hairline">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-1">
            Is the advantage real?
          </p>
          <h4 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
            The gap holds even when we control for caseload mix
          </h4>
          <p className="text-[12px] text-graphite mt-1.5 leading-snug max-w-2xl">
            Civica&apos;s enrolled households skew slightly simpler than the statewide average.
            The cards below show how much of each advantage survives after accounting for that —
            the number that matters is the adjusted figure on the right.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide whitespace-nowrap shrink-0"
          style={{ color: "#C9922A", background: "rgba(201,146,42,0.10)" }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: "#C9922A" }} />
          MODELED · PRE-PILOT
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const engineShare = r.engineSharePct;
          const compositionShare = 100 - engineShare;
          return (
            <div
              key={r.step}
              className="rounded-[4px] border border-hairline bg-paper p-4"
            >
              <div className="flex items-start gap-6 flex-wrap">

                {/* Left: metric + raw gap */}
                <div className="w-[160px] shrink-0">
                  <p className="text-[13px] font-semibold text-ink leading-snug">
                    {r.metric}
                  </p>
                  <p className="text-[11px] text-muted leading-snug mt-0.5">
                    {r.rawAdvantage}
                  </p>
                </div>

                {/* Middle: plain-English split */}
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mb-2">
                    Where the advantage comes from
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                      style={{ background: CIVICA_COLOR }}
                    >
                      {engineShare}% from Civica&apos;s process
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-graphite"
                      style={{ background: "rgba(142,133,121,0.15)", border: "1px solid rgba(142,133,121,0.25)" }}
                    >
                      {compositionShare}% from who we serve
                    </span>
                  </div>
                  <p className="text-[11px] text-graphite leading-relaxed">
                    {r.interpretation}
                  </p>
                </div>

                {/* Right: adjusted figure — the number that matters */}
                <div className="shrink-0 text-right">
                  <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mb-0.5">
                    Adjusted advantage
                  </p>
                  <p
                    className="text-[18px] font-bold tabular-nums leading-none"
                    style={{ color: CIVICA_COLOR }}
                  >
                    {r.isolatedEffect}
                  </p>
                  <p className="text-[9px] text-muted font-mono mt-1 leading-snug">
                    {r.ciRange}
                  </p>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted/70 italic leading-snug mt-3">
        Controlled for household type, CA county, and intake channel. Modeled pre-pilot;
        regression updates when the pilot cohort closes.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FOIA section — fleshed-out "what's coming" with impact per source
// ---------------------------------------------------------------------------

function FoiaSection({ outcomes }: { outcomes: FoiaPendingOutcome[] }) {
  if (outcomes.length === 0) return null;
  return (
    <div className="mt-8 pt-6 border-t-2 border-hairline">
      <div className="mb-4 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-[#B5511E] mb-1">
            Measurement pending · {outcomes.length} FOIA returns
          </p>
          <h4 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
            What unlocks when the data lands
          </h4>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {outcomes.map((o) => (
          <div
            key={o.step}
            className="rounded-[4px] border border-hairline bg-paper p-4 flex flex-col"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[rgba(181,81,30,0.08)] border border-[rgba(181,81,30,0.30)] font-mono text-[10px] font-semibold text-[#B5511E] tabular-nums shrink-0">
                {o.step.toString().padStart(2, "0")}
              </span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                style={{ color: "#B5511E", background: "rgba(181,81,30,0.10)" }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: "#B5511E" }} />
                FOIA pending
              </span>
            </div>

            <h5 className="text-[14px] font-semibold tracking-tight text-ink leading-snug mb-2">
              {o.metric}
            </h5>

            <p className="text-[13px] text-graphite leading-relaxed flex-1">
              {o.impact}
            </p>

            <p className="text-[10px] text-muted font-mono mt-3 pt-3 border-t border-hairline/50 leading-snug">
              source: {o.foiaSource}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function OutcomesPanel({
  rows,
  summary,
  foiaOutcomes,
  effectIsolationRows,
}: {
  rows: OutcomeRow[];
  summary: {
    modeledRows: number;
    totalRows: number;
    foiaRows: number;
    headline: string;
  };
  foiaOutcomes: FoiaPendingOutcome[];
  effectIsolationRows: EffectIsolationRow[];
}) {
  return (
    <section
      aria-labelledby="outcomes-title"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7"
    >
      <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">Part 6 · pre-pilot targets · Civica vs the system it replaces</p>
          <h3
            id="outcomes-title"
            className="text-[20px] font-semibold tracking-tight text-ink leading-tight"
          >
            What the engine is built to produce
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            The three scoreboard cards lead the panel: lower payment error rate,
            faster decisions, more applications per navigator. The numbered rows
            below give the full P&amp;L. Civica-side figures are pre-pilot
            targets calibrated from USDA QC microdata and adjacent navigator
            literature; they flip to measured cohort data once the first 10
            enrolled households close.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold"
            style={{ background: "rgba(92,31,17,0.08)", color: "#5C1F11" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {summary.modeledRows} modeled · {summary.foiaRows} FOIA-pending · pre-pilot
          </span>
        </div>
      </div>

      {/* Scoreboard — radial arc gauge trio (3 flagship outcomes) */}
      <RadialGauges rows={rows} />

      {/* Bento — compact 2x4 scan view of all 7 outcomes + FOIA cell */}
      <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-3 mt-2">
        Scan view · all 7 outcomes at a glance
      </p>
      <BentoGrid rows={rows} foiaCount={foiaOutcomes.length} />

      {/* Long-form P&L rows — diligence read */}
      <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-3 mt-2">
        Detail · per-outcome explanation + Civica vs baseline
      </p>
      <ol className="border-t border-hairline">
        {rows.map((r) => {
          const civicaMeta = SOURCE_META[r.civicaSource];
          const hasNumeric = r.civicaNumeric != null && r.baselineNumeric != null;
          return (
            <li
              key={r.step}
              className="grid grid-cols-[36px_1fr_auto] gap-x-3.5 py-4 border-b border-hairline last:border-0"
            >
              <div className="pt-0.5">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-paper border border-hairline font-mono text-[10px] font-semibold text-graphite tabular-nums">
                  {r.step.toString().padStart(2, "0")}
                </span>
              </div>

              <div className="min-w-0">
                <h5 className="text-[16px] font-semibold tracking-tight text-ink leading-snug">
                  {r.metric}
                </h5>
                <p className="text-[14px] text-graphite mt-1.5 leading-relaxed max-w-2xl">
                  {r.description}
                </p>

                {hasNumeric ? (
                  // Numeric row: render the delta bar
                  <div className="mt-3 max-w-md">
                    <DeltaBar
                      civicaNumeric={r.civicaNumeric as number}
                      baselineNumeric={r.baselineNumeric as number}
                      unit={r.unit}
                    />
                    {r.deltaLabel && (
                      <p
                        className="text-[11px] font-bold mt-1.5"
                        style={{ color: DELTA_GOOD_COLOR }}
                      >
                        ↳ {r.deltaLabel}
                      </p>
                    )}
                  </div>
                ) : (
                  // Text-only row: fall back to side-by-side values
                  <div className="mt-2.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                    <span>
                      <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mr-1.5">
                        Civica
                      </span>
                      <ValueOrPending value={r.civica} source={r.civicaSource} />
                    </span>
                    <span>
                      <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mr-1.5">
                        Baseline
                      </span>
                      <ValueOrPending value={r.baseline} source={r.baselineSource} />
                    </span>
                  </div>
                )}

                {r.delta && (
                  <p className="text-[13px] text-graphite mt-3 leading-relaxed max-w-2xl pl-3 border-l-2 border-hairline italic">
                    <span className="font-semibold not-italic text-ink">What changes — </span>
                    {r.delta}
                  </p>
                )}
              </div>

              <div className="pt-0.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-normal whitespace-nowrap"
                  style={{ color: civicaMeta.color, background: civicaMeta.bg }}
                >
                  <span className="w-1 h-1 rounded-full" style={{ background: civicaMeta.color }} />
                  {civicaMeta.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Effect isolation — defangs the cohort-bias critique */}
      <EffectIsolationCard rows={effectIsolationRows} />

      {/* FOIA-pending — fleshed out, not collapsed */}
      <FoiaSection outcomes={foiaOutcomes} />

      <p className="text-[12px] text-graphite leading-relaxed mt-7 pt-4 border-t border-hairline/50">
        Modeled Civica figures are pre-pilot targets calibrated from USDA QC microdata
        and adjacent navigator-intervention literature; baseline figures come from
        USDA FNS QC public-use data and CDSS published dashboards (see Provenance below).
        FOIA targets close the remaining gaps. The surface flips to "live cohort" once
        production telemetry on
        <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5 mx-1">/qc</code>
        and
        <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5 mx-1">/cdss</code>
        is anchored to a closed cohort of ≥10 enrolled households.
      </p>
    </section>
  );
}
