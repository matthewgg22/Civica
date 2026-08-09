// Motion-free hero used as (a) the lazy-load fallback before the animated
// hero chunk arrives and (b) the render for users with prefers-reduced-motion.
// Same story as the animation, fully drawn: state flags (origins) → Civica app
// → Draft application / Complete interview / Receive feedback.

import { GEMINI_FIELD } from "../lib/gemini-field";

const STATES = [
  { abbr: "CA", flagColor: "#003DA5", y: 110 },
  { abbr: "TX", flagColor: "#BF0A30", y: 195 },
  { abbr: "NY", flagColor: "#0056A2", y: 280 },
  { abbr: "FL", flagColor: "#CC2233", y: 365 },
  { abbr: "WA", flagColor: "#005C28", y: 450 },
];

const MILESTONES = [
  { label: "Draft application", sub: "Demeter guides every answer", x: 1010, step: 1 },
  { label: "Complete interview", sub: "Prep + reminders", x: 1185, step: 2 },
  { label: "Receive feedback", sub: "Status + next steps", x: 1360, step: 3 },
];

export function StaticGeminiHero() {
  return (
    <section className="why-static-hero">
      <div className="container why-gemini-copy">
        <p className="eyebrow">Why Civica</p>
        <h1 className="why-gemini-headline">
          The rules are complicated.
          <br />
          Your application shouldn&rsquo;t be.
        </h1>
        <p className="why-gemini-sub">
          SNAP eligibility depends on income, household size, and rules that vary
          state&nbsp;by&nbsp;state. Civica walks you through every question — so you
          arrive at your application confident in every answer.
        </p>
      </div>

      <div className="gemini-effect">
        <svg
          width="100%"
          viewBox="0 72 1440 416"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Many state SNAP rulebooks flow into the Civica app, which guides you to draft your application, complete your interview, and receive feedback."
        >
          <defs>
            <filter id="flagShadowStatic" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.18" />
            </filter>
            <clipPath id="civicaPhoneScreenStatic">
              <rect x="823" y="196" width="74" height="170" rx="9" />
            </clipPath>
          </defs>

          {/* Turbulent "mess" field — complexity of the rules resolving to the app */}
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

          {/* Lines — drawn solid, emanating from each flag, all ending at the final milestone */}
          {STATES.map((s, i) => (
            <path
              key={`line-${i}`}
              d={`M170 ${s.y} C360 ${s.y} 520 280 860 280 C1080 280 1180 280 1360 280`}
              stroke={s.flagColor}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
            />
          ))}

          {/* State flags — clean swatches that ORIGIN each line on the left */}
          {STATES.map((s) => (
            <g key={`flag-${s.abbr}`}>
              <image
                href={`/flags/${s.abbr.toLowerCase()}.png`}
                x="58"
                y={s.y - 18}
                width="54"
                height="36"
                preserveAspectRatio="xMidYMid slice"
                filter="url(#flagShadowStatic)"
              />
              <rect x="58" y={s.y - 18} width="54" height="36" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1" />
              <text x="126" y={s.y + 6} fontSize="18" fill="#1A1714" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.02em">
                {s.abbr}
              </text>
            </g>
          ))}

          {/* Civica phone — real iOS app screenshot, thin bezel */}
          <rect x="819" y="192" width="82" height="178" rx="13" fill="#1A1714" />
          <image
            href="/civica-ios-screenshot.png"
            x="823"
            y="196"
            width="74"
            height="170"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#civicaPhoneScreenStatic)"
          />
          <rect x="847" y="199" width="26" height="6" rx="3" fill="#1A1714" />
          <rect x="848" y="360" width="24" height="3.5" rx="1.75" fill="rgba(255,255,255,0.6)" />

          {/* Milestones — timeline step + the app feature that helps */}
          {MILESTONES.map((m) => (
            <g key={`m-${m.step}`}>
              <line x1={m.x} y1="234" x2={m.x} y2="326" stroke="rgba(45,90,69,0.22)" strokeWidth="1.25" strokeDasharray="4 4" />
              <rect x={m.x - 69} y="196" width="138" height="30" rx="5" fill="rgba(216,230,222,0.95)" stroke="rgba(45,90,69,0.3)" strokeWidth="1.25" />
              <text x={m.x} y="215" textAnchor="middle" fontSize="13" fill="#2D5A45" fontWeight="600" fontFamily="sans-serif">{m.label}</text>
              <circle cx={m.x} cy="346" r="14" fill="white" stroke="rgba(45,90,69,0.4)" strokeWidth="1.75" />
              <text x={m.x} y="351" textAnchor="middle" fontSize="11" fill="#2D5A45" fontWeight="700" fontFamily="sans-serif">{m.step}</text>
              <text x={m.x} y="384" textAnchor="middle" fontSize="11.5" fill="#6B655C" fontFamily="sans-serif">{m.sub}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
