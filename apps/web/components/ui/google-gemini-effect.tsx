"use client";
import { motion } from "motion/react";
import type { MotionValue } from "motion/react";

interface GoogleGeminiEffectProps {
  pathLengths: MotionValue<number>[];
  phoneOpacity?: MotionValue<number>;
  milestoneOpacities?: MotionValue<number>[];
}

// Five representative SNAP states. Line color matches the chip so each path is
// traceable from its state to the phone. Layout coordinates mirror
// StaticGeminiHero so the animated and reduced-motion versions are consistent.
const STATES = [
  { abbr: "CA", color: "#003DA5", y: 120, crossY: 330, exitY: 272 },
  { abbr: "TX", color: "#BF0A30", y: 200, crossY: 300, exitY: 276 },
  { abbr: "NY", color: "#0056A2", y: 280, crossY: 280, exitY: 280 },
  { abbr: "FL", color: "#CC2233", y: 360, crossY: 260, exitY: 284 },
  { abbr: "WA", color: "#005C28", y: 440, crossY: 230, exitY: 288 },
];

// USDA → fan out to the state → ONE gentle crossover (the "mess") → converge at
// the phone → exit as a tight, near-parallel bundle (the "streamlined" payoff).
const PATHS = STATES.map(
  (s) =>
    `M150 280 C220 280 250 ${s.y} 310 ${s.y} ` +
    `C420 ${s.y} 470 ${s.crossY} 580 ${s.crossY} ` +
    `C710 ${s.crossY} 800 281 855 280 ` +
    `C960 280 1120 ${s.exitY} 1390 ${s.exitY}`,
);

// The steps Civica actually helps you through, after your draft leaves the app.
const MILESTONES = [
  { label: "Draft application", x: 985, step: 1 },
  { label: "Complete interview", x: 1165, step: 2 },
  { label: "Receive feedback", x: 1345, step: 3 },
];

export function GoogleGeminiEffect({
  pathLengths,
  phoneOpacity,
  milestoneOpacities,
}: GoogleGeminiEffectProps) {
  return (
    <div className="gemini-effect">
      <svg
        width="100%"
        viewBox="0 0 1440 560"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="civicaCenterGlow" cx="50%" cy="50%" r="28%">
            <stop offset="0%" stopColor="rgba(45,90,69,0.09)" />
            <stop offset="100%" stopColor="rgba(247,245,239,0)" />
          </radialGradient>
          <filter id="civicaGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="civicaPhoneScreen">
            <rect x="826" y="214" width="58" height="136" rx="7" />
          </clipPath>
        </defs>

        {/* Soft glow at the phone convergence point */}
        <ellipse cx="855" cy="280" rx="190" ry="130" fill="url(#civicaCenterGlow)" />

        {/* USDA single-source badge */}
        <rect x="92" y="262" width="58" height="36" rx="5" fill="white" stroke="#2D5A45" strokeWidth="1.5" />
        <text x="121" y="277" textAnchor="middle" fontSize="10" fill="#2D5A45" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.06em">USDA</text>
        <text x="121" y="290" textAnchor="middle" fontSize="8" fill="#2A6F66" fontFamily="sans-serif" letterSpacing="0.04em">SNAP</text>

        {/* Animated paths — draw from USDA, cross once, converge, exit clean */}
        {PATHS.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            stroke={STATES[i].color}
            strokeWidth={1.75}
            strokeLinecap="round"
            fill="none"
            opacity={0.7}
            style={{ pathLength: pathLengths[i] }}
            filter="url(#civicaGlow)"
          />
        ))}

        {/* State chips — larger and legible */}
        {STATES.map((s, i) => (
          <g key={`chip-${i}`}>
            <rect x="250" y={s.y - 14} width="60" height="28" rx="4" fill="white" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
            <rect x="250" y={s.y - 14} width="13" height="28" rx="4" fill={s.color} />
            <rect x="259" y={s.y - 14} width="4" height="28" fill={s.color} />
            <text x="288" y={s.y + 5} textAnchor="middle" fontSize="12" fill="rgba(0,0,0,0.72)" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.03em">{s.abbr}</text>
          </g>
        ))}

        {/* Phone at convergence — real Civica app screenshot. Fades in as lines arrive. */}
        <motion.g style={phoneOpacity ? { opacity: phoneOpacity } : undefined}>
          {/* Dark bezel */}
          <rect x="820" y="208" width="70" height="148" rx="12" fill="#1A1714" />
          {/* Real iOS screenshot, clipped to the screen */}
          <image
            href="/civica-ios-screenshot.png"
            x="826"
            y="214"
            width="58"
            height="136"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#civicaPhoneScreen)"
          />
          {/* Dynamic island */}
          <rect x="845" y="219" width="20" height="4.5" rx="2.25" fill="#1A1714" />
          {/* Home indicator */}
          <rect x="846" y="344" width="18" height="2.5" rx="1.25" fill="rgba(255,255,255,0.6)" />
        </motion.g>

        {/* Milestones — each reveals as the streamlined line reaches it */}
        {MILESTONES.map((m, i) => (
          <motion.g
            key={`milestone-${i}`}
            style={milestoneOpacities?.[i] ? { opacity: milestoneOpacities[i] } : undefined}
          >
            <line x1={m.x} y1="250" x2={m.x} y2="308" stroke="rgba(45,90,69,0.22)" strokeWidth="1" strokeDasharray="3 3" />
            <rect x={m.x - 58} y="228" width="116" height="22" rx="4" fill="rgba(216,230,222,0.9)" stroke="rgba(45,90,69,0.28)" strokeWidth="1" />
            <text x={m.x} y="243" textAnchor="middle" fontSize="9.5" fill="#2D5A45" fontWeight="600" fontFamily="sans-serif">{m.label}</text>
            <circle cx={m.x} cy="320" r="10" fill="white" stroke="rgba(45,90,69,0.35)" strokeWidth="1.5" />
            <text x={m.x} y="324" textAnchor="middle" fontSize="8" fill="#2D5A45" fontWeight="700" fontFamily="sans-serif">{m.step}</text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}
