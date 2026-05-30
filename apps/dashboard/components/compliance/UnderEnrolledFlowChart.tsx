// ---------------------------------------------------------------------------
// UnderEnrolledFlowChart — three-stage Sankey for Section D of Pillar 1.
//
//   Stage 1: Population (eligible US households)
//   Stage 2: Barrier (why they don't enroll)
//   Stage 3: Civica wedge (channel-addressable / product-addressable / enrolled)
//
// Companion to UnderEnrolledChart (the horizontal bar). The bar shows "size
// of gap by population." This Sankey shows "shape of gap by barrier ×
// Civica wedge" — the diagnostic that justifies the duty-of-care primary
// wedge and the platform thesis (one engine, two universal barriers,
// addressed per cohort by a channel partner or by Civica's verification
// stack + recert companion).
//
// HONESTY: figures are MODELED · PRE-PILOT. Population sizes use the same
// USDA FNS gap data as the bar chart; barrier-share per population is
// modeled from the qualifying-rules anchor + existing benefits-navigation
// literature. The chip in the header says so explicitly. Numbers replace
// with measured cohort data once the first 10 households close.
//
// Conservation: band widths are millions of US households. Total flow =
// 35.5M eligible (= 19.5M enrolled + 9.94M channel-addressable +
// 6.06M product-addressable = 35.5M).
// ---------------------------------------------------------------------------
import {
  sankey as sankeyGenerator,
  sankeyLinkHorizontal,
  type SankeyNode as D3SankeyNode,
  type SankeyLink as D3SankeyLink,
} from "d3-sankey";

type Stage = "population" | "barrier" | "position";

interface NodeData {
  id: string;
  label: string;
  stage: Stage;
  /** Small caption rendered below the label when the band is tall enough. */
  caption?: string;
}

interface LinkData {
  source: string;
  target: string;
  /** Millions of US households. */
  value: number;
}

type LaidOutNode = D3SankeyNode<NodeData, LinkData>;
type LaidOutLink = D3SankeyLink<NodeData, LinkData>;

// ── SVG geometry ────────────────────────────────────────────────────────────
// Width/margins tuned so the chart fills the Pillar 1 panel horizontally.
// Inner flow space = WIDTH - left - right = 1280 - 180 - 220 = 880px,
// up from 520px in the v1 layout.
const WIDTH = 1280;
const HEIGHT = 460;
const MARGIN = { top: 38, right: 220, bottom: 28, left: 180 };
const NODE_WIDTH = 12;
const NODE_PADDING = 18;

// ── Color palette ───────────────────────────────────────────────────────────
// Reused page tokens. Brick = channel-addressable (matches OBBBA hero +
// 60+ cohort tag). Teal = product-addressable (matches Pillar 5 wins token).
// Amber = populations (matches the gap-amber across Section D). Graphite =
// already enrolled (neutral).
const COLOR_POP = "var(--color-amber)";
const COLOR_CHANNEL = "#5C1F11";
const COLOR_PRODUCT = "#2A6F66";
const COLOR_ENROLLED = "#8E8579";

const BARRIER_COLOR: Record<string, string> = {
  "bar-belief":    COLOR_CHANNEL,
  "bar-awareness": COLOR_CHANNEL,
  "bar-form":      COLOR_PRODUCT,
  "bar-process":   COLOR_PRODUCT,
  "bar-none":      COLOR_ENROLLED,
};

const POSITION_COLOR: Record<string, string> = {
  "pos-channel":  COLOR_CHANNEL,
  "pos-product":  COLOR_PRODUCT,
  "pos-enrolled": COLOR_ENROLLED,
};

function nodeColor(node: NodeData): string {
  if (node.stage === "population") return COLOR_POP;
  if (node.stage === "barrier") return BARRIER_COLOR[node.id] ?? COLOR_ENROLLED;
  return POSITION_COLOR[node.id] ?? COLOR_ENROLLED;
}

// Link color: tinted by the Civica position the flow eventually lands in.
// Pop → Barrier links borrow the barrier's downstream-position color so
// the eye groups them by wedge from Stage 1, not just at Stage 3.
function linkColor(link: LaidOutLink): string {
  const target = link.target as LaidOutNode;
  const targetData = target as unknown as NodeData;
  if (targetData.stage === "position") {
    return POSITION_COLOR[targetData.id] ?? COLOR_ENROLLED;
  }
  return BARRIER_COLOR[targetData.id] ?? COLOR_ENROLLED;
}

// ── Data ────────────────────────────────────────────────────────────────────
const NODES: NodeData[] = [
  // Stage 1 — populations (matches Section D cards)
  // Volume + percent render in the stat line below the label; captions only
  // carry non-numeric annotation (e.g. "primary wedge").
  { id: "pop-elderly",   label: "Elderly 60+",              stage: "population", caption: "primary wedge" },
  { id: "pop-gig",       label: "Working low-wage & gig",   stage: "population" },
  { id: "pop-students",  label: "Working students",         stage: "population" },
  { id: "pop-homecare",  label: "Home care & seasonal ag",  stage: "population" },

  // Stage 2 — barriers (5 categories)
  { id: "bar-belief",    label: "Belief / stigma",          stage: "barrier" },
  { id: "bar-awareness", label: "No-awareness",             stage: "barrier" },
  { id: "bar-form",      label: "Form complexity",          stage: "barrier" },
  { id: "bar-process",   label: "Process friction",         stage: "barrier" },
  { id: "bar-none",      label: "No barrier · enrolled",    stage: "barrier" },

  // Stage 3 — Civica wedge (3 positions)
  { id: "pos-channel",   label: "Channel-addressable",      stage: "position", caption: "Civica + partner solves" },
  { id: "pos-product",   label: "Product-addressable",      stage: "position", caption: "Civica engine solves" },
  { id: "pos-enrolled",  label: "Already enrolled",         stage: "position", caption: "no Civica needed" },
];

// All values in millions of US households.
// Per-population gap allocations modeled from qualifying-rules anchor +
// benefits-navigation literature on which barrier dominates each cohort.
const LINKS: LinkData[] = [
  // Elderly 60+ · 14M (5.9 enrolled + 8.1 gap)
  { source: "pop-elderly",  target: "bar-none",      value: 5.9  },
  { source: "pop-elderly",  target: "bar-belief",    value: 4.05 },
  { source: "pop-elderly",  target: "bar-awareness", value: 1.6  },
  { source: "pop-elderly",  target: "bar-form",      value: 1.6  },
  { source: "pop-elderly",  target: "bar-process",   value: 0.85 },
  // Working low-wage & gig · 14M (11 enrolled + 3 gap)
  { source: "pop-gig",      target: "bar-none",      value: 11.0 },
  { source: "pop-gig",      target: "bar-form",      value: 1.2  },
  { source: "pop-gig",      target: "bar-belief",    value: 0.9  },
  { source: "pop-gig",      target: "bar-process",   value: 0.6  },
  { source: "pop-gig",      target: "bar-awareness", value: 0.3  },
  // Working students · 3.5M (1.2 enrolled + 2.3 gap)
  { source: "pop-students", target: "bar-none",      value: 1.2  },
  { source: "pop-students", target: "bar-awareness", value: 0.8  },
  { source: "pop-students", target: "bar-form",      value: 0.7  },
  { source: "pop-students", target: "bar-belief",    value: 0.6  },
  { source: "pop-students", target: "bar-process",   value: 0.2  },
  // Home care & seasonal ag · 4M (1.4 enrolled + 2.6 gap)
  { source: "pop-homecare", target: "bar-none",      value: 1.4  },
  { source: "pop-homecare", target: "bar-awareness", value: 1.17 },
  { source: "pop-homecare", target: "bar-form",      value: 0.65 },
  { source: "pop-homecare", target: "bar-belief",    value: 0.52 },
  { source: "pop-homecare", target: "bar-process",   value: 0.26 },

  // Barrier → Civica wedge (each barrier maps to exactly one wedge by design)
  { source: "bar-belief",    target: "pos-channel",  value: 6.07 },
  { source: "bar-awareness", target: "pos-channel",  value: 3.87 },
  { source: "bar-form",      target: "pos-product",  value: 4.15 },
  { source: "bar-process",   target: "pos-product",  value: 1.91 },
  { source: "bar-none",      target: "pos-enrolled", value: 19.5 },
];

// ── Percent helpers ─────────────────────────────────────────────────────────
// Total = sum of all population outflow (35.5M). Each node's percent is
// computed against this so percents add to 100% within each stage.
const TOTAL_ELIGIBLE = LINKS
  .filter((l) => l.source.startsWith("pop-"))
  .reduce((s, l) => s + l.value, 0);

function nodeTotal(id: string): number {
  // Population nodes: sum of outflow. Barrier + position nodes: sum of inflow.
  if (id.startsWith("pop-")) {
    return LINKS.filter((l) => l.source === id).reduce((s, l) => s + l.value, 0);
  }
  return LINKS.filter((l) => l.target === id).reduce((s, l) => s + l.value, 0);
}

function pctOfTotal(value: number): string {
  return `${Math.round((value / TOTAL_ELIGIBLE) * 100)}%`;
}

function formatVolume(n: number): string {
  // Households in millions. 10M+ → integer, 1-10M → 1 decimal,
  // sub-1M → 2 decimals so small flows don't round to "0M".
  if (n >= 10) return `${Math.round(n)}M`;
  if (n >= 1) return `${n.toFixed(1)}M`;
  return `${n.toFixed(2)}M`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function wrapText(text: string, maxChars: number): string[] {
  return text.split(" ").reduce<string[]>((acc, word) => {
    const last = acc[acc.length - 1] ?? "";
    if (!last) return [word];
    if ((last + " " + word).length > maxChars) return [...acc, word];
    acc[acc.length - 1] = last + " " + word;
    return acc;
  }, []);
}

// Stage column centers — used for the stage-label strip above the diagram.
const STAGE_CENTERS = {
  population: MARGIN.left + NODE_WIDTH / 2,
  barrier: WIDTH / 2,
  position: WIDTH - MARGIN.right - NODE_WIDTH / 2,
};

// ── Component ───────────────────────────────────────────────────────────────
export default function UnderEnrolledFlowChart() {
  const nodeData = NODES.map((n) => ({ ...n }));
  const linkData = LINKS.map((l) => ({ ...l }));

  const layout = sankeyGenerator<NodeData, LinkData>()
    .nodeWidth(NODE_WIDTH)
    .nodePadding(NODE_PADDING)
    .extent([
      [MARGIN.left, MARGIN.top],
      [WIDTH - MARGIN.right, HEIGHT - MARGIN.bottom],
    ])
    .nodeId((d) => (d as unknown as NodeData).id);

  const result = layout({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodes: nodeData as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    links: linkData as any,
  });

  const laidOutNodes = result.nodes as LaidOutNode[];
  const laidOutLinks = result.links as LaidOutLink[];
  const linkPath = sankeyLinkHorizontal<NodeData, LinkData>();

  return (
    <div className="rounded-[4px] border border-hairline bg-paper p-5 mt-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-graphite mb-1">
            Flow view · where each population falls out
          </p>
          <h4 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
            Same 35.5M eligible · sliced by barrier and Civica wedge
          </h4>
          <p className="text-[12px] text-graphite mt-1.5 leading-snug max-w-3xl">
            Each population flows through its dominant barrier and into one of three Civica positions.
            {" "}
            <span className="font-semibold" style={{ color: COLOR_CHANNEL }}>Brick</span> lanes are
            <span className="font-semibold" style={{ color: COLOR_CHANNEL }}> channel-addressable</span> — Civica + a duty-of-care
            partner solves Belief and No-awareness.
            {" "}
            <span className="font-semibold" style={{ color: COLOR_PRODUCT }}>Teal</span> lanes are
            <span className="font-semibold" style={{ color: COLOR_PRODUCT }}> product-addressable</span> — the verification stack
            and recert companion solve Form complexity and Process friction. Gray = already enrolled today.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold shrink-0"
          style={{ background: "rgba(92,31,17,0.08)", color: COLOR_CHANNEL }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          modeled · pre-pilot
        </span>
      </div>

      {/* SVG diagram */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          style={{ display: "block", overflow: "visible", minWidth: 760 }}
          role="img"
          aria-label="Sankey flow from population through barrier to Civica wedge. Modeled, pre-pilot."
        >
          {/* Stage column headers */}
          <text
            x={STAGE_CENTERS.population}
            y={14}
            textAnchor="middle"
            className="fill-muted text-[9px] font-bold uppercase tracking-[0.14em]"
          >
            Stage 1 · Population
          </text>
          <text
            x={STAGE_CENTERS.barrier}
            y={14}
            textAnchor="middle"
            className="fill-muted text-[9px] font-bold uppercase tracking-[0.14em]"
          >
            Stage 2 · Barrier
          </text>
          <text
            x={STAGE_CENTERS.position}
            y={14}
            textAnchor="middle"
            className="fill-muted text-[9px] font-bold uppercase tracking-[0.14em]"
          >
            Stage 3 · Civica wedge
          </text>

          {/* Links — hover reveals volume in millions */}
          {laidOutLinks.map((link, i) => {
            const d = linkPath(link) ?? "";
            const value = link.value ?? 0;
            const stroke = linkColor(link);
            const sourceNode = link.source as LaidOutNode;
            const targetNode = link.target as LaidOutNode;
            const sourceLabel = (sourceNode as unknown as NodeData).label;
            const targetLabel = (targetNode as unknown as NodeData).label;
            const midX = ((sourceNode.x1 ?? 0) + (targetNode.x0 ?? 0)) / 2;
            const midY =
              (((sourceNode.y0 ?? 0) + (sourceNode.y1 ?? 0)) / 2 +
                ((targetNode.y0 ?? 0) + (targetNode.y1 ?? 0)) / 2) /
              2;
            const label = `${value.toFixed(value < 1 ? 2 : 1)}M · ${pctOfTotal(value)}`;
            const plateW = label.length * 7 + 10;
            return (
              <g key={i} className="group">
                <path
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeOpacity={0.42}
                  strokeWidth={Math.max(1, link.width ?? 1)}
                  className="group-hover:[stroke-opacity:0.80] transition-all"
                  aria-label={`${sourceLabel} → ${targetLabel}: ${label}`}
                />
                <g
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ pointerEvents: "none" }}
                >
                  <rect
                    x={midX - plateW / 2}
                    y={midY - 9}
                    width={plateW}
                    height={18}
                    fill="rgba(248,245,239,0.96)"
                    stroke="rgba(0,0,0,0.18)"
                    strokeWidth={0.75}
                    rx={2}
                  />
                  <text
                    x={midX}
                    y={midY + 4}
                    textAnchor="middle"
                    className="fill-ink text-[11px] font-semibold tabular-nums"
                  >
                    {label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Nodes + labels */}
          <g>
            {laidOutNodes.map((node) => {
              const data = node as unknown as NodeData;
              const x0 = node.x0 ?? 0;
              const y0 = node.y0 ?? 0;
              const y1 = node.y1 ?? 0;
              const h = y1 - y0;
              const fill = nodeColor(data);

              const isStage2 = data.stage === "barrier";
              const isLeftSide = data.stage === "population";

              if (isStage2) {
                // Stage 2: label above the node bar with a white plate so it
                // lifts off the incoming bands. Matches CoverageMapPanel.
                // Append volume + percent-of-total inline so the reader sees
                // both the household count and the share of all 35.5M eligible.
                const total = nodeTotal(data.id);
                const labelText = `${data.label} · ${formatVolume(total)} · ${pctOfTotal(total)}`;
                const labelWidth = Math.max(labelText.length * 6.5, 160);
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
                    />
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

              // Stage 1 (left) / Stage 3 (right): inline gutter label.
              const labelX = isLeftSide ? x0 - 12 : x0 + NODE_WIDTH + 12;
              const labelAnchor = isLeftSide ? "end" : "start";
              const MIN_CAPTION_H = 32;
              const captionLines =
                data.caption && h >= MIN_CAPTION_H ? wrapText(data.caption, 30) : [];
              const total = nodeTotal(data.id);
              const statLine = `${formatVolume(total)} · ${pctOfTotal(total)}`;

              // Stack vertically: label / stat (volume · percent) / caption[0] / caption[1].
              // Center the stack on the node bar's midpoint.
              const lineH = 13;
              const lineCount = 2 + captionLines.length; // label + stat + captions
              const topY = y0 + h / 2 - ((lineCount - 1) * lineH) / 2;

              return (
                <g key={data.id}>
                  <rect
                    x={x0}
                    y={y0}
                    width={NODE_WIDTH}
                    height={h}
                    fill={fill}
                  />
                  {/* Label */}
                  <text
                    x={labelX}
                    y={topY}
                    textAnchor={labelAnchor}
                    dominantBaseline="middle"
                    className="fill-ink text-[12px] font-semibold"
                  >
                    {data.label}
                  </text>
                  {/* Stat line — volume + percent, color-tinted to wedge */}
                  <text
                    x={labelX}
                    y={topY + lineH}
                    textAnchor={labelAnchor}
                    dominantBaseline="middle"
                    className="text-[11px] font-bold tabular-nums"
                    style={{ fill }}
                  >
                    {statLine}
                  </text>
                  {captionLines.slice(0, 2).map((line, idx) => (
                    <text
                      key={idx}
                      x={labelX}
                      y={topY + lineH * (2 + idx)}
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

      {/* Footnote */}
      <p className="text-[11px] text-graphite italic mt-3 max-w-3xl leading-relaxed">
        Band widths are millions of US households. Population sizes use the same USDA FNS gap data
        as the bar chart above; barrier shares per population are modeled from the qualifying-rules
        anchor and existing literature on benefits-navigation barriers. Hover any band for its
        volume. Numbers replace with measured cohort data once the first 10 households close.
      </p>
    </div>
  );
}
