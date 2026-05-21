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

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const CIVICA_COLOR = "#2A6F66";     // teal — Civica bars + hero numbers (Pillar 5 is the "wins" closing argument)
const BASELINE_COLOR = "#8E8579";
const DELTA_GOOD_COLOR = "#2A6F66"; // teal — positive delta callouts

const SOURCE_META: Record<OutcomeSourceKind, { label: string; color: string; bg: string }> = {
  live:     { label: "live cohort",         color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
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
    `${n % 1 === 0 ? n : n.toFixed(1)}${unit ?? ""}`;

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
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-1">
            Effect isolation · is the cohort advantage real?
          </p>
          <h4 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
            What survives when we control for who Civica enrolls
          </h4>
          <p className="text-[12px] text-graphite mt-1 leading-snug max-w-3xl">
            Civica&apos;s cohort skews simpler than the statewide population — a
            real selection signal. For each flagship metric, the raw advantage
            is decomposed into the part attributable to that cohort mix and
            the part attributable to the engine itself, controlling for
            household type, county, and intake channel.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide whitespace-nowrap"
          style={{ color: "#C9922A", background: "rgba(201,146,42,0.10)" }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: "#C9922A" }} />
          MODELED · PRE-PILOT
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((r) => {
          const engineShare = r.engineSharePct;
          const compositionShare = 100 - engineShare;
          return (
            <div
              key={r.step}
              className="rounded-[4px] border border-hairline bg-paper p-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-x-4 gap-y-2 items-start">
                {/* Metric name */}
                <div>
                  <p className="text-[14px] font-semibold text-ink leading-snug">
                    {r.metric}
                  </p>
                  <p className="text-[11px] text-muted leading-snug mt-1">
                    {r.rawAdvantage}
                  </p>
                </div>

                {/* Decomposition bar — composition vs engine */}
                <div>
                  <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mb-1.5">
                    Raw gap decomposition
                  </p>
                  <div className="flex h-6 rounded-sm overflow-hidden border border-hairline">
                    <div
                      className="flex items-center justify-center text-white text-[10px] font-semibold"
                      style={{ width: `${engineShare}%`, background: CIVICA_COLOR }}
                      title={`Engine-attributable: ${engineShare}% of raw gap`}
                    >
                      Engine {engineShare}%
                    </div>
                    <div
                      className="flex items-center justify-center text-[10px] font-semibold text-graphite"
                      style={{ width: `${compositionShare}%`, background: "rgba(142,133,121,0.25)" }}
                      title={`Cohort composition: ${compositionShare}% of raw gap`}
                    >
                      Composition {compositionShare}%
                    </div>
                  </div>
                  <p className="text-[11px] text-graphite leading-snug mt-2">
                    {r.interpretation}
                  </p>
                </div>

                {/* Isolated effect with CI */}
                <div className="md:text-right">
                  <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mb-0.5">
                    Engine-only effect
                  </p>
                  <p
                    className="text-[15px] font-bold tabular-nums leading-none"
                    style={{ color: CIVICA_COLOR }}
                  >
                    {r.isolatedEffect}
                  </p>
                  <p className="text-[10px] text-muted font-mono mt-1.5 leading-snug">
                    {r.ciRange}
                  </p>
                  <p className="text-[10px] text-muted font-mono leading-snug">
                    {r.significance}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted italic leading-snug mt-4">
        Controls: household type (working / elderly / disabled / fixed-income / other), CA county fixed
        effects, intake channel (Civica vs paper vs BenefitsCal self-service vs existing CBO).
        Modeled against the USDA QC FY2024 microdata calibration + adjacent benefits-navigator
        intervention literature; the actual regression swaps in when the pilot cohort closes
        (TODO-12 milestone).
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
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-[#B5511E] mb-1">
          Measurement pending · {outcomes.length} FOIA returns will close these gaps
        </p>
        <h4 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
          What we&apos;ll know when the data lands
        </h4>
        <p className="text-[12px] text-graphite mt-1 leading-snug max-w-3xl">
          Three outcomes are blocked on state and federal data releases. Each row
          names the FOIA source, the best-available pre-release estimate, and how
          the answer reshapes the Civica comparison story when it lands.
        </p>
      </div>

      <div className="space-y-3">
        {outcomes.map((o) => (
          <div
            key={o.step}
            className="rounded-[4px] border border-hairline bg-paper p-4"
          >
            <div className="flex items-start gap-3 mb-2 flex-wrap">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[rgba(181,81,30,0.08)] border border-[rgba(181,81,30,0.30)] font-mono text-[10px] font-semibold text-[#B5511E] tabular-nums shrink-0">
                {o.step.toString().padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <h5 className="text-[15px] font-semibold tracking-tight text-ink leading-snug">
                  {o.metric}
                </h5>
                <p className="text-[11px] text-muted font-mono mt-0.5 leading-snug">
                  source: {o.foiaSource}
                </p>
              </div>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-normal whitespace-nowrap"
                style={{ color: "#B5511E", background: "rgba(181,81,30,0.10)" }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: "#B5511E" }} />
                FOIA pending
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mb-1">
                  What it unlocks
                </p>
                <p className="text-[12px] text-graphite leading-snug">
                  {o.whatItUnlocks}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mb-1">
                  Pre-FOIA expected range
                </p>
                <p className="text-[12px] text-graphite leading-snug">
                  {o.expectedRange}
                </p>
              </div>
              <div className="md:border-l md:border-hairline md:pl-3">
                <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-amber mb-1">
                  How it reshapes the Civica story
                </p>
                <p className="text-[12px] text-graphite leading-snug">
                  {o.impactsCivica}
                </p>
              </div>
            </div>
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
    liveRows: number;
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
          <p className="eyebrow mb-1.5">Pillar 5 · outcomes · Civica vs the system it replaces</p>
          <h3
            id="outcomes-title"
            className="text-[20px] font-semibold tracking-tight text-ink leading-tight"
          >
            What the engine actually produces in the wild
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            The three scoreboard cards lead the panel: lower payment error rate,
            faster decisions, more applications per navigator. The numbered rows
            below give the full P&amp;L; the FOIA-pending section names what
            measurement is still coming and how each data return reshapes the
            Civica comparison.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-pine-surface text-pine">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {summary.liveRows} live · {summary.foiaRows} FOIA-pending
          </span>
          <p className="text-[11px] text-muted font-mono tracking-wide mt-1.5 max-w-md text-right">
            {summary.headline}
          </p>
        </div>
      </div>

      {/* Scoreboard — three large hero cards with delta bars */}
      <HeroScoreboard rows={rows} />

      {/* Full P&L rows */}
      <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-3 mt-2">
        Full P&amp;L · all measured outcomes
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
        Live cohort figures come from production telemetry on
        <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5 mx-1">/qc</code>
        and
        <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5 mx-1">/cdss</code>
        ; baseline figures come from USDA FNS QC public-use data and CDSS published dashboards
        (see Provenance below). FOIA targets close the remaining gaps. Cohort claims tighten
        as the first pilot cohort closes.
      </p>
    </section>
  );
}
