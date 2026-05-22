import type { OutcomeRow } from "../../lib/analytics/civica-outcomes";

// Polar → cartesian. Angle in degrees, 0 = top, clockwise.
function pt(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

// SVG arc path between two angles on a circle.
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= 360) a1 = a0 + 359.9;
  const [sx, sy] = pt(cx, cy, r, a0);
  const [ex, ey] = pt(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${sx.toFixed(2)},${sy.toFixed(2)} A${r},${r} 0 ${large} 1 ${ex.toFixed(2)},${ey.toFixed(2)}`;
}

// Max values that make the arc fills visually meaningful (not just 100%)
const MAX: Record<number, number> = { 1: 15, 3: 30, 4: 30 };

// Arc opens at the bottom — gap from 135° to 225° (symmetric around 6 o'clock).
// Civica arc sweeps clockwise from lower-left through top to lower-right.
const A0   = 225;   // arc start (lower-left, ~7:30 o'clock)
const SPAN = 270;   // sweep to lower-right (~4:30 o'clock), gap at bottom
const R    = 64;    // ring radius
const SW   = 11;    // stroke width
const CY   = 96;    // vertical center

// y at the arc endpoints (sin(225-90) = sin(135°) = 0.707)
const ENDPOINT_Y = CY + R * Math.sin((45 * Math.PI) / 180); // ≈ 205.6

const TEAL     = "#2A6F66";
const GHOST    = "rgba(26,23,20,0.08)";
const BASE_ARC = "rgba(26,23,20,0.16)";

export function RadialGauges({ rows }: { rows: OutcomeRow[] }) {
  const flagships = [1, 3, 4]
    .map((s) => rows.find((r) => r.step === s))
    .filter((r): r is OutcomeRow => !!r && r.civicaNumeric != null && r.baselineNumeric != null);

  if (flagships.length === 0) return null;

  const CX = [155, 460, 765]; // horizontal centers for 3 gauges in 920px wide SVG
  const H  = Math.ceil(ENDPOINT_Y) + 46; // ≈ 252, rounded up with label room

  return (
    <div className="rounded-[4px] bg-surface border border-hairline p-7 mb-7">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="text-[9px] font-mono tracking-[0.16em] uppercase text-muted mb-1">
            Civica observed vs CA FY2024 baseline
          </p>
          <p className="text-[15px] font-semibold text-ink tracking-tight">
            Flagship outcome metrics
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-1.5 rounded-full" style={{ background: TEAL }} />
            <span className="text-graphite">Civica</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-1.5 rounded-full" style={{ background: BASE_ARC }} />
            <span className="text-graphite">CA baseline</span>
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 920 ${H}`}
        className="w-full h-auto block"
        aria-label="Radial gauge trio: PER, days to decision, applications per navigator"
      >
        {/* Vertical dividers between gauges */}
        {[305, 615].map((x) => (
          <line key={x} x1={x} y1={10} x2={x} y2={H - 10}
            stroke="rgba(0,0,0,0.07)" strokeWidth={1} />
        ))}

        {flagships.map((row, i) => {
          const cx   = CX[i];
          const max  = MAX[row.step] ?? Math.max(row.civicaNumeric!, row.baselineNumeric!) * 1.4;
          const inv  = row.lowerIsBetter ?? false;

          const civPct  = inv
            ? Math.max(0, 1 - row.civicaNumeric!  / max)
            : row.civicaNumeric!  / max;
          const basePct = inv
            ? Math.max(0, 1 - row.baselineNumeric! / max)
            : row.baselineNumeric! / max;

          const endCiv  = A0 + SPAN * Math.min(civPct,  1);
          const endBase = A0 + SPAN * Math.min(basePct, 1);

          const [edx, edy] = pt(cx, CY, R, endCiv);

          // Baseline tick — radial line at baseline angle, just outside the ring
          const [btx0, bty0] = pt(cx, CY, R - SW / 2 - 1, endBase);
          const [btx1, bty1] = pt(cx, CY, R + SW / 2 + 1, endBase);
          // Baseline label position: slightly outside the ring
          const [blx, bly] = pt(cx, CY, R + SW + 16, endBase);

          // Format display value
          const fmt = (n: number) =>
            `${n % 1 === 0 ? n : n.toFixed(1)}${row.unit === "%" ? "%" : ""}`;
          const unitLabel = row.unit !== "%" ? row.unit : "";

          return (
            <g key={row.step}>
              {/* Ghost track */}
              <path
                d={arcPath(cx, CY, R, A0, A0 + SPAN)}
                fill="none" stroke={GHOST} strokeWidth={SW} strokeLinecap="butt"
              />
              {/* Baseline arc (dimmer, slightly thinner) */}
              {basePct > 0.01 && (
                <path
                  d={arcPath(cx, CY, R, A0, endBase)}
                  fill="none" stroke={BASE_ARC} strokeWidth={SW - 3} strokeLinecap="round"
                />
              )}
              {/* Civica arc */}
              <path
                d={arcPath(cx, CY, R, A0, endCiv)}
                fill="none" stroke={TEAL} strokeWidth={SW + 2} strokeLinecap="round"
              />
              {/* Civica endpoint glow + dot */}
              <circle cx={edx.toFixed(2)} cy={edy.toFixed(2)} r={11} fill={TEAL} fillOpacity={0.18} />
              <circle cx={edx.toFixed(2)} cy={edy.toFixed(2)} r={5.5} fill={TEAL} />

              {/* Baseline tick mark */}
              {basePct > 0.01 && (
                <>
                  <line
                    x1={btx0.toFixed(2)} y1={bty0.toFixed(2)}
                    x2={btx1.toFixed(2)} y2={bty1.toFixed(2)}
                    stroke="rgba(26,23,20,0.30)" strokeWidth={2} strokeLinecap="round"
                  />
                  <text
                    x={blx.toFixed(2)} y={(bly + 4).toFixed(2)}
                    textAnchor="middle" fontSize={8} fill="#9A8F85"
                    fontFamily="monospace"
                  >
                    {fmt(row.baselineNumeric!)}
                  </text>
                </>
              )}

              {/* Center: hero number */}
              <text
                x={cx} y={CY + 8}
                textAnchor="middle" fontSize={38} fontWeight={700}
                fill="#1A1714" letterSpacing={-0.8}
              >
                {fmt(row.civicaNumeric!)}
              </text>
              {unitLabel && (
                <text
                  x={cx} y={CY + 26}
                  textAnchor="middle" fontSize={11}
                  fill={TEAL} letterSpacing={0.5}
                >
                  {unitLabel}
                </text>
              )}

              {/* Label + delta below the arc endpoints */}
              <text
                x={cx} y={ENDPOINT_Y + 18}
                textAnchor="middle" fontSize={10} fontWeight={600}
                fill="#57524A" letterSpacing={0.4}
              >
                {row.flagshipLabel ?? row.metric}
              </text>
              {row.deltaLabel && (
                <text
                  x={cx} y={ENDPOINT_Y + 33}
                  textAnchor="middle" fontSize={10}
                  fill={TEAL}
                >
                  {row.deltaLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
