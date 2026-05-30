/**
 * SliceErrorRates — per-slice QC error rate with Wilson 95% bands.
 *
 * Consumes the A1 view snap_enrollment.v_qc_error_rate_by_slice (migration
 * 20260596) via buildSliceGroups. Each row shows one slice's measured error
 * rate (errors / completed reviews) as a point estimate AND its Wilson
 * confidence band, so a 1/1 slice reads "100% [21%, 100%]" rather than a
 * misleading certain 100%. The band, not the point, is the honest signal at
 * the small n a QC leaderboard lives in.
 *
 * The CA FY24 statewide PER (CA_BASELINE_PER) is drawn as a reference tick:
 * slices at/under it are teal, elevated slices warning, high slices brick.
 *
 * security_invoker on the view scopes rows to the navigator's own org, so no
 * cross-org min-N suppression is needed here — low-n slices are shown but
 * muted + tagged so they read as "not enough evidence yet", not as fact.
 *
 * A1 / docs/plans/error-attribution-ledger.md.
 */

import { CA_BASELINE_PER } from "@civica/snap-qc-engine";
import {
  MIN_CONFIDENT_N,
  type SliceGroup,
} from "../../lib/qc/slice-rates";

export interface SliceErrorRatesProps {
  /** null = view unavailable in this env (migration 20260596 not applied). */
  groups: SliceGroup[] | null;
}

const BASELINE_FRAC = CA_BASELINE_PER / 100; // 0.1098

const TEAL = "#2A6F66";
const WARNING = "var(--color-amber-dark)";
const BRICK = "#9C3A24";

/** Color a slice by its rate relative to the CA statewide baseline. */
function rateColor(rate: number): string {
  const pct = rate * 100;
  if (pct <= CA_BASELINE_PER) return TEAL;
  if (pct <= CA_BASELINE_PER * 2) return WARNING;
  return BRICK;
}

const pct1 = (frac: number): string => `${(frac * 100).toFixed(1)}%`;

export default function SliceErrorRates({ groups }: SliceErrorRatesProps) {
  const totalRows =
    groups?.reduce((sum, g) => sum + g.rows.length, 0) ?? 0;

  // Shared x-scale across every group so bands are visually comparable. Floor
  // at 25% and pad the widest upper bound; never exceed 100%.
  const maxUpper = groups
    ? Math.max(
        BASELINE_FRAC * 1.5,
        ...groups.flatMap((g) => g.rows.map((r) => r.upper)),
      )
    : 0;
  const scaleMax = Math.min(1, Math.max(0.25, maxUpper * 1.08));

  return (
    <section
      aria-labelledby="slice-rates-title"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7"
    >
      <div className="mb-5">
        <p className="eyebrow mb-1.5">
          QC · per-slice error rate · Wilson 95% band
        </p>
        <h2
          id="slice-rates-title"
          className="text-[20px] font-semibold tracking-tight text-ink leading-tight"
        >
          Where measured errors concentrate
        </h2>
        <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
          Measured error rate over completed QC reviews, broken out by category,
          county, and language. Each bar is the Wilson 95% confidence band; the
          marker is the point estimate. Bands are wide where few packets have
          been reviewed — that is the signal, not noise. The dashed tick is the
          CA FY24 statewide PER ({CA_BASELINE_PER.toFixed(2)}%).
        </p>
      </div>

      {groups === null ? (
        <EmptyState
          title="Per-slice view not available in this environment"
          body="Apply migration 20260596_qc_error_rate_by_slice.sql via the Supabase SQL Editor, then reload. The view returns nothing until it exists."
        />
      ) : totalRows === 0 ? (
        <EmptyState
          title="No completed QC reviews yet"
          body="Slices appear once navigators log sampled QC outcomes (qc_sampled with a recorded error_found). Until then there is no denominator to rate."
        />
      ) : (
        <div className="space-y-6">
          {groups
            .filter((g) => g.rows.length > 0)
            .map((group) => (
              <SliceGroupBlock
                key={group.dim}
                group={group}
                scaleMax={scaleMax}
              />
            ))}

          <Legend />
        </div>
      )}
    </section>
  );
}

function SliceGroupBlock({
  group,
  scaleMax,
}: {
  group: SliceGroup;
  scaleMax: number;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-graphite mb-2">
        {group.label}
      </p>
      <div className="border border-hairline rounded-[3px] overflow-hidden">
        {group.rows.map((row, i) => (
          <SliceRowView
            key={`${group.dim}:${row.sliceValue}`}
            sliceValue={row.sliceValue}
            n={row.n}
            errors={row.errors}
            rate={row.rate}
            lower={row.lower}
            upper={row.upper}
            scaleMax={scaleMax}
            isLast={i === group.rows.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function SliceRowView({
  sliceValue,
  n,
  errors,
  rate,
  lower,
  upper,
  scaleMax,
  isLast,
}: {
  sliceValue: string;
  n: number;
  errors: number;
  rate: number;
  lower: number;
  upper: number;
  scaleMax: number;
  isLast: boolean;
}) {
  const color = rateColor(rate);
  const lowConfidence = n < MIN_CONFIDENT_N;
  const opacity = lowConfidence ? 0.45 : 1;

  // Geometry as percentages of the shared scale.
  const leftPct = (lower / scaleMax) * 100;
  const widthPct = Math.max(((upper - lower) / scaleMax) * 100, 1.5);
  const markerPct = (rate / scaleMax) * 100;
  const baselinePct = Math.min((BASELINE_FRAC / scaleMax) * 100, 100);

  return (
    <div
      className={`grid grid-cols-[150px_1fr_132px] items-center gap-3 px-4 py-2.5 bg-surface ${
        isLast ? "" : "border-b border-hairline"
      }`}
    >
      {/* Slice label */}
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-ink truncate" title={sliceValue}>
          {sliceValue}
        </p>
        <p className="text-[10px] text-graphite font-mono tabular-nums tracking-wide">
          {errors}/{n} {n === 1 ? "review" : "reviews"}
          {lowConfidence && (
            <span className="ml-1 text-warning">· low n</span>
          )}
        </p>
      </div>

      {/* Wilson band track */}
      <div
        className="relative h-3.5 bg-paper border border-hairline rounded-full"
        role="img"
        aria-label={`${sliceValue}: ${pct1(rate)} error rate, 95% confidence ${pct1(lower)} to ${pct1(upper)}, n=${n}`}
      >
        {/* CA baseline reference tick */}
        <div
          className="absolute top-[-2px] bottom-[-2px] w-px border-l border-dashed border-graphite/50"
          style={{ left: `${baselinePct}%` }}
          aria-hidden
        />
        {/* Wilson band */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            background: color,
            opacity: opacity * 0.32,
          }}
        />
        {/* Point estimate marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] h-3.5 rounded-full"
          style={{ left: `${markerPct}%`, background: color, opacity }}
        />
      </div>

      {/* Numeric rate + band */}
      <div className="text-right">
        <p
          className="text-[14px] font-bold tabular-nums leading-none"
          style={{ color, opacity }}
        >
          {pct1(rate)}
        </p>
        <p className="text-[10px] text-graphite font-mono tabular-nums tracking-wide mt-0.5">
          [{pct1(lower)}, {pct1(upper)}]
        </p>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[10px] text-graphite">
      <LegendDot color={TEAL} label={`at/under CA baseline (≤${CA_BASELINE_PER.toFixed(1)}%)`} />
      <LegendDot color={WARNING} label={`elevated (≤${(CA_BASELINE_PER * 2).toFixed(1)}%)`} />
      <LegendDot color={BRICK} label="high" />
      <span className="font-mono tracking-wide">
        marker = point estimate · bar = Wilson 95% band · dashed tick = CA FY24 PER
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[3px] bg-paper border border-hairline/60 px-5 py-6 text-center">
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      <p className="text-[12px] text-graphite mt-1.5 max-w-md mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  );
}
