/**
 * RulesFrameworkPanel — pillar 1 of /compliance.
 *
 * Three sections in one panel:
 *   1. Who can apply — federal eligibility gates.
 *   2. How the benefit is calculated — 7-step federal chain.
 *   3. California overlays — CA-specific deltas.
 *
 * Each section uses the same row pattern: numbered circle + plain-English
 * statement + explainer + key figures + thin footer (authorities · source · status).
 *
 * Data: `lib/analytics/snap-framework.ts`.
 */
import type {
  FrameworkItem,
  FrameworkStatus,
  UnderEnrolledPopulation,
} from "../../lib/analytics/snap-framework";
import CaliforniaOverlaysMap from "./CaliforniaOverlaysMap";

const STATUS_META: Record<FrameworkStatus, { color: string; bg: string }> = {
  Implemented:    { color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  Partial:        { color: "#9A5A14", bg: "rgba(154,90,20,0.10)" },
  Discretionary:  { color: "#9C3A24", bg: "rgba(156,58,36,0.10)" },
};

// ---------------------------------------------------------------------------
// BenefitFormulaCard — anchor for Section B. Plain-English equation on the
// left, single worked example on the right. Defangs the 7 steps that
// follow: reader sees the formula AND a concrete dollar number before
// stepping through the decomposed rows.
//
// Example household chosen to exercise every step that kicks in:
//   HH3, single working parent + 2 kids, $2,500 earned/mo, $1,400 shelter
//   - gross income test pass (HH3 130% FPL = $2,888)
//   - 20% earned deduction triggers
//   - standard deduction triggers (HH3: $209)
//   - excess shelter triggers (well under cap)
//   - net income test pass (HH3 100% FPL = $2,221)
//   - benefit = max allotment ($785) − 30% × net
//   - minimum floor doesn't trigger (HH3)
//
// FY2026 figures throughout — mirrors snap-framework.ts.
// ---------------------------------------------------------------------------

function BenefitFormulaCard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-paper border border-hairline rounded-[4px] p-5">
      {/* LEFT — the formula */}
      <div className="md:border-r md:border-hairline md:pr-5">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-3">
          How the benefit is computed
        </p>

        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-graphite mb-1.5">
              Net income
            </p>
            <div className="pl-3 border-l-2 border-amber/40 space-y-1 text-[13px] text-ink tabular-nums">
              <p>gross income</p>
              <p className="text-graphite">− 20% of earned wages</p>
              <p className="text-graphite">− standard deduction (by household size)</p>
              <p className="text-graphite">− dependent care</p>
              <p className="text-graphite">− excess shelter (above 50% of remaining)</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-graphite mb-1.5">
              Monthly benefit
            </p>
            <div className="pl-3 border-l-2 border-amber/40 space-y-1 text-[13px] text-ink tabular-nums">
              <p>max allotment (by household size)</p>
              <p className="text-graphite">− 30% × net income</p>
            </div>
            <p className="text-[11px] text-muted italic mt-1.5 pl-3">
              floored at $24/mo for 1-2 person households
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — worked example */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-1">
          Example
        </p>
        <p className="text-[12px] text-graphite mb-3 leading-snug">
          Household of 3 · single working parent + 2 kids · <span className="font-semibold text-ink tabular-nums">$2,500</span> earned/mo · <span className="font-semibold text-ink tabular-nums">$1,400</span> rent + utilities
        </p>

        <div className="font-mono text-[12px] text-ink tabular-nums space-y-0.5">
          <div className="flex justify-between">
            <span>Gross income</span>
            <span className="font-semibold">$2,500</span>
          </div>
          <div className="flex justify-between text-graphite">
            <span>− 20% earned deduction</span>
            <span>− $500</span>
          </div>
          <div className="flex justify-between text-graphite">
            <span>− Standard deduction (HH3)</span>
            <span>− $209</span>
          </div>
          <div className="flex justify-between text-graphite">
            <span>− Excess shelter</span>
            <span>− $505</span>
          </div>
          <div className="flex justify-between border-t border-hairline pt-1 mt-1">
            <span className="font-semibold">Net income</span>
            <span className="font-bold text-ink">$1,286</span>
          </div>
          <p className="text-[10px] text-amber italic font-sans pt-0.5">
            ✓ Below HH3 net limit ($2,221)
          </p>

          <div className="flex justify-between pt-3 border-t border-hairline mt-2">
            <span>Max allotment HH3</span>
            <span className="font-semibold">$785</span>
          </div>
          <div className="flex justify-between text-graphite">
            <span>− 30% × net income</span>
            <span>− $386</span>
          </div>
          <div className="flex justify-between border-t-2 border-[#C9922A] pt-1 mt-1">
            <span className="font-bold text-[#C9922A]">Monthly benefit</span>
            <span className="font-bold text-[#C9922A] text-[14px]">$399</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Subsection({
  eyebrow,
  title,
  lede,
  items,
  numberBg = "bg-paper",
  prelude,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  items: FrameworkItem[];
  numberBg?: string;
  /** Optional content rendered between the lede and the row list. */
  prelude?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-1">
          {eyebrow}
        </p>
        <h4 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
          {title}
        </h4>
        <p className="text-[13px] text-graphite mt-1 leading-snug max-w-2xl">
          {lede}
        </p>
      </div>

      {prelude && <div className="mb-4">{prelude}</div>}

      <ol className="border-t border-hairline">
        {items.map((n) => {
          const statusMeta = STATUS_META[n.status];
          return (
            <li
              key={n.step}
              className="grid grid-cols-[36px_1fr_auto] gap-x-3.5 py-3 border-b border-hairline last:border-0"
            >
              <div className="pt-0.5">
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${numberBg} border border-hairline font-mono text-[10px] font-semibold text-graphite tabular-nums`}
                >
                  {n.step.toString().padStart(2, "0")}
                </span>
              </div>

              <div className="min-w-0">
                <h5 className="text-[16px] font-semibold tracking-tight text-ink leading-snug">
                  {n.statement}
                </h5>
                <p className="text-[14px] text-graphite mt-1.5 leading-relaxed max-w-2xl">
                  {n.explainer}
                </p>
                <p className="text-[12px] font-medium text-ink mt-1.5 tabular-nums">
                  {n.figures}
                </p>
                <p className="mt-1.5 font-mono text-[10px] tracking-wide text-muted leading-snug">
                  <span className="text-graphite">{n.authorities.join(" · ")}</span>
                  <span className="mx-2 text-muted/50">·</span>
                  <span className="break-all">{n.source}</span>
                </p>
              </div>

              <div className="pt-0.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-normal whitespace-nowrap"
                  style={{ color: statusMeta.color, background: statusMeta.bg }}
                >
                  <span className="w-1 h-1 rounded-full" style={{ background: statusMeta.color }} />
                  {n.status}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section D — under-enrolled populations rendered as a comparative bar chart
// + collapsed cards. Visualization first; prose lives in expandable drawers.
// ---------------------------------------------------------------------------

const CHART_WIDTH = 1080;
const BAR_HEIGHT = 42;
const BAR_GAP = 26;
const CHART_TOP = 28;
const CHART_LEFT = 230; // label column — fits 2-line wrapped names
const CHART_RIGHT = 110; // right column — fits stacked gap + enrolled callout

const ENROLLED_COLOR = "#C9922A";
const GAP_COLOR = "#9A5A14";

// Wrap a population label to a max-chars width, returning 1-2 tspan-ready
// lines. Long labels wrap; short ones stay single-line.
function wrapLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
      continue;
    }
    if ((current + " " + w).length > maxChars) {
      lines.push(current);
      current = w;
    } else {
      current = current + " " + w;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function UnderEnrolledChart({
  populations,
  maxMillions,
}: {
  populations: UnderEnrolledPopulation[];
  maxMillions: number;
}) {
  const innerWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const chartHeight =
    CHART_TOP + populations.length * (BAR_HEIGHT + BAR_GAP) + 24;

  // Tick marks every 2M up to maxMillions.
  const tickInterval = 2;
  const ticks: number[] = [];
  for (let t = 0; t <= maxMillions; t += tickInterval) ticks.push(t);

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
      className="w-full h-auto block"
      role="img"
      aria-label="National SNAP eligibility vs enrollment by under-enrolled population"
    >
      {/* Diagonal-stripe pattern for the gap fill — communicates "missing"
          more viscerally than a solid pale fill or a dashed outline. */}
      <defs>
        <pattern
          id="gap-stripes"
          patternUnits="userSpaceOnUse"
          width={7}
          height={7}
          patternTransform="rotate(45)"
        >
          <rect width={7} height={7} fill="rgba(154,90,20,0.07)" />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={7}
            stroke={GAP_COLOR}
            strokeWidth={1.2}
            strokeOpacity={0.45}
          />
        </pattern>
      </defs>

      {/* X-axis grid lines + tick labels */}
      <g>
        {ticks.map((t) => {
          const x = CHART_LEFT + (t / maxMillions) * innerWidth;
          return (
            <g key={t}>
              <line
                x1={x}
                y1={CHART_TOP - 8}
                x2={x}
                y2={CHART_TOP + populations.length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP + 4}
                stroke="rgba(0,0,0,0.06)"
                strokeWidth={1}
              />
              <text
                x={x}
                y={CHART_TOP - 12}
                textAnchor="middle"
                className="fill-muted text-[10px] font-mono tracking-wide"
              >
                {t === 0 ? "0" : `${t}M`}
              </text>
            </g>
          );
        })}
      </g>

      {/* Bars */}
      {populations.map((p, idx) => {
        const y = CHART_TOP + idx * (BAR_HEIGHT + BAR_GAP);
        const enrolledWidth = (p.enrolledMillions / maxMillions) * innerWidth;
        const totalWidth = (p.eligibleMillions / maxMillions) * innerWidth;
        const gapMillions = p.eligibleMillions - p.enrolledMillions;
        const gapPct = Math.round((gapMillions / p.eligibleMillions) * 100);
        const labelLines = wrapLabel(p.population, 28);
        // Vertically center multi-line labels around the bar midpoint.
        const labelStartY =
          y + BAR_HEIGHT / 2 - ((labelLines.length - 1) * 14) / 2;

        return (
          <g key={p.step}>
            {/* Population label — wraps to 2 lines for long names */}
            <text
              x={CHART_LEFT - 14}
              y={labelStartY}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink text-[12px] font-semibold"
            >
              {labelLines.map((line, i) => (
                <tspan key={i} x={CHART_LEFT - 14} dy={i === 0 ? 0 : 14}>
                  {line}
                </tspan>
              ))}
            </text>

            {/* Background = total eligible · diagonal-stripe pattern for "missing" feel */}
            <rect
              x={CHART_LEFT}
              y={y}
              width={totalWidth}
              height={BAR_HEIGHT}
              fill="url(#gap-stripes)"
              rx={2}
            >
              <title>
                {p.population}: {p.eligibleMillions.toFixed(1)}M eligible nationally
              </title>
            </rect>

            {/* Foreground = enrolled · solid teal */}
            <rect
              x={CHART_LEFT}
              y={y}
              width={enrolledWidth}
              height={BAR_HEIGHT}
              fill={ENROLLED_COLOR}
              rx={2}
            >
              <title>
                {p.population}: {p.enrolledMillions.toFixed(1)}M enrolled of {p.eligibleMillions.toFixed(1)}M eligible
              </title>
            </rect>

            {/* Right-side stacked numbers — consistent on every row */}
            <text
              x={CHART_LEFT + totalWidth + 10}
              y={y + BAR_HEIGHT / 2 - 8}
              dominantBaseline="middle"
              className="fill-[#9A5A14] text-[15px] font-bold tabular-nums"
            >
              {gapMillions.toFixed(1)}M gap
            </text>
            <text
              x={CHART_LEFT + totalWidth + 10}
              y={y + BAR_HEIGHT / 2 + 8}
              dominantBaseline="middle"
              className="fill-muted text-[10px] tabular-nums"
            >
              {gapPct}% · {p.enrolledMillions.toFixed(1)}M enrolled
            </text>
          </g>
        );
      })}

      {/* Legend at bottom */}
      <g transform={`translate(${CHART_LEFT}, ${chartHeight - 8})`}>
        <rect width={14} height={10} fill={ENROLLED_COLOR} rx={1} />
        <text x={20} y={9} className="fill-graphite text-[10px]">
          Enrolled today
        </text>
        <rect x={132} width={14} height={10} fill="url(#gap-stripes)" rx={1} />
        <text x={152} y={9} className="fill-graphite text-[10px]">
          Eligible but not enrolled
        </text>
        <text
          x={innerWidth - 20}
          y={9}
          textAnchor="end"
          className="fill-muted text-[10px] font-mono"
        >
          millions of US households
        </text>
      </g>
    </svg>
  );
}

function UnderEnrolledSection({
  populations,
}: {
  populations: UnderEnrolledPopulation[];
}) {
  // Sort by gap descending so the biggest opportunity leads the eye.
  const sorted = [...populations].sort(
    (a, b) =>
      b.eligibleMillions - b.enrolledMillions -
      (a.eligibleMillions - a.enrolledMillions),
  );
  const maxMillions = Math.max(...sorted.map((p) => p.eligibleMillions));
  // Round up to nearest 2M tick for clean axis.
  const axisMax = Math.ceil(maxMillions / 2) * 2;

  // Roll-up hero figures — total eligible vs total enrolled across populations.
  // Note: populations overlap (a working student may also be working low-wage),
  // so the sum is illustrative, not strictly additive. The footnote in the
  // hero block flags this honestly.
  const totalEligible = sorted.reduce((s, p) => s + p.eligibleMillions, 0);
  const totalEnrolled = sorted.reduce((s, p) => s + p.enrolledMillions, 0);
  const totalGap = totalEligible - totalEnrolled;
  const totalGapPct = Math.round((totalGap / totalEligible) * 100);

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-1">
          Section D · applying the rules
        </p>
        <h4 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
          Greenfield distribution targets — underenrolled populations where impact gets demonstrated
        </h4>
        <p className="text-[13px] text-graphite mt-1 leading-snug max-w-2xl">
          Each bar is an addressable market. The amber gap is households that
          qualify under the rules above but haven&apos;t enrolled — the raw
          material for demonstrating enrollment impact at scale. Populations
          with an identified partner channel show the distribution math in
          the card.
        </p>
      </div>

      {/* Hero — total expected un-enrolled across all populations */}
      <div className="bg-paper border-l-4 border-[#9A5A14] rounded-r-[3px] px-5 py-4 mb-5 grid grid-cols-1 md:grid-cols-[auto_auto_1fr] gap-x-8 gap-y-2 items-baseline">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#9A5A14]">
            Total expected un-enrolled
          </p>
          <p className="text-[32px] font-bold text-[#9A5A14] tabular-nums leading-none mt-1">
            ~{totalGap.toFixed(1)}M
          </p>
          <p className="text-[10px] text-graphite mt-0.5">US households</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted">
            Share of combined eligible
          </p>
          <p className="text-[32px] font-bold text-ink tabular-nums leading-none mt-1">
            ~{totalGapPct}%
          </p>
          <p className="text-[10px] text-graphite mt-0.5">
            of {totalEligible.toFixed(0)}M eligible
          </p>
        </div>
        <p className="text-[12px] text-graphite leading-snug md:max-w-md md:justify-self-end italic">
          Populations overlap (a working student may also be a working low-wage
          household), so the sum is illustrative rather than strictly additive
          — the magnitude is the point. Where a distribution channel exists, it
          is shown in the expand drawer.
        </p>
      </div>

      <div className="w-full overflow-x-auto">
        <UnderEnrolledChart populations={sorted} maxMillions={axisMax} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
        {sorted.map((p) => {
          const gapMillions = p.eligibleMillions - p.enrolledMillions;
          return (
            <details
              key={p.step}
              className="group border border-hairline rounded-[4px] p-4 bg-paper open:bg-surface transition-colors"
            >
              <summary className="cursor-pointer list-none flex items-start gap-3">
                <div className="shrink-0">
                  <p className="text-[32px] font-bold text-[#9A5A14] tabular-nums leading-none">
                    {gapMillions.toFixed(1)}M
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">
                    gap
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink leading-snug">
                    {p.population}
                  </p>
                  <p className="text-[12px] text-graphite mt-1 leading-snug">
                    {p.headlineCue}
                  </p>
                  <p className="text-[10px] text-muted mt-1.5 group-open:hidden">
                    tap for rule anchor + sources →
                  </p>
                </div>
              </summary>

              <div className="mt-4 pt-3 border-t border-hairline/60 space-y-2.5">
                <p className="text-[13px] text-graphite leading-relaxed">
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mr-2">
                    Why they qualify
                  </span>
                  {p.qualifiesBecause}
                </p>
                <p className="text-[13px] text-graphite leading-relaxed">
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mr-2">
                    Why they don&apos;t apply
                  </span>
                  {p.whyTheyDontApply}
                </p>
                {p.distributionChannel && (
                  <p className="text-[12px] leading-relaxed px-3 py-2 rounded-[3px]" style={{ background: "rgba(201,146,42,0.07)", color: "#7A5010" }}>
                    <span className="text-[9px] uppercase tracking-[0.14em] font-semibold mr-2" style={{ color: "#C9922A" }}>
                      Distribution channel
                    </span>
                    {p.distributionChannel}
                  </p>
                )}
                <p className="font-mono text-[10px] tracking-wide text-muted leading-snug pt-1">
                  <span className="text-graphite font-semibold uppercase">rule anchor</span>
                  <span className="mx-2">·</span>
                  {p.ruleAnchors.join(" + ")}
                  <span className="mx-2 text-muted/50">·</span>
                  <span className="text-graphite font-semibold uppercase">source</span>
                  <span className="mx-2">·</span>
                  <span className="break-all">{p.sources.join(" · ")}</span>
                </p>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

export default function RulesFrameworkPanel({
  gates,
  calcSteps,
  caOverlays,
  underEnrolled,
  summary,
}: {
  gates: FrameworkItem[];
  calcSteps: FrameworkItem[];
  caOverlays: FrameworkItem[];
  underEnrolled: UnderEnrolledPopulation[];
  summary: {
    gates: number;
    calcSteps: number;
    caOverlays: number;
    underEnrolled: number;
    fiscalYear: string;
  };
}) {
  return (
    <section
      aria-labelledby="rules-framework-title"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7"
    >
      <div className="flex items-start justify-between gap-6 mb-7 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">Pillar 1 · how SNAP works, and where Civica fits</p>
          <h3
            id="rules-framework-title"
            className="text-[20px] font-semibold tracking-tight text-ink leading-tight"
          >
            The rules behind every SNAP estimate Civica produces
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            SNAP is a federal program. Congress and USDA set the rules; state
            agencies — in California, CDSS / CalFresh — decide who actually
            receives benefits. Civica's job is the work in the middle: producing
            a defensible estimate and a ready-to-submit packet. Sections A and
            B walk through the federal baseline; Section C lists what California
            changes on top; Section D applies the rules to name who they
            <span className="italic"> should </span>
            reach but don&apos;t.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-pine-surface text-pine">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {summary.gates} gates · {summary.calcSteps} calc steps · {summary.caOverlays} CA overlays · {summary.underEnrolled} under-enrolled · {summary.fiscalYear}
          </span>
          <p className="text-[11px] text-muted font-mono tracking-wide mt-1.5">
            source: packages/snap-calculator + packages/snap-rules
          </p>
        </div>
      </div>

      <div className="space-y-7">
        <Subsection
          eyebrow="Section A · federal baseline"
          title="Who can apply"
          lede="Five gates decide whether a household can receive SNAP at all. These apply in every state."
          items={gates}
        />

        <Subsection
          eyebrow="Section B · federal baseline"
          title="How the benefit is calculated"
          lede="Once a household passes the gates above, seven steps turn that household's income and expenses into a monthly food benefit. The formula is the same in every state — Civica's engine runs it; the state agency confirms the final number."
          items={calcSteps}
          prelude={<BenefitFormulaCard />}
        />

        <CaliforniaOverlaysMap overlays={caOverlays} />

        <UnderEnrolledSection populations={underEnrolled} />
      </div>

      <p className="text-[12px] text-graphite leading-relaxed mt-7 pt-4 border-t border-hairline/50">
        Every step here runs the same way every time, in code that's unit-tested in <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5">packages/snap-calculator</code>.
        Eligibility gates that depend on intake answers route through <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5">packages/snap-rules</code>.
        As Civica supports more states, their overlays slot into Section C in the same shape. Civica produces the estimate; the state agency makes the call.
      </p>
    </section>
  );
}
