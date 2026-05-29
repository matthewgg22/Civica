"use client";

// Revenue model — scaling-curve area chart + three value pools.
// Stacked SVG areas show operator / government / adjacency revenue
// as a function of enrolled households. Vertical position marker follows the slider.

import { useState, useMemo } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const PER_ENROLLED = {
  operator:  92,  // success fee ($85) + navigator SaaS pro-rated ($7)
  gov:       35,  // contract + USDA/grants pro-rated
  adjacency: 44,  // referral fees + CalAIM ECM + Medicare (future layer)
};

// SVG coordinate system
const SVG_W  = 800;
const SVG_H  = 200;
const PAD_T  = 24;   // room for y-ref labels at top
const PAD_B  = 0;
const EFF_H  = SVG_H - PAD_T - PAD_B;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sliderToEnrolled(s: number) {
  return Math.round(1000 * Math.pow(5000, s / 100));
}

function fmtRev(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

function fmtEnrolled(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${Math.round(n / 1000)}K`;
  if (n >= 1_000)     return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

// ── Pre-computed chart data (module-level, no slider dependency) ──────────────

const N_PTS = 101;

const DATA = Array.from({ length: N_PTS }, (_, s) => {
  const enrolled = sliderToEnrolled(s);
  const op  = enrolled * PER_ENROLLED.operator;
  const gov = enrolled * PER_ENROLLED.gov;
  const adj = enrolled * PER_ENROLLED.adjacency;
  return { s, enrolled, op, gov, adj, total: op + gov + adj };
});

const MAX_Y = DATA[N_PTS - 1].total;

function xS(s: number) { return (s / 100) * SVG_W; }
function yS(v: number) { return PAD_T + EFF_H - (v / MAX_Y) * EFF_H; }

function buildArea(top: number[], bot: number[]): string {
  const pts: string[] = [`M ${xS(0)} ${yS(top[0])}`];
  for (let i = 1; i < N_PTS; i++) pts.push(`L ${xS(i)} ${yS(top[i])}`);
  for (let i = N_PTS - 1; i >= 0; i--) pts.push(`L ${xS(i)} ${yS(bot[i])}`);
  pts.push("Z");
  return pts.join(" ");
}

function buildLine(vals: number[]): string {
  const pts = [`M ${xS(0)} ${yS(vals[0])}`];
  for (let i = 1; i < N_PTS; i++) pts.push(`L ${xS(i)} ${yS(vals[i])}`);
  return pts.join(" ");
}

const OP_AREA  = buildArea(DATA.map(d => d.op),  DATA.map(() => 0));
const GOV_AREA = buildArea(DATA.map(d => d.op + d.gov),  DATA.map(d => d.op));
const ADJ_AREA = buildArea(DATA.map(d => d.total), DATA.map(d => d.op + d.gov));

const OP_LINE  = buildLine(DATA.map(d => d.op));
const GOV_LINE = buildLine(DATA.map(d => d.op + d.gov));
const ADJ_LINE = buildLine(DATA.map(d => d.total));

const Y_REFS = [25_000_000, 100_000_000, 300_000_000, 600_000_000];

const X_MILESTONES = [
  { s: 0,   label: "1K"   },
  { s: 25,  label: "8K"   },
  { s: 50,  label: "70K"  },
  { s: 75,  label: "600K" },
  { s: 100, label: "5M"   },
];

// ── Pool definitions (for cards below) ───────────────────────────────────────

interface Lever {
  name: string;
  plain: string;
  range: string;
  status: "Near-term" | "Future" | "Regulatory";
  obbba?: string;
}

const POOLS = [
  {
    id: "operator" as const,
    label: "Operators pay",
    lineColor: "rgba(255,255,255,0.45)",
    areaColor: "rgba(255,255,255,0.07)",
    statColor: "rgba(255,255,255,0.85)",
    accentColor: "#2A6F66",
    whoPays:
      "CBOs and licensed facility operators pay because one navigator now handles 3× the caseload. Same staff budget, three times the community impact.",
    bottomLine:
      "100 CBOs × 3 navigators × 23 apps/mo × $85 success fee → $7.1M/yr in success fees before navigator SaaS.",
    levers: [
      {
        name: "Success Fee - Confirmed approval, per enrolled household",
        plain: "Civica earns only when the household gets benefits. No enrollment, no fee.",
        range: "$50–120 / enrollment",
        status: "Near-term" as const,
        obbba: "§10102",
      },
      {
        name: "Navigator Platform License - ~1,200 CA CBOs, replaces manual tracking",
        plain: "Monthly per-seat SaaS. §10102 ABAWD work-log requirements make spreadsheet intake untenable — navigator tooling is now compliance infrastructure, not optional.",
        range: "Pricing in validation",
        status: "Near-term" as const,
        obbba: "§10102",
      },
      {
        name: "Senior Housing License - RCFE, Section 202, assisted living operators",
        plain: "Per-facility monthly SaaS. Value anchor: ~$168K/yr in resident SNAP income per 100 residents — operators recover cost in the first enrollment cohort.",
        range: "$200–400 / facility / mo",
        status: "Near-term" as const,
      },
    ] as Lever[],
  },
  {
    id: "gov" as const,
    label: "Government pays",
    lineColor: "rgba(232,197,71,0.75)",
    areaColor: "rgba(232,197,71,0.10)",
    statColor: "rgba(232,197,71,0.90)",
    accentColor: "var(--color-amber)",
    whoPays:
      "California faces $510M in cumulative federal penalties if it can't bring its SNAP error rate below the threshold. Civica reduces the error rate without new appropriations or headcount — and under 7 CFR 272.1(c), USDA reimburses states 50% of SNAP admin costs, so a $1M Civica contract costs California $500K net.",
    bottomLine:
      "$170M/yr in §10105 penalties accruing through FY2028. A $1M contract (net $500K after USDA match) breaks even if it prevents 2 weeks of penalty accrual.",
    levers: [
      {
        name: "Error Rate Contract - CDSS or county DSS, $500K–$5M/yr",
        plain: "B2G contract for error-rate reduction. No open RFP as of 2026 — path opens as California's FY2028 federal penalty exposure materializes. Pitch: Civica cohort PER 4.2% vs CA statewide 10.8%.",
        range: "$500K–$5M / yr",
        status: "Regulatory" as const,
        obbba: "§10105",
      },
      {
        name: "Federal Admin Match - 50% USDA reimbursement, 7 CFR 272.1(c)",
        plain: "USDA reimburses states 50% of SNAP administrative costs including navigator outreach contracts. A $1M Civica contract costs California $500K net — USDA pays the other half, doubling the state's effective budget without a new appropriation.",
        range: "50% of contract value reimbursed",
        status: "Near-term" as const,
        obbba: "§10102",
      },
      {
        name: "SNAP Outreach Grants - FNS-administered, state-allocated",
        plain: "Federal SNAP-Ed and outreach grants administered by states. Civica qualifies as an approved navigator platform under FNS outreach rules — stacks on top of the 50% admin match.",
        range: "Subject to state allocation",
        status: "Near-term" as const,
      },
    ] as Lever[],
  },
  {
    id: "adjacency" as const,
    label: "Enrolled relationship earns",
    lineColor: "rgba(64,180,160,0.65)",
    areaColor: "rgba(42,111,102,0.18)",
    statColor: "rgba(255,255,255,0.40)",
    accentColor: "#6B7280",
    future: true,
    whoPays:
      "Every household enrolled in SNAP qualifies for 4–6 adjacent programs. Civica earns referral fees, CalAIM ECM platform fees, and data insights. This layer opens as the enrolled base scales.",
    bottomLine:
      "At 10K 60+ enrolled: CalAIM ECM ($50–100/mo) + MSP referrals ($200–500) → $8–14M/yr combined. Layer activates meaningfully at ~50K total enrolled.",
    levers: [
      {
        name: "Dual-Eligible Care Fees - CalAIM ECM via FQHC billing partner",
        plain: "Dual-eligible seniors (Medicare + Medi-Cal) enrolled via Civica qualify for California's ECM program. Medi-Cal plans pay $182–280/member/month to care management entities — Civica earns a platform fee, no separate license required.",
        range: "$50–100 / member / mo",
        status: "Future" as const,
      },
      {
        name: "Medicare Savings Referrals - MSP, LIS/Extra Help, MA plans",
        plain: "60+ households enrolled via Civica routinely qualify for MSP and Extra Help. Referral fee per confirmed enrollment paid by Medicare Advantage plans or CMS outreach programs.",
        range: "$200–500 / enrollment",
        status: "Future" as const,
      },
      {
        name: "Low Income Program Referrals - Utility, insurance, job training",
        plain: "Enrolled households qualify for LIHEAP utility assistance, renter's insurance, and workforce programs. Partner organizations pay per confirmed referral conversion.",
        range: "$50–200 / referral",
        status: "Future" as const,
      },
      {
        name: "Enrollment Analytics - County planning, policy research (legal review pending)",
        plain: "Aggregate enrollment data for county planning offices and policy researchers. No PII — activation gated on legal review before any data leaves Civica.",
        range: "TBD — legal review first",
        status: "Regulatory" as const,
      },
    ] as Lever[],
  },
];

const STATUS_CHIP = {
  "Near-term":  {
    background: "color-mix(in srgb, var(--color-amber) 8%, transparent)",
    color: "var(--color-amber-dark)",
    border: "1px solid color-mix(in srgb, var(--color-amber) 19%, transparent)",
  },
  "Future":     { background: "rgba(0,0,0,0.04)", color: "#6B7280", border: "1px solid rgba(0,0,0,0.10)" },
  "Regulatory": { background: "#5C1F1108", color: "#5C1F11", border: "1px solid #5C1F1120" },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function BusinessModelPanel() {
  const [slider, setSlider] = useState(35);

  const enrolled = useMemo(() => sliderToEnrolled(slider), [slider]);
  const opRev    = useMemo(() => enrolled * PER_ENROLLED.operator, [enrolled]);
  const govRev   = useMemo(() => enrolled * PER_ENROLLED.gov, [enrolled]);
  const adjRev   = useMemo(() => enrolled * PER_ENROLLED.adjacency, [enrolled]);
  const nearTotal = useMemo(() => opRev + govRev, [opRev, govRev]);

  // Vertical line x position in SVG coords
  const lineX = (slider / 100) * SVG_W;

  // Intersection y values for the position dots
  const dotOp  = yS(opRev);
  const dotGov = yS(opRev + govRev);
  const dotAdj = yS(opRev + govRev + adjRev);

  return (
    <div className="rounded-[4px] border border-hairline bg-surface p-7">

      {/* ── Panel header ── */}
      <div className="mb-5">
        <p className="eyebrow mb-1.5">Part 7 · revenue model · SNAP platform</p>
        <h3 className="text-[20px] font-semibold tracking-tight text-ink leading-tight">
          Three layers each have a reason to pay — and they compound
        </h3>
        <p className="text-[13px] text-graphite mt-1.5 max-w-2xl leading-relaxed">
          Operators pay for leverage. Government pays to avoid federal penalties.
          The enrolled relationship earns from every adjacent service the household qualifies for.
          Drag to see how the model scales.
        </p>
      </div>

      {/* ── Chart card ── */}
      <div className="rounded-[4px] overflow-hidden mb-6" style={{ background: "#0D2B2B" }}>

        {/* Stat row */}
        <div className="flex items-stretch border-b border-white/8">
          {/* Enrolled count */}
          <div className="px-6 py-4 shrink-0">
            <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/30 mb-1">
              Enrolled households / yr
            </p>
            <p className="text-[32px] font-bold tabular-nums leading-none text-white/90">
              {fmtEnrolled(enrolled)}
            </p>
          </div>

          <div className="w-px bg-white/8 shrink-0" />

          {/* Pool stats */}
          {POOLS.map((pool, i) => (
            <div key={pool.id} className="flex-1 min-w-0 px-5 py-4 border-r border-white/8 last:border-r-0 overflow-hidden">
              <div className="flex items-center gap-1.5 mb-1 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: pool.lineColor }} />
                <p className="text-[9px] uppercase tracking-[0.10em] font-semibold text-white/30 truncate">
                  {pool.label}
                  {pool.future && <span className="ml-1 opacity-60">· future</span>}
                </p>
              </div>
              <p className="text-[22px] font-bold tabular-nums leading-none font-mono"
                style={{ color: pool.statColor }}>
                {fmtRev(i === 0 ? opRev : i === 1 ? govRev : adjRev)}
              </p>
              {i === 1 && govRev > 0 && (
                <p className="text-[9px] font-mono mt-1 leading-tight" style={{ color: "rgba(232,197,71,0.45)" }}>
                  {fmtRev(govRev * 0.5)} net · 50% USDA match
                </p>
              )}
            </div>
          ))}

          <div className="w-px bg-white/8 shrink-0" />

          {/* Near-term total */}
          <div className="px-6 py-4 shrink-0">
            <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/30 mb-1">
              Near-term total
            </p>
            <p className="text-[22px] font-bold tabular-nums leading-none font-mono"
              style={{ color: "var(--color-wheat)" }}>
              {fmtRev(nearTotal)}
            </p>
          </div>
        </div>

        {/* SVG area chart */}
        <div className="relative px-4 pt-3 pb-0">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width="100%"
            height={SVG_H}
            preserveAspectRatio="none"
            style={{ display: "block", overflow: "visible" }}
          >
            <defs>
              {/* Gradient for operator area */}
              <linearGradient id="op-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
              </linearGradient>
              {/* Gradient for gov area */}
              <linearGradient id="gov-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(232,197,71,0.18)" />
                <stop offset="100%" stopColor="rgba(232,197,71,0.04)" />
              </linearGradient>
              {/* Gradient for adjacency area */}
              <linearGradient id="adj-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(42,111,102,0.30)" />
                <stop offset="100%" stopColor="rgba(42,111,102,0.06)" />
              </linearGradient>
            </defs>

            {/* Y-axis reference lines */}
            {Y_REFS.map((ref) => {
              if (ref > MAX_Y) return null;
              const y = yS(ref);
              return (
                <g key={ref}>
                  <line
                    x1={0} y1={y} x2={SVG_W} y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={4} y={y - 3}
                    fill="rgba(255,255,255,0.20)"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    {fmtRev(ref)}
                  </text>
                </g>
              );
            })}

            {/* Stacked area fills */}
            <path d={OP_AREA}  fill="url(#op-grad)" />
            <path d={GOV_AREA} fill="url(#gov-grad)" />
            <path d={ADJ_AREA} fill="url(#adj-grad)" />

            {/* Boundary stroke lines */}
            <path d={OP_LINE}  fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
            <path d={GOV_LINE} fill="none" stroke="rgba(232,197,71,0.65)"  strokeWidth={1.5} />
            <path d={ADJ_LINE} fill="none" stroke="rgba(64,180,160,0.60)"  strokeWidth={1.5} />

            {/* Adjacency "future layer" label — top-right corner of the band */}
            <text
              x={SVG_W - 5} y={PAD_T + 11}
              fill="rgba(64,180,160,0.45)"
              fontSize={9}
              fontFamily="monospace"
              textAnchor="end"
            >
              future layer
            </text>

            {/* Vertical position line */}
            <line
              x1={lineX} y1={PAD_T}
              x2={lineX} y2={SVG_H}
              stroke="rgba(255,255,255,0.50)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />

            {/* Position dots at each boundary */}
            <circle cx={lineX} cy={dotOp}  r={4} fill="rgba(255,255,255,0.85)" />
            <circle cx={lineX} cy={dotGov} r={4} fill="rgba(232,197,71,0.90)" />
            <circle cx={lineX} cy={dotAdj} r={4} fill="rgba(64,180,160,0.85)" />

            {/* Total callout above the top dot */}
            <text
              x={lineX + 8} y={dotAdj - 8}
              fill="rgba(255,255,255,0.65)"
              fontSize={11}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {fmtRev(opRev + govRev + adjRev)}
            </text>
          </svg>
        </div>

        {/* Slider + milestone row */}
        <div className="px-4 pb-4">
          <input
            type="range"
            min={0} max={100}
            value={slider}
            onChange={(e) => setSlider(Number(e.target.value))}
            className="w-full appearance-none cursor-ew-resize"
            style={{
              height: "3px",
              borderRadius: "2px",
              background: `linear-gradient(to right, rgba(255,255,255,0.45) ${slider}%, rgba(255,255,255,0.10) ${slider}%)`,
              accentColor: "var(--color-wheat)",
              outline: "none",
            }}
          />
          {/* Milestone labels — positioned to match SVG x scale */}
          <div className="relative h-5 mt-0.5">
            {X_MILESTONES.map(({ s, label }) => (
              <span
                key={s}
                className="absolute text-[9px] font-mono text-white/25 -translate-x-1/2"
                style={{ left: `${s}%` }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Three pool cards ── */}
      <div className="flex flex-col gap-3">
        {POOLS.map((pool) => (
          <div key={pool.id}
            className="rounded-[4px] border border-hairline bg-surface overflow-hidden">

            {/* Pool header */}
            <div
              className="flex items-start gap-5 p-4 pb-3"
              style={{ borderLeft: `3px solid ${pool.accentColor}` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
                    {pool.label}
                  </p>
                  {pool.future && (
                    <span
                      className="px-1.5 py-px rounded-sm text-[8px] font-bold uppercase tracking-[0.06em]"
                      style={{ background: "rgba(0,0,0,0.04)", color: "#6B7280", border: "1px solid rgba(0,0,0,0.10)" }}
                    >
                      Growth layer
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-graphite leading-relaxed max-w-3xl">
                  {pool.whoPays}
                </p>
              </div>
            </div>

            {/* Lever rows */}
            <div className="border-t border-hairline/50 divide-y divide-hairline/40">
              {pool.levers.map((lever) => (
                <div key={lever.name} className="flex items-start gap-4 px-4 py-2.5 pl-7">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-ink mb-0.5">{lever.name}</p>
                    <p className="text-[10px] text-graphite/70 leading-relaxed">{lever.plain}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
                    <div className="flex items-center gap-1">
                      {lever.obbba && (
                        <span
                          className="px-1 py-px rounded-sm text-[8px] font-bold uppercase tracking-[0.06em] whitespace-nowrap"
                          style={{ background: "#5C1F1112", color: "#5C1F11", border: "1px solid #5C1F1122" }}
                        >
                          {lever.obbba}
                        </span>
                      )}
                      <span
                        className="px-1.5 py-px rounded-sm text-[8px] font-bold uppercase tracking-[0.06em] whitespace-nowrap"
                        style={STATUS_CHIP[lever.status]}
                      >
                        {lever.status}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-muted text-right leading-tight">
                      {lever.range}
                    </span>
                  </div>
                </div>
              ))}
              {pool.bottomLine && (
                <div className="flex items-start gap-2 px-4 py-2.5 pl-7 bg-surface/60">
                  <span className="shrink-0 mt-[3px] text-[8px] font-bold uppercase tracking-[0.10em] text-muted/50">
                    ↳
                  </span>
                  <p className="text-[10px] font-mono text-graphite/55 leading-relaxed">
                    {pool.bottomLine}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
