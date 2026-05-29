/**
 * CoverageMapPanel — pillar 3 of /compliance.
 *
 * Sankey-shaped problem-definition panel: three stages flowing left to right
 * — who applies, where the error enters, how it lands. The diagram is
 * intentionally Civica-absent. Pillar 5 is where Civica's cohort tracks
 * against this baseline.
 *
 * Charting approach: d3-sankey for layout, raw SVG for rendering. No chart
 * library. Tooltips are native SVG <title> elements.
 *
 * NOTE: file kept as CoverageMapPanel.tsx so app/compliance/page.tsx does
 * not need to change. The "coverage map" naming is a historical artifact.
 */

import {
  sankey as sankeyGenerator,
  sankeyLinkHorizontal,
  type SankeyNode as D3SankeyNode,
  type SankeyLink as D3SankeyLink,
} from "d3-sankey";
import {
  sankeyNodes,
  sankeyLinks,
  provenanceTiles,
  HEADLINE_TAKEAWAY,
  type SankeyNodeData,
  type SankeyLinkData,
  type StageKind,
  type SourceKind,
} from "../../lib/analytics/audit-simulation";

type LaidOutNode = D3SankeyNode<SankeyNodeData, SankeyLinkData>;
type LaidOutLink = D3SankeyLink<SankeyNodeData, SankeyLinkData>;

// ---------------------------------------------------------------------------
// Visual constants — widened canvas, label gutters sized to fit Stage 2
// node labels inline + Stage 1/3 labels in their own columns.
// ---------------------------------------------------------------------------
const WIDTH = 1100;
const HEIGHT = 520;
// Tighter label gutters — Stage 1/3 labels live in ~170px columns instead of
// 260, giving the diagram the extra horizontal stretch.
const MARGIN = { top: 36, right: 170, bottom: 24, left: 170 };
const NODE_WIDTH = 14;
const NODE_PADDING = 30;

// Color palette — push contrast between dominant and tail so the eye lands
// on the heaviest band first.
const HOT_COLOR   = "#5C1F11"; // deep brick — dominant flow
const WARM_COLOR  = "#C0411F"; // hot orange — heavy
const MID_COLOR   = "#C68E3A"; // warm gold — moderate
const COOL_COLOR  = "#8E8579"; // medium gray — tail

function colorForLinkValue(value: number, maxValue: number): string {
  const t = maxValue > 0 ? value / maxValue : 0;
  if (t > 0.80) return HOT_COLOR;
  if (t > 0.45) return WARM_COLOR;
  if (t > 0.18) return MID_COLOR;
  return COOL_COLOR;
}

function nodeColorForStage(stage: StageKind): string {
  switch (stage) {
    case "intake":  return "var(--color-amber)";
    case "error":   return "#5C1F11";
    case "outcome": return "#1A1714";
  }
}

// $13B total SNAP error volume nationally (FY2023). Each link's value is a
// percentage of that — multiply to get the dollar amount on the path.
const TOTAL_ERROR_B = 13;

function fmtDollar(pct: number): string {
  const bns = (pct / 100) * TOTAL_ERROR_B;
  if (bns >= 1) return `$${bns.toFixed(1)}B / yr`;
  return `$${Math.round(bns * 1000)}M / yr`;
}

const SOURCE_LABEL: Record<SourceKind, string> = {
  calibrated: "calibrated from microdata",
  published:  "published federal figure",
  estimate:   "estimate (FOIA refinement pending)",
};

// Stage column x-centers — used to align the stage labels above the diagram.
// Stage 1 nodes sit at x=MARGIN.left, Stage 3 at x=WIDTH-MARGIN.right-NODE_WIDTH,
// Stage 2 in the middle. d3-sankey computes these but we mirror the math for
// label positioning.
const STAGE_CENTERS = {
  intake:  MARGIN.left + NODE_WIDTH / 2,
  error:   WIDTH / 2,
  outcome: WIDTH - MARGIN.right - NODE_WIDTH / 2,
};

// Helper to wrap caption text to N chars max per line.
function wrapText(text: string, maxChars: number): string[] {
  return text.split(" ").reduce<string[]>((acc, word) => {
    const last = acc[acc.length - 1] ?? "";
    if (!last) return [word];
    if ((last + " " + word).length > maxChars) return [...acc, word];
    acc[acc.length - 1] = last + " " + word;
    return acc;
  }, []);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CoverageMapPanel() {
  const tiles = provenanceTiles();

  const nodeData = sankeyNodes().map((n) => ({ ...n }));
  const linkData = sankeyLinks().map((l) => ({ ...l }));

  const layout = sankeyGenerator<SankeyNodeData, SankeyLinkData>()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PADDING)
    .extent([
      [MARGIN.left, MARGIN.top],
      [WIDTH - MARGIN.right, HEIGHT - MARGIN.bottom],
    ])
    .nodeId((d) => (d as unknown as SankeyNodeData).id);

  const result = layout({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodes: nodeData as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    links: linkData as any,
  });

  const laidOutNodes = result.nodes as LaidOutNode[];
  const laidOutLinks = result.links as LaidOutLink[];

  const maxLinkValue = Math.max(...laidOutLinks.map((l) => l.value ?? 0));
  const linkPath = sankeyLinkHorizontal<SankeyNodeData, SankeyLinkData>();

  return (
    <section
      aria-labelledby="audit-simulation-title"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7"
    >
      {/* Header */}
      <div className="mb-5">
        <p className="eyebrow mb-1.5">Part 3 · the $13B leak · where the money actually goes wrong</p>
        <h3
          id="audit-simulation-title"
          className="text-[22px] font-semibold tracking-tight text-ink leading-tight"
        >
          Where the $13B in SNAP errors actually comes from
        </h3>
        <p className="text-[13px] text-graphite mt-2 max-w-3xl leading-relaxed">
          The US issues about
          <span className="font-semibold text-ink"> $112B </span> in SNAP
          benefits each year. Roughly
          <span className="font-semibold text-ink"> $13B</span> of that gets
          flagged as errored — paid wrong, paid late, or denied to someone
          who actually qualified. The funnel sizes the volume; the Sankey
          below traces those dollars back to which households and which
          mistakes drive each loss path. Every leak the Sankey names is
          a leak Pillar 4 closes downstream.
        </p>
      </div>

      {/* Funnel — dollar volume cascade. Sized to match the OBBBA penalty
          framing above: $13B errored payments are the loss landscape the
          law's §10105 / §10106 thresholds charge against. */}
      <div className="border border-hairline rounded-[4px] bg-paper p-5 mb-7">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-4">
          The volume · what gets paid · what goes wrong
        </p>

        {/* Layer 1 — top-line stats */}
        <div className="grid grid-cols-3 gap-6 mb-6 pb-5 border-b border-hairline">
          <div>
            <p className="text-[32px] font-bold text-ink tabular-nums leading-none">
              $112B
            </p>
            <p className="text-[11px] text-graphite mt-1.5 leading-snug">
              issued nationally in SNAP benefits · FY2023
            </p>
          </div>
          <div>
            <p className="text-[32px] font-bold text-ink tabular-nums leading-none">
              41M
            </p>
            <p className="text-[11px] text-graphite mt-1.5 leading-snug">
              US households on SNAP at any point in the year
            </p>
          </div>
          <div>
            <p className="text-[32px] font-bold text-[#5C1F11] tabular-nums leading-none">
              $13B
            </p>
            <p className="text-[11px] text-graphite mt-1.5 leading-snug">
              flagged as errored · ≈12% payment error rate
            </p>
          </div>
        </div>

        {/* Layer 2 — issuance / errored stacked bar */}
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-2">
            Out of every $1 of SNAP issued nationally
          </p>
          <div className="flex h-9 rounded-sm overflow-hidden border border-hairline">
            <div
              className="flex items-center justify-end pr-3"
              style={{
                width: "88%",
                background: "rgba(201,146,42,0.18)",
                color: "var(--color-amber)",
              }}
            >
              <span className="text-[12px] font-semibold tabular-nums">
                $99B correctly paid (88¢)
              </span>
            </div>
            <div
              className="flex items-center justify-center text-white"
              style={{ width: "12%", background: "#5C1F11" }}
            >
              <span className="text-[12px] font-semibold tabular-nums whitespace-nowrap">
                $13B errored (12¢)
              </span>
            </div>
          </div>
        </div>

        {/* Layer 3 — how the $13B in errored dollars actually lands */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-3">
            How the $13B errored dollars land · these are the four flows the Sankey explains
          </p>
          <div className="space-y-2.5">
            {[
              {
                label: "Overpayment",
                detail: "households paid more than the rules allow — often clawed back later",
                pct: 55,
                dollars: "$7.2B",
                color: "#5C1F11",
              },
              {
                label: "Procedural denial",
                detail: "qualifying household denied for a missed interview or missing paperwork",
                pct: 25,
                dollars: "$3.3B",
                color: "#C0411F",
                note: "benefits lost to households who should have received them",
              },
              {
                label: "Underpayment",
                detail: "household paid less than the rules allow — usually unnoticed",
                pct: 15,
                dollars: "$2.0B",
                color: "#C68E3A",
              },
              {
                label: "Eligibility denial",
                detail: "household denied because they truly didn't meet the rules",
                pct: 5,
                dollars: "$0.5B",
                color: "#8E8579",
              },
            ].map((row) => (
              <div key={row.label} className="grid grid-cols-[160px_1fr_90px] gap-3 items-center">
                <div>
                  <p className="text-[13px] font-semibold text-ink leading-tight">
                    {row.label}
                  </p>
                  <p className="text-[10px] text-muted leading-snug mt-0.5">
                    {row.note ?? row.detail}
                  </p>
                </div>
                <div className="h-6 rounded-sm overflow-hidden bg-hairline/30">
                  <div
                    className="h-full flex items-center px-2"
                    style={{ width: `${row.pct}%`, background: row.color }}
                  >
                    <span className="text-[10px] font-semibold text-white tabular-nums">
                      {row.pct}%
                    </span>
                  </div>
                </div>
                <p className="text-[15px] font-bold text-ink tabular-nums text-right">
                  {row.dollars}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted leading-snug mt-3 italic">
            Figures are FY2023 USDA FNS aggregates · errored-dollar breakdown
            uses national QC outcome shares applied to the $13B total.
          </p>
        </div>
      </div>

      {/* Glossary — what each error category actually means in plain English.
          Anchors the Stage 2 node labels in the Sankey below. */}
      <div className="mb-7">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-2">
          What each error category actually means
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              tag: "Utility / shelter",
              share: "~50%",
              meaning:
                "The household answered wrong about rent, mortgage, or which utilities they pay — usually claiming a higher shelter cost than they actually have, or qualifying for a richer utility allowance tier than they should.",
            },
            {
              tag: "Earned / gig income",
              share: "~27%",
              meaning:
                "A paycheck, gig payment, or self-employment income wasn't reported accurately — often cash income or DoorDash / Uber / Instacart earnings that the applicant didn't realize had to be disclosed.",
            },
            {
              tag: "Shared lease / housing",
              share: "~11%",
              meaning:
                "The household answered wrong about who they live with — a sublease was treated as a primary tenancy, or a roommate was counted as a household member when they shouldn't have been.",
            },
            {
              tag: "Asset / resource",
              share: "~8%",
              meaning:
                "A bank account, vehicle, or asset wasn't disclosed — usually a second car, a retirement account that should have been excluded but was double-counted, or savings the applicant forgot to mention.",
            },
            {
              tag: "Categorical or other",
              share: "~3%",
              meaning:
                "Wrong routing into the fast-track pathway (TANF / SSI categorical eligibility), or a miscellaneous error that doesn't fit the four big categories above.",
            },
          ].map((g) => (
            <div key={g.tag} className="border border-hairline rounded-[4px] p-3 bg-surface">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <p className="text-[12px] font-semibold text-ink leading-snug">
                  {g.tag}
                </p>
                <p className="text-[11px] text-[#5C1F11] font-bold tabular-nums">
                  {g.share}
                </p>
              </div>
              <p className="text-[11px] text-graphite leading-snug">{g.meaning}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Provenance strip — data abundance as the header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7 pb-5 border-b border-hairline">
        {tiles.map((t) => (
          <div key={t.label} className="border-l-2 border-amber/40 pl-3">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted">
              {t.label}
            </p>
            <p className="text-[14px] font-semibold text-ink leading-snug mt-0.5">
              {t.value}
            </p>
            {t.caption && (
              <p className="text-[11px] text-graphite leading-snug mt-0.5">
                {t.caption}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Sankey */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto block"
          role="img"
          aria-labelledby="audit-simulation-title"
        >
          {/* Stage labels — anchored to each stage's node column x-center */}
          <text
            x={STAGE_CENTERS.intake}
            y={18}
            textAnchor="middle"
            className="fill-muted text-[11px] font-semibold tracking-[0.10em] uppercase"
          >
            Stage 1 · who applies
          </text>
          <text
            x={STAGE_CENTERS.error}
            y={18}
            textAnchor="middle"
            className="fill-muted text-[11px] font-semibold tracking-[0.10em] uppercase"
          >
            Stage 2 · where the error enters
          </text>
          <text
            x={STAGE_CENTERS.outcome}
            y={18}
            textAnchor="middle"
            className="fill-muted text-[11px] font-semibold tracking-[0.10em] uppercase"
          >
            Stage 3 · how it lands
          </text>

          {/* Links + percent labels — each band is one <g class="group">
              so hovering the band reveals its percent label (and only its
              label, not every other band's). Tailwind's group / group-hover
              works on SVG. */}
          {laidOutLinks.map((link, i) => {
            const d = linkPath(link) ?? "";
            const value = link.value ?? 0;
            const stroke = colorForLinkValue(value, maxLinkValue);
            const linkRaw = link as unknown as SankeyLinkData;
            const sourceNode = link.source as LaidOutNode;
            const targetNode = link.target as LaidOutNode;
            const sourceLabel = sourceNode.label;
            const targetLabel = targetNode.label;
            const valueTxt = value.toFixed(1);
            const midX = ((sourceNode.x1 ?? 0) + (targetNode.x0 ?? 0)) / 2;
            const midY =
              (((sourceNode.y0 ?? 0) + (sourceNode.y1 ?? 0)) / 2 +
                ((targetNode.y0 ?? 0) + (targetNode.y1 ?? 0)) / 2) /
              2;
            const label = value >= 10 ? `${value.toFixed(0)}%` : `${value.toFixed(1)}%`;
            const plateW = label.length * 7 + 8;
            return (
              <g key={i} className="group">
                <path
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeOpacity={0.55}
                  strokeWidth={Math.max(1, link.width ?? 1)}
                  className="group-hover:[stroke-opacity:0.85] transition-all"
                  aria-label={`${sourceLabel} → ${targetLabel}: ${valueTxt}% of all errored cases · ${SOURCE_LABEL[linkRaw.sourceKind]}`}
                />

                {/* Hover tooltip — percent + dollar amount */}
                {(() => {
                  const dollarStr = fmtDollar(value);
                  const pW = Math.max(label.length * 8, dollarStr.length * 6.8) + 18;
                  return (
                    <g
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                      style={{ pointerEvents: "none" }}
                    >
                      <rect
                        x={midX - pW / 2}
                        y={midY - 16}
                        width={pW}
                        height={32}
                        fill="rgba(248,245,239,0.97)"
                        stroke="rgba(0,0,0,0.16)"
                        strokeWidth={0.75}
                        rx={3}
                      />
                      {/* percent */}
                      <text
                        x={midX}
                        y={midY - 3}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight={700}
                        fill="#1A1714"
                        fontFamily="monospace"
                      >
                        {label}
                      </text>
                      {/* dollar */}
                      <text
                        x={midX}
                        y={midY + 11}
                        textAnchor="middle"
                        fontSize={9.5}
                        fill="#5A544D"
                        fontFamily="monospace"
                      >
                        {dollarStr}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* Nodes + labels */}
          <g>
            {laidOutNodes.map((node) => {
              const x0 = node.x0 ?? 0;
              const y0 = node.y0 ?? 0;
              const y1 = node.y1 ?? 0;
              const h = y1 - y0;
              const data = node as unknown as SankeyNodeData;
              const fill = nodeColorForStage(data.stage);

              // Label placement by stage:
              //   - intake (Stage 1) → label gutter to the LEFT of node bar
              //   - outcome (Stage 3) → label gutter to the RIGHT of node bar
              //   - error (Stage 2) → label ABOVE the node bar with white plate
              //     behind it so it doesn't drown in the incoming band colors
              const isStage2 = data.stage === "error";
              const isLeftSide = data.stage === "intake";

              // Only render caption text when the band is tall enough — SVG text
              // doesn't clip to parent bounds, so short bands overflow visually.
              const MIN_CAPTION_H = 32;
              const captionLines = (data.caption && h >= MIN_CAPTION_H) ? wrapText(data.caption, 32) : [];

              if (isStage2) {
                // Stage 2: label sits above the top of the node bar with a
                // semi-opaque white plate to lift it off the incoming bands.
                const labelText = data.label;
                const labelWidth = Math.max(labelText.length * 6.5, 140);
                const plateX = x0 - labelWidth / 2 + NODE_WIDTH / 2;
                const plateY = y0 - 18;
                return (
                  <g key={data.id}>
                    <rect
                      x={x0}
                      y={y0}
                      width={NODE_WIDTH}
                      height={h}
                      fill={fill}
                      stroke="#F8F5EF"
                      strokeWidth={1.5}
                      aria-label={data.caption ? `${data.label}: ${data.caption}` : data.label}
                    />
                    {/* Background plate */}
                    <rect
                      x={plateX}
                      y={plateY}
                      width={labelWidth}
                      height={16}
                      fill="rgba(248,245,239,0.92)"
                      stroke="rgba(0,0,0,0.06)"
                      strokeWidth={0.5}
                      rx={2}
                    />
                    <text
                      x={x0 + NODE_WIDTH / 2}
                      y={plateY + 11}
                      textAnchor="middle"
                      className="fill-ink text-[11px] font-semibold"
                    >
                      {labelText}
                    </text>
                  </g>
                );
              }

              // Stage 1 / Stage 3: inline label, anchored to the label gutter.
              const labelX = isLeftSide ? x0 - 12 : x0 + NODE_WIDTH + 12;
              const labelAnchor = isLeftSide ? "end" : "start";
              return (
                <g key={data.id}>
                  <rect
                    x={x0}
                    y={y0}
                    width={NODE_WIDTH}
                    height={h}
                    fill={fill}
                    aria-label={data.caption ? `${data.label}: ${data.caption}` : data.label}
                  />
                  <text
                    x={labelX}
                    y={y0 + h / 2 - (captionLines.length > 0 ? 8 : 0)}
                    textAnchor={labelAnchor}
                    dominantBaseline="middle"
                    className="fill-ink text-[13px] font-semibold"
                  >
                    {data.label}
                  </text>
                  {captionLines.slice(0, 3).map((line, idx) => (
                    <text
                      key={idx}
                      x={labelX}
                      y={y0 + h / 2 + 8 + idx * 12}
                      textAnchor={labelAnchor}
                      dominantBaseline="middle"
                      className="fill-muted text-[10px]"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            })}
          </g>

        </svg>
      </div>

      {/* Headline takeaway — its own row below the chart so it never clips */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-start bg-paper border-l-4 border-[#5C1F11] pl-4 pr-4 py-3 rounded-r-[3px]">
        <div className="md:min-w-[140px]">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#5C1F11]">
            Dominant flow
          </p>
          <p className="text-[32px] font-bold text-[#5C1F11] tabular-nums leading-none mt-0.5">
            ~{HEADLINE_TAKEAWAY.shareOfErrorVolume}%
          </p>
          <p className="text-[10px] text-graphite mt-0.5">of all errored cases</p>
        </div>
        <p className="text-[14px] text-ink leading-relaxed">
          {HEADLINE_TAKEAWAY.text}
        </p>
      </div>

      {/* Legend — pulled tight to the chart, no separator rule above */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-muted">
        <span className="text-graphite font-semibold uppercase tracking-wider text-[10px]">
          band color
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm" style={{ background: HOT_COLOR }} />
          dominant
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm" style={{ background: WARM_COLOR }} />
          heavy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm" style={{ background: MID_COLOR }} />
          moderate
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm" style={{ background: COOL_COLOR }} />
          tail
        </span>
        <span className="text-muted/50 mx-2">·</span>
        <span className="text-graphite font-semibold uppercase tracking-wider text-[10px]">
          band width
        </span>
        <span>share of all national errored cases</span>
      </div>

      {/* Footer transition to pillar 5 */}
      <p className="text-[12px] text-graphite leading-relaxed mt-5 pt-4 border-t border-hairline/50">
        This panel is the diagnostic — the SNAP system as it runs today, with
        no Civica intervention assumed. The Sankey is calibrated from{" "}
        <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5">
          packages/snap-qc-engine
        </code>{" "}
        ERROR_WEIGHT against CA FY2024&apos;s 10.98% PER baseline; the demographic
        layer uses the published USDA FNS caseload distribution; the outcome
        split combines federal QC overpayment / underpayment reporting with
        CDSS denial-reason estimates pending FOIA refinement. Pillar 5 below
        tracks how Civica&apos;s enrolled cohort sits against these flows.
      </p>
    </section>
  );
}
