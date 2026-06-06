// Deterministic turbulent "mess" line field behind the why-civica hero.
// Many thin colored lines tangle through the middle and converge on the app —
// the chaos of state rules resolving into one guided path (Recidiviz-style).
//
// Computed once at module load with NO Math.random, so the server and client
// render byte-identical paths (no hydration mismatch). Drawn statically; only
// the five labeled flag lines animate on scroll.

const FIELD_COLORS = [
  "#003DA5", // CA blue
  "#BF0A30", // TX red
  "#0056A2", // NY blue
  "#CC2233", // FL red
  "#005C28", // WA green
  "#2A6F66", // teal
  "#C9922A", // wheat/amber
  "#2D5A45", // pine
];

// Stable pseudo-random in [0,1) from an integer-derived seed.
function pseudo(seed: number): number {
  const s = Math.sin(seed) * 43758.5453;
  return s - Math.floor(s);
}

// Catmull-Rom through the waypoints → smooth cubic-bezier path string.
function smoothPath(pts: number[][]): string {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export interface FieldLine {
  d: string;
  color: string;
  width: number;
  opacity: number;
}

const COUNT = 26;
const X_START = 185;
const X_CONVERGE = 840; // lines funnel to the app here
const X_TAIL = 980; // then run flat toward the timeline

export const GEMINI_FIELD: FieldLine[] = Array.from({ length: COUNT }, (_, i) => {
  const t = i / (COUNT - 1);
  const startY = 120 + t * 320; // spread 120..440 on the left (the flag band)
  const r1 = pseudo(i * 1.7 + 0.3);
  const r2 = pseudo(i * 3.1 + 1.1);
  const phase = r1 * Math.PI * 2;
  const amp = 70 + r2 * 55; // turbulence amplitude 70..125
  const freq = 2 + (i % 4) * 0.6; // a few different wave frequencies

  const xs = [X_START, 320, 455, 590, 720, X_CONVERGE, X_TAIL];
  const pts = xs.map((x) => {
    const prog = (x - X_START) / (X_CONVERGE - X_START);
    const clamped = Math.max(0, Math.min(1, prog));
    const env = Math.sin(clamped * Math.PI); // 0 at the ends, 1 in the middle
    const baseY = startY + (280 - startY) * clamped;
    const turb = amp * env * Math.sin(prog * Math.PI * freq + phase);
    return [x, baseY + turb];
  });

  return {
    d: smoothPath(pts),
    color: FIELD_COLORS[i % FIELD_COLORS.length],
    width: 0.6 + r1 * 0.5, // 0.6..1.1
    opacity: 0.13 + r2 * 0.16, // 0.13..0.29
  };
});
