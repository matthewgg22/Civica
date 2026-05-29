"use client";

import { useState } from "react";

type Pop = {
  population: string;
  eligibleMillions: number;
  enrolledMillions: number;
};

const COLORS = ["#9C3A24", "var(--color-amber-dark)", "#2A6F66", "#4F46A5"];

export function IcebergChart({ populations }: { populations: Pop[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const totalEligible = populations.reduce((s, p) => s + p.eligibleMillions, 0);
  const totalEnrolled = populations.reduce((s, p) => s + p.enrolledMillions, 0);
  const totalGap      = totalEligible - totalEnrolled;
  const enrolledPct   = Math.round((totalEnrolled / totalEligible) * 100);
  const gapPct        = 100 - enrolledPct;

  const W  = 880;
  const H  = 440;
  const WL = 178; // waterline — taller tip gives enrolled label more room

  // Wider, rounder tip so the enrolled label isn't cramped in a needle
  const icebergPts: [number, number][] = [
    [440,  12],
    [500,  52],
    [574, WL],
    [672, 304],
    [698, 390],
    [606, 422],
    [440, 432],
    [274, 422],
    [182, 390],
    [208, 304],
    [306, WL],
    [380,  52],
  ];

  const ptsStr = (pts: [number, number][]) => pts.map(([x, y]) => `${x},${y}`).join(" ");

  // Cohort bars — right column, below waterline
  const BAR_X = 664;
  const BAR_W = 150;
  const BAR_TOP     = WL + 22;
  const BAR_TOTAL_H = H - BAR_TOP - 28;

  let barY = BAR_TOP;
  const popBars = populations.map((p, i) => {
    const gap   = p.eligibleMillions - p.enrolledMillions;
    const h     = (gap / totalGap) * BAR_TOTAL_H;
    const color = COLORS[i % COLORS.length];
    const entry = { y: barY, h, color, pop: p.population, gap, idx: i };
    barY += h + 3;
    return entry;
  });

  const handleBarClick = (idx: number) => {
    document.getElementById(`pop-card-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="rounded-[4px] border border-hairline bg-surface p-5 select-none">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">Eligibility vs enrollment · national aggregate</p>
          <h4 className="text-[17px] font-semibold text-ink tracking-tight leading-tight">
            Most of the eligible population sits below the surface
          </h4>
          <p className="text-[12px] text-graphite mt-1 max-w-xl leading-relaxed">
            The waterline is the enrollment surface. The submerged mass is eligible households that qualify but never apply.
          </p>
        </div>
        <p className="text-[11px] font-mono text-muted tracking-wide shrink-0 mt-0.5">
          n = {totalEligible.toFixed(1)}M eligible · national
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        aria-label="Iceberg chart: enrolled SNAP households above waterline, eligible-but-unenrolled below"
      >
        <defs>
          <pattern id="iceberg-gap" patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(45)">
            <rect width={8} height={8} fill="rgba(156,58,36,0.09)" />
            <line x1={0} y1={0} x2={0} y2={8} stroke="#9C3A24" strokeWidth={1.2} strokeOpacity={0.38} />
          </pattern>
          <clipPath id="iceberg-above">
            <rect x={0} y={0} width={W} height={WL} />
          </clipPath>
          <clipPath id="iceberg-below">
            <rect x={0} y={WL} width={W} height={H - WL} />
          </clipPath>
        </defs>

        {/* ocean tint */}
        <rect x={0} y={WL} width={W} height={H - WL} fill="#C8DCE8" fillOpacity={0.18} />

        {/* gap mass */}
        <polygon points={ptsStr(icebergPts)} fill="url(#iceberg-gap)" clipPath="url(#iceberg-below)" />
        <polygon points={ptsStr(icebergPts)} fill="none" stroke="#9C3A24" strokeWidth={1.5} strokeOpacity={0.4} clipPath="url(#iceberg-below)" />

        {/* enrolled tip */}
        <polygon points={ptsStr(icebergPts)} fill="var(--color-amber)" fillOpacity={0.52} clipPath="url(#iceberg-above)" />
        <polygon points={ptsStr(icebergPts)} fill="none" stroke="var(--color-amber-dark)" strokeWidth={1.5} clipPath="url(#iceberg-above)" />

        {/* waterline */}
        <line x1={0} y1={WL} x2={W} y2={WL} stroke="#3D7A96" strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.6} />
        <text x={8} y={WL - 7} fontSize={8} fill="#3D7A96" fontFamily="monospace" letterSpacing={1.5}>
          ENROLLMENT SURFACE
        </text>

        {/* ── Enrolled label — same weight as gap, centered in the tip ── */}
        <text x={440} y={72}  textAnchor="middle" fontSize={34} fontWeight={700} fill="#7A4A10" letterSpacing={-0.5}>
          {totalEnrolled.toFixed(1)}M
        </text>
        <text x={440} y={94}  textAnchor="middle" fontSize={9}  fill="var(--color-amber-dark)" letterSpacing={2}>ENROLLED</text>
        <text x={440} y={112} textAnchor="middle" fontSize={10} fill="var(--color-amber-dark)" opacity={0.75}>{enrolledPct}% of eligible</text>

        {/* ── Gap label — same font weight, slightly larger font because area is wider ── */}
        <text x={336} y={282} textAnchor="middle" fontSize={38} fontWeight={700} fill="#9C3A24" letterSpacing={-0.5}>
          {totalGap.toFixed(1)}M
        </text>
        <text x={336} y={306} textAnchor="middle" fontSize={9}  fill="#9C3A24" letterSpacing={2}>ELIGIBLE · NOT ENROLLED</text>
        <text x={336} y={324} textAnchor="middle" fontSize={10} fill="#9C3A24" opacity={0.8}>{gapPct}% unreached</text>

        {/* ── Cohort bars ── */}
        <text x={BAR_X + BAR_W / 2} y={BAR_TOP - 8} textAnchor="middle" fontSize={8} fill="#5A544D" letterSpacing={1.5}>
          GAP BY COHORT
        </text>
        {popBars.map((b) => {
          const isHovered = hoveredIdx === b.idx;
          return (
            <g
              key={b.idx}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredIdx(b.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => handleBarClick(b.idx)}
            >
              <rect
                x={BAR_X} y={b.y}
                width={BAR_W} height={Math.max(b.h - 3, 4)}
                rx={2}
                fill={b.color}
                fillOpacity={isHovered ? 1 : 0.72}
                style={{ transition: "fill-opacity 0.12s" }}
              />
              {b.h > 24 && (
                <>
                  <text x={BAR_X + 6} y={b.y + 13} fontSize={8.5} fill="white" fontWeight={600} letterSpacing={0.2}>
                    {b.pop.length > 22 ? b.pop.slice(0, 21) + "…" : b.pop}
                  </text>
                  <text x={BAR_X + 6} y={b.y + 25} fontSize={8.5} fill="rgba(255,255,255,0.82)" fontFamily="monospace">
                    {b.gap.toFixed(1)}M gap
                  </text>
                </>
              )}
              {isHovered && b.h > 24 && (
                <text x={BAR_X + BAR_W - 8} y={b.y + 13} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.7)">↓</text>
              )}
            </g>
          );
        })}

        {/* legend */}
        <g transform={`translate(20, ${H - 22})`}>
          <rect x={0}  y={0} width={12} height={9} rx={1} fill="var(--color-amber)" fillOpacity={0.65} />
          <text x={17} y={8} fontSize={9} fill="#5A544D">Enrolled</text>
          <rect x={82} y={0} width={12} height={9} rx={1} fill="url(#iceberg-gap)" stroke="#9C3A24" strokeWidth={0.8} strokeOpacity={0.5} />
          <text x={99} y={8} fontSize={9} fill="#5A544D">Eligible · not enrolled</text>
        </g>
      </svg>

      <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
        Vertical scale is illustrative. Numbers are accurate: {totalEnrolled.toFixed(1)}M enrolled vs {totalEligible.toFixed(1)}M eligible nationally. Populations overlap; sum is illustrative.
      </p>
    </div>
  );
}
