"use client";
import { motion } from "motion/react";
import type { MotionValue } from "motion/react";
import { GEMINI_FIELD } from "../../lib/gemini-field";

interface GoogleGeminiEffectProps {
  pathLengths: MotionValue<number>[];
  phoneOpacity?: MotionValue<number>;
  milestoneOpacities?: MotionValue<number>[];
  usdaOpacity?: MotionValue<number>;
}

// Five representative SNAP states. Line color matches the chip so each path is
// traceable from its flag to the phone. Coordinates mirror StaticGeminiHero so
// the animated and reduced-motion versions stay consistent.
const STATES = [
  { abbr: "CA", color: "#003DA5", y: 110, crossY: 350, exitY: 258 },
  { abbr: "TX", color: "#BF0A30", y: 195, crossY: 315, exitY: 270 },
  { abbr: "NY", color: "#0056A2", y: 280, crossY: 280, exitY: 280 },
  { abbr: "FL", color: "#CC2233", y: 365, crossY: 245, exitY: 290 },
  { abbr: "WA", color: "#005C28", y: 450, crossY: 210, exitY: 302 },
];

// USDA → fan out to each state flag → ONE gentle crossover (the "mess") →
// converge at the phone → exit as a streamlined bundle that ALL ends at the
// final milestone (Receive feedback, x=1360).
const PATHS = STATES.map(
  (s) =>
    `M170 280 C280 280 320 ${s.y} 394 ${s.y} ` +
    `C560 ${s.y} 600 ${s.crossY} 720 ${s.crossY} ` +
    `C840 ${s.crossY} 850 281 860 280 ` +
    `C1010 280 1210 ${s.exitY} 1360 280`,
);

// Timeline of applying + the app feature that helps at each step.
const MILESTONES = [
  { label: "Draft application", sub: "Mae guides every answer", x: 1010, step: 1 },
  { label: "Complete interview", sub: "Prep + reminders", x: 1185, step: 2 },
  { label: "Receive feedback", sub: "Status + next steps", x: 1360, step: 3 },
];

export function GoogleGeminiEffect({
  pathLengths,
  phoneOpacity,
  milestoneOpacities,
  usdaOpacity,
}: GoogleGeminiEffectProps) {
  return (
    <div className="gemini-effect">
      <svg
        width="100%"
        viewBox="0 72 1440 416"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <filter id="civicaGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="civicaPhoneScreen">
            <rect x="823" y="196" width="74" height="170" rx="9" />
          </clipPath>
        </defs>

        {/* Turbulent "mess" field — the complexity of the rules, resolving to
            clarity at the app. Static (drawn once); only the flag lines animate. */}
        <g className="gemini-field">
          {GEMINI_FIELD.map((line, i) => (
            <path
              key={`field-${i}`}
              d={line.d}
              stroke={line.color}
              strokeWidth={line.width}
              strokeLinecap="round"
              fill="none"
              opacity={line.opacity}
            />
          ))}
        </g>

        {/* USDA single-source badge — fades in just after the lines start */}
        <motion.g style={usdaOpacity ? { opacity: usdaOpacity } : undefined}>
          <rect x="70" y="252" width="100" height="56" rx="7" fill="white" stroke="#2D5A45" strokeWidth="1.75" />
          <text x="120" y="278" textAnchor="middle" fontSize="15" fill="#2D5A45" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.06em">USDA</text>
          <text x="120" y="296" textAnchor="middle" fontSize="11" fill="#2A6F66" fontFamily="sans-serif" letterSpacing="0.04em">SNAP</text>
        </motion.g>

        {/* Animated paths — draw from USDA, cross once, converge, end at the last milestone */}
        {PATHS.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            stroke={STATES[i].color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            opacity={0.72}
            style={{ pathLength: pathLengths[i] }}
            filter="url(#civicaGlow)"
          />
        ))}

        {/* State flag chips */}
        {STATES.map((s, i) => (
          <g key={`chip-${i}`}>
            <rect x="290" y={s.y - 21} width="104" height="42" rx="6" fill="white" stroke="rgba(0,0,0,0.1)" strokeWidth="1.25" />
            <image href={`/flags/${s.abbr.toLowerCase()}.png`} x="299" y={s.y - 13} width="40" height="26" preserveAspectRatio="xMidYMid slice" />
            <rect x="299" y={s.y - 13} width="40" height="26" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.9" />
            <text x="370" y={s.y + 6} textAnchor="middle" fontSize="16" fill="rgba(0,0,0,0.74)" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.03em">{s.abbr}</text>
          </g>
        ))}

        {/* Phone at convergence — real Civica app screenshot. Fades in as lines arrive. */}
        <motion.g style={phoneOpacity ? { opacity: phoneOpacity } : undefined}>
          {/* Dark bezel — thin */}
          <rect x="819" y="192" width="82" height="178" rx="13" fill="#1A1714" />
          <image
            href="/civica-ios-screenshot.png"
            x="823"
            y="196"
            width="74"
            height="170"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#civicaPhoneScreen)"
          />
          {/* Dynamic island */}
          <rect x="847" y="199" width="26" height="6" rx="3" fill="#1A1714" />
          {/* Home indicator */}
          <rect x="848" y="360" width="24" height="3.5" rx="1.75" fill="rgba(255,255,255,0.6)" />
        </motion.g>

        {/* Milestones — each reveals as the streamlined line reaches it */}
        {MILESTONES.map((m, i) => (
          <motion.g
            key={`milestone-${i}`}
            style={milestoneOpacities?.[i] ? { opacity: milestoneOpacities[i] } : undefined}
          >
            <line x1={m.x} y1="234" x2={m.x} y2="326" stroke="rgba(45,90,69,0.22)" strokeWidth="1.25" strokeDasharray="4 4" />
            <rect x={m.x - 69} y="196" width="138" height="30" rx="5" fill="rgba(216,230,222,0.95)" stroke="rgba(45,90,69,0.3)" strokeWidth="1.25" />
            <text x={m.x} y="215" textAnchor="middle" fontSize="13" fill="#2D5A45" fontWeight="600" fontFamily="sans-serif">{m.label}</text>
            <circle cx={m.x} cy="346" r="14" fill="white" stroke="rgba(45,90,69,0.4)" strokeWidth="1.75" />
            <text x={m.x} y="351" textAnchor="middle" fontSize="11" fill="#2D5A45" fontWeight="700" fontFamily="sans-serif">{m.step}</text>
            <text x={m.x} y="384" textAnchor="middle" fontSize="11.5" fill="#6B655C" fontFamily="sans-serif">{m.sub}</text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}
