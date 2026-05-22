// ---------------------------------------------------------------------------
// 3-stage enrollment funnel.
//
// 5-stage data (21M, 20.5M, 19.5M) is too similar to render as a funnel —
// the bottom stages produce near-identical widths that look like rectangles.
// Collapsed to 3 stages so every constriction is visually meaningful:
//
//   35.5M eligible  →  24.0M aware  →  19.5M enrolled
//
// The "last-mile" drop (4.5M = stigma + barriers + denied) is annotated in
// full detail on the annotation but kept as a single constriction.
// ---------------------------------------------------------------------------

const STAGES = [
  {
    label: "Nationally eligible",
    n: 35.5,
    pct: 100,
    dropN: null   as null | number,
    dropLabel: null as null | string,
    dropSub: null  as null | string,
  },
  {
    label: "Aware they qualify",
    n: 24.0,
    pct: 68,
    dropN: 11.5,
    dropLabel: "don't know they qualify",
    dropSub: null,
  },
  {
    label: "Enrolled (CalFresh)",
    n: 19.5,
    pct: 55,
    dropN: 4.5,
    dropLabel: "stigma · barriers · denied",
    dropSub: "3.0M stigma  ·  0.5M process  ·  1.0M denied",
  },
] as const;

// Funnel fills tuned for dark pine background. Wheat → amber → brighter teal.
// The narrowing toward enrolled (teal) is the "wins" color — visually rhymes
// with the hero card's teal moments and the BusinessModel close.
const FILLS = [
  "rgba(232,197,71,0.18)",
  "rgba(232,165,71,0.30)",
  "rgba(80,180,168,0.50)",
];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
const CX     = 270;   // funnel center-x
const MAX_HW = 235;   // half-width of stage 0 (eligible)
const S_H    =  90;   // stage height
const GAP    =   4;   // near-seamless gap between stages
const TOP_Y  =  28;

const hw = (n: number) => MAX_HW * (n / 35.5);

export function GravityFunnel() {
  const stageData = STAGES.map((s, i) => {
    const y0   = TOP_Y + i * (S_H + GAP);
    const y1   = y0 + S_H;
    const hw0  = hw(s.n);
    const hw1  = i < STAGES.length - 1 ? hw(STAGES[i + 1].n) : hw0 * 0.75;
    const midY = y0 + S_H / 2;
    return { ...s, y0, y1, hw0, hw1, midY, fill: FILLS[i] };
  });

  const gaps = stageData.slice(1).map((s, i) => ({
    midY:        (stageData[i].y1 + s.y0) / 2,
    dropN:       s.dropN,
    dropLabel:   s.dropLabel,
    dropSub:     s.dropSub,
    junctionHw:  s.hw0,
  }));

  const bottomY = TOP_Y + STAGES.length * (S_H + GAP) - GAP;
  const H = bottomY + 28;

  return (
    <div className="rounded-[4px] bg-pine p-7 mb-7">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="text-[9px] font-mono tracking-[0.16em] uppercase text-white/40 mb-1">
            National SNAP enrollment funnel
          </p>
          <p className="text-[15px] font-semibold text-white tracking-tight">
            Where the 16M fall out of enrollment
          </p>
        </div>
        <p className="text-[10px] font-mono text-white/35">
          n = 35.5M eligible · national
        </p>
      </div>

      <svg
        viewBox={`0 0 760 ${H}`}
        className="w-full h-auto block"
        aria-label="SNAP enrollment funnel: 35.5M eligible narrowing to 19.5M enrolled"
      >
        {/* Center axis */}
        <line
          x1={CX} y1={TOP_Y}
          x2={CX} y2={bottomY}
          stroke="rgba(255,255,255,0.08)" strokeWidth={1}
        />

        {stageData.map((s, i) => (
          <g key={s.label}>
            {/* Funnel stage trapezoid */}
            <polygon
              points={`${CX - s.hw0},${s.y0} ${CX + s.hw0},${s.y0} ${CX + s.hw1},${s.y1} ${CX - s.hw1},${s.y1}`}
              fill={s.fill}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={0.75}
            />
            {/* Main count — wheat-gold rhymes with hero TL;DR */}
            <text
              x={CX} y={s.midY + 10}
              textAnchor="middle" fontSize={28} fontWeight={700}
              fill="#E8C547" letterSpacing={-0.6}
            >
              {s.n.toFixed(1)}M
            </text>
            {/* Stage label */}
            <text
              x={CX} y={s.midY + 26}
              textAnchor="middle" fontSize={8}
              fill="rgba(255,255,255,0.55)" letterSpacing={1.4}
              fontFamily="monospace"
            >
              {s.label.toUpperCase()}
            </text>
            {/* Pct of eligible — teal for the final enrolled stage, wheat for others */}
            <text
              x={CX} y={s.midY + 41}
              textAnchor="middle" fontSize={9}
              fill={i === 2 ? "rgba(80,180,168,0.85)" : "rgba(232,197,71,0.55)"}
              letterSpacing={0.4}
            >
              {s.pct}% of eligible
            </text>
          </g>
        ))}

        {/* Dropout annotations — coral-on-dark (brick stays the semantic, brighter for contrast) */}
        {gaps.map((g, i) => {
          if (!g.dropN || !g.dropLabel) return null;
          const lineX0 = CX + g.junctionHw + 4;
          const lineX1 = CX + MAX_HW + 14;
          const labelX = lineX1 + 8;
          return (
            <g key={i}>
              <line
                x1={lineX0} y1={g.midY}
                x2={lineX1} y2={g.midY}
                stroke="rgba(232,140,115,0.45)" strokeWidth={1} strokeDasharray="3 2"
              />
              <circle cx={lineX0 - 2} cy={g.midY} r={2.5} fill="rgba(232,140,115,0.65)" />
              {/* Drop amount */}
              <text
                x={labelX} y={g.midY - 4}
                fontSize={16} fontWeight={700}
                fill="#F0A088" letterSpacing={-0.3}
              >
                −{g.dropN.toFixed(1)}M
              </text>
              {/* Main reason */}
              <text
                x={labelX} y={g.midY + 10}
                fontSize={8}
                fill="rgba(232,140,115,0.80)" letterSpacing={0.6}
                fontFamily="monospace"
              >
                {g.dropLabel}
              </text>
              {/* Sub-detail (last-mile breakdown) */}
              {g.dropSub && (
                <text
                  x={labelX} y={g.midY + 22}
                  fontSize={7}
                  fill="rgba(232,140,115,0.50)" letterSpacing={0.4}
                  fontFamily="monospace"
                >
                  {g.dropSub}
                </text>
              )}
            </g>
          );
        })}

        {/* Enrolled label at bottom — teal for "wins" */}
        <text
          x={CX} y={bottomY + 18}
          textAnchor="middle" fontSize={9}
          fill="rgba(80,180,168,0.75)" letterSpacing={1.5}
          fontFamily="monospace"
        >
          ▼ ENROLLED COHORT
        </text>
      </svg>

      <p className="text-[11px] text-white/40 mt-2.5 leading-relaxed">
        Funnel stages modeled from USDA FNS SNAP participation data and CDSS CalFresh studies.
        &ldquo;Aware they qualify&rdquo; (24.0M) is an estimate; enrolled (19.5M) is from FNS administrative data.
      </p>
    </div>
  );
}
