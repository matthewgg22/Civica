"use client";
import { motion } from "motion/react";
import type { MotionValue } from "motion/react";

interface GoogleGeminiEffectProps {
  pathLengths: MotionValue<number>[];
}

// 8 representative SNAP states — flag primary color drives badge left-stripe
const STATES = [
  { abbr: "CA", flagColor: "#003DA5", y: 65 },
  { abbr: "TX", flagColor: "#BF0A30", y: 138 },
  { abbr: "NY", flagColor: "#0056A2", y: 196 },
  { abbr: "WA", flagColor: "#005C28", y: 248 },
  { abbr: "FL", flagColor: "#CC2233", y: 312 },
  { abbr: "IL", flagColor: "#00247D", y: 364 },
  { abbr: "GA", flagColor: "#CC0000", y: 416 },
  { abbr: "AZ", flagColor: "#002868", y: 490 },
];

// Full path: USDA(60,280) → fan to state y → TANGLE ZONE (paths cross each other) →
// converge at Civica phone (720,280) → clean parallel exit → milestone checkpoints
const PATHS = [
  // CA: fans to top-left, dips sharply into lower tangle, converges up
  "M60 280 C120 280 165 65 210 65 C285 65 335 430 435 415 C525 400 625 285 690 281 C706 280 715 280 720 280 C740 280 808 260 862 258 C942 256 1012 258 1055 258 C1135 258 1192 259 1244 259 C1324 259 1404 258 1440 258",
  // TX: fans to upper-mid, crosses into lower-mid zone
  "M60 280 C120 280 165 138 210 138 C285 138 335 325 435 310 C525 296 625 284 690 281 C706 280 715 280 720 280 C740 280 808 263 862 262 C942 261 1012 263 1055 263 C1135 263 1192 263 1244 263 C1324 263 1404 263 1440 263",
  // NY: fans mid-upper, slight downward cross then returns
  "M60 280 C120 280 165 196 210 196 C285 196 335 375 435 358 C525 342 625 288 690 282 C706 281 715 280 720 280 C740 280 808 267 862 267 C942 267 1012 268 1055 268 C1135 268 1192 268 1244 268 C1324 268 1404 268 1440 268",
  // WA: near center-top, slight upward cross (reverses with FL)
  "M60 280 C120 280 165 248 210 248 C285 248 335 175 435 168 C525 168 625 272 690 278 C706 279 715 280 720 280 C740 280 808 271 862 271 C942 271 1012 272 1055 272 C1135 272 1192 272 1244 272 C1324 272 1404 272 1440 272",
  // FL: near center-bottom, crosses UP through WA zone
  "M60 280 C120 280 165 312 210 312 C285 312 335 185 435 178 C525 178 625 275 690 279 C706 280 715 280 720 280 C740 280 808 276 862 276 C942 276 1012 276 1055 276 C1135 276 1192 276 1244 276 C1324 276 1404 276 1440 276",
  // IL: fans below center, dramatically crosses UP through NY/TX zone
  "M60 280 C120 280 165 364 210 364 C285 364 335 130 435 120 C525 130 625 262 690 277 C706 279 715 280 720 280 C740 280 808 279 862 280 C942 280 1012 280 1055 280 C1135 280 1192 280 1244 280 C1324 280 1404 280 1440 280",
  // GA: lower zone, crosses sharply UP into TX region
  "M60 280 C120 280 165 416 210 416 C285 416 335 118 435 108 C525 120 625 258 690 277 C706 279 715 280 720 280 C740 280 808 283 862 284 C942 285 1012 284 1055 284 C1135 284 1192 284 1244 284 C1324 284 1404 284 1440 284",
  // AZ: bottom, most dramatic cross — shoots up through CA zone then back down
  "M60 280 C120 280 165 490 210 490 C285 490 335 55 435 48 C525 60 625 244 690 276 C706 279 715 280 720 280 C740 280 808 288 862 290 C942 292 1012 291 1055 291 C1135 291 1192 291 1244 291 C1324 291 1404 291 1440 291",
];

// Path stroke colors — pine/teal/amber cycling for visual variety
const COLORS = [
  "#2D5A45",
  "#2A6F66",
  "#1E4032",
  "#3D8A7A",
  "#C9922A",
  "#2A6F66",
  "#2D5A45",
  "#1E4032",
];

const MILESTONES = [
  { label: "Submit", x: 862 },
  { label: "Interview", x: 1055 },
  { label: "Benefits", x: 1244 },
];

export function GoogleGeminiEffect({ pathLengths }: GoogleGeminiEffectProps) {
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
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Soft glow at phone convergence point */}
        <ellipse cx="720" cy="280" rx="200" ry="140" fill="url(#civicaCenterGlow)" />

        {/* USDA single-source badge */}
        <rect x="4" y="262" width="56" height="34" rx="5" fill="white" stroke="#2D5A45" strokeWidth="1.5" />
        <text
          x="32"
          y="275"
          textAnchor="middle"
          fontSize="9"
          fill="#2D5A45"
          fontWeight="700"
          fontFamily="sans-serif"
          letterSpacing="0.07em"
        >
          USDA
        </text>
        <text
          x="32"
          y="288"
          textAnchor="middle"
          fontSize="7.5"
          fill="#2A6F66"
          fontFamily="sans-serif"
          letterSpacing="0.04em"
        >
          SNAP
        </text>

        {/* State flag-stripe badges */}
        {STATES.map((s, i) => (
          <g key={`state-${i}`}>
            {/* White badge body */}
            <rect
              x="128"
              y={s.y - 13}
              width="54"
              height="26"
              rx="4"
              fill="white"
              stroke="rgba(0,0,0,0.08)"
              strokeWidth="1"
            />
            {/* Left flag-color stripe — two rects to get rounded-left, flat-right */}
            <rect x="128" y={s.y - 13} width="12" height="26" rx="4" fill={s.flagColor} />
            <rect x="136" y={s.y - 13} width="4" height="26" fill={s.flagColor} />
            {/* Abbreviation */}
            <text
              x="162"
              y={s.y + 5}
              textAnchor="middle"
              fontSize="10.5"
              fill="rgba(0,0,0,0.72)"
              fontWeight="700"
              fontFamily="sans-serif"
              letterSpacing="0.03em"
            >
              {s.abbr}
            </text>
          </g>
        ))}

        {/* Animated paths — draw from USDA through tangle to phone to milestones */}
        {PATHS.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            stroke={COLORS[i]}
            strokeWidth={1.75}
            strokeLinecap="round"
            fill="none"
            style={{ pathLength: pathLengths[i] }}
            filter="url(#civicaGlow)"
          />
        ))}

        {/* Phone at convergence — white, pine accents, Civica in wheat */}
        <rect
          x="692"
          y="218"
          width="56"
          height="124"
          rx="9"
          stroke="rgba(45,90,69,0.3)"
          strokeWidth="1.5"
          fill="white"
        />
        {/* Dynamic island */}
        <rect x="706" y="226" width="28" height="6" rx="3" fill="rgba(45,90,69,0.15)" />
        {/* Screen UI rows */}
        <rect x="702" y="242" width="36" height="2.5" rx="1.25" fill="rgba(45,90,69,0.22)" />
        <rect x="702" y="250" width="28" height="2" rx="1" fill="rgba(45,90,69,0.13)" />
        <rect x="702" y="256" width="32" height="2" rx="1" fill="rgba(45,90,69,0.10)" />
        <rect x="702" y="262" width="20" height="2" rx="1" fill="rgba(45,90,69,0.10)" />
        {/* Civica wordmark in wheat/amber */}
        <text
          x="720"
          y="278"
          textAnchor="middle"
          fontSize="9"
          fill="#C9922A"
          fontWeight="700"
          fontFamily="sans-serif"
          letterSpacing="0.06em"
        >
          Civica
        </text>
        {/* CTA button */}
        <rect x="702" y="283" width="36" height="9" rx="2" fill="rgba(45,90,69,0.82)" />
        <text
          x="720"
          y="290"
          textAnchor="middle"
          fontSize="5"
          fill="white"
          fontFamily="sans-serif"
          fontWeight="600"
          letterSpacing="0.06em"
        >
          APPLY
        </text>
        {/* Home indicator */}
        <rect x="710" y="330" width="20" height="3" rx="1.5" fill="rgba(45,90,69,0.12)" />

        {/* Milestone checkpoints (static — paths animate through them) */}
        {MILESTONES.map((m, i) => (
          <g key={`milestone-${i}`}>
            {/* Vertical checkpoint line spanning path bundle */}
            <line
              x1={m.x}
              y1="250"
              x2={m.x}
              y2="308"
              stroke="rgba(45,90,69,0.22)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {/* Badge above */}
            <rect
              x={m.x - 38}
              y="228"
              width="76"
              height="22"
              rx="4"
              fill="rgba(216,230,222,0.9)"
              stroke="rgba(45,90,69,0.28)"
              strokeWidth="1"
            />
            <text
              x={m.x}
              y="243"
              textAnchor="middle"
              fontSize="9.5"
              fill="#2D5A45"
              fontWeight="600"
              fontFamily="sans-serif"
            >
              {m.label}
            </text>
            {/* Step number circle below */}
            <circle
              cx={m.x}
              cy="320"
              r="10"
              fill="white"
              stroke="rgba(45,90,69,0.35)"
              strokeWidth="1.5"
            />
            <text
              x={m.x}
              y="324"
              textAnchor="middle"
              fontSize="8"
              fill="#2D5A45"
              fontWeight="700"
              fontFamily="sans-serif"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
