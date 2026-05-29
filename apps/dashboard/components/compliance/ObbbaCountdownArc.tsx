// Polar → cartesian; 0° = top, clockwise.
function pt(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= 360) a1 = a0 + 359.9;
  const [sx, sy] = pt(cx, cy, r, a0);
  const [ex, ey] = pt(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${sx.toFixed(2)},${sy.toFixed(2)} A${r},${r} 0 ${large} 1 ${ex.toFixed(2)},${ey.toFixed(2)}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Three active OBBBA deadline windows
// Arc fill = REMAINING time (short arc = urgent, like a fuel gauge draining)
// ---------------------------------------------------------------------------
const PROVISION_DEFS = [
  {
    section: "§10105",
    label: "Payment error rate",
    sublabel: "FY2028 deadline",
    startIso:    "2025-01-01",
    deadlineIso: "2028-09-30",
    color: "var(--color-amber)",
    unitFn: (days: number) => ({ val: (days / 365).toFixed(1), unit: "yrs" }),
  },
  {
    section: "§10106",
    label: "County cost-share",
    sublabel: "Oct 2026 deadline",
    startIso:    "2025-01-01",
    deadlineIso: "2026-10-01",
    color: "#E07A1C",
    unitFn: (days: number) => ({ val: String(days), unit: "days" }),
  },
  {
    section: "§6 registry",
    label: "QC registry",
    sublabel: "Sep 2026 deadline",
    startIso:    "2025-01-01",
    deadlineIso: "2026-09-30",
    color: "#2A6F66",
    unitFn: (days: number) => ({ val: String(days), unit: "days" }),
  },
] as const;

// Shipped / cleared items shown as footer chips
const SHIPPED = [
  { section: "§10102", title: "Student work-rule exemptions" },
  { section: "§10108", title: "Navigator registry framework" },
  { section: "7 CFR 277.4", title: "Admin cost allocations" },
];

// Layout — identical to RadialGauges so both panels feel like one design system
const A0   = 225;  // arc start (lower-left, gap at bottom)
const SPAN = 270;  // sweep to lower-right
const R    = 90;
const SW   = 15;
const CY   = 142;
const ENDPOINT_Y = CY + R * Math.sin((45 * Math.PI) / 180); // ≈ 205.6
const CX   = [155, 460, 765] as const;

const GHOST = "rgba(26,23,20,0.08)";

export function ObbbaCountdownArc() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const provisions = PROVISION_DEFS.map((def, i) => {
    const start      = new Date(def.startIso);
    const deadline   = new Date(def.deadlineIso);
    const totalDays   = daysBetween(start, deadline);
    const remaining   = Math.max(0, daysBetween(today, deadline));
    const elapsed     = Math.max(0, daysBetween(start, today));
    // Fill = elapsed (nearly full arc = nearly out of time = urgent)
    const elapsedPct  = Math.min(1, Math.max(0, elapsed / totalDays));
    const { val, unit } = def.unitFn(remaining);
    const cx = CX[i];
    return { ...def, totalDays, remaining, elapsedPct, val, unit, cx };
  });

  const H = Math.ceil(ENDPOINT_Y) + 46;

  return (
    <div className="rounded-[4px] bg-surface border border-hairline p-7 mb-7">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="text-[9px] font-mono tracking-[0.16em] uppercase text-muted mb-1">
            OBBBA provision deadlines · CA exposure
          </p>
          <p className="text-[15px] font-semibold text-ink tracking-tight">
            Time remaining to compliance
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="font-mono">arc fill = window elapsed</span>
          <span>·</span>
          <span>full arc = urgent</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 920 ${H}`}
        className="w-full h-auto block"
        aria-label="OBBBA countdown arcs: remaining time for three active deadlines"
      >
        {/* Vertical dividers */}
        {[305, 615].map((x) => (
          <line key={x} x1={x} y1={10} x2={x} y2={H - 10}
            stroke="rgba(0,0,0,0.07)" strokeWidth={1} />
        ))}

        {provisions.map((p) => {
          const endAngle = A0 + SPAN * p.elapsedPct;
          const [edx, edy] = pt(p.cx, CY, R, endAngle);

          return (
            <g key={p.section}>
              {/* Ghost track — full deadline window */}
              <path
                d={arcPath(p.cx, CY, R, A0, A0 + SPAN)}
                fill="none" stroke={GHOST} strokeWidth={SW} strokeLinecap="butt"
              />
              {/* Remaining-time arc */}
              {p.elapsedPct > 0.01 && (
                <path
                  d={arcPath(p.cx, CY, R, A0, endAngle)}
                  fill="none" stroke={p.color} strokeWidth={SW + 2} strokeLinecap="round"
                  strokeOpacity={0.9}
                />
              )}
              {/* Endpoint glow + dot */}
              <circle cx={edx.toFixed(2)} cy={edy.toFixed(2)} r={11} fill={p.color} fillOpacity={0.2} />
              <circle cx={edx.toFixed(2)} cy={edy.toFixed(2)} r={5.5} fill={p.color} />

              {/* Center: countdown number */}
              <text
                x={p.cx} y={CY + 8}
                textAnchor="middle" fontSize={38} fontWeight={700}
                fill="#1A1714" letterSpacing={-0.8}
              >
                {p.val}
              </text>
              <text
                x={p.cx} y={CY + 26}
                textAnchor="middle" fontSize={11}
                fill={p.color} letterSpacing={0.5}
              >
                {p.unit}
              </text>

              {/* Label + sublabel below arc */}
              <text
                x={p.cx} y={ENDPOINT_Y + 18}
                textAnchor="middle" fontSize={10} fontWeight={600}
                fill="#57524A" letterSpacing={0.4}
              >
                {p.section}
              </text>
              <text
                x={p.cx} y={ENDPOINT_Y + 33}
                textAnchor="middle" fontSize={9}
                fill={p.color} letterSpacing={0.3}
              >
                {p.sublabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Cleared items footer */}
      <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-hairline mt-1">
        <span className="text-[9px] font-mono tracking-[0.14em] uppercase text-muted mr-1">
          Cleared
        </span>
        {SHIPPED.map((s) => (
          <span
            key={s.section}
            className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded"
            style={{ color: "rgba(42,111,102,0.75)", background: "rgba(42,111,102,0.08)" }}
          >
            <span className="text-[8px]">✓</span>
            <span className="font-mono font-semibold">{s.section}</span>
            <span className="text-graphite hidden sm:inline">{s.title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
