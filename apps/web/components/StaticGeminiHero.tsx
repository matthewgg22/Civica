// Motion-free hero used as (a) the lazy-load fallback before the animated
// hero chunk arrives and (b) the render for users with prefers-reduced-motion.
// It shows the SAME story as the animation in its finished, fully-drawn state:
// USDA → a handful of states → Civica → Submit / Interview / Benefits. No tangle,
// no rAF, no scroll wiring — just a clean, legible diagram that paints instantly.

const STATES = [
  { abbr: "CA", flagColor: "#003DA5", y: 120 },
  { abbr: "TX", flagColor: "#BF0A30", y: 200 },
  { abbr: "NY", flagColor: "#0056A2", y: 280 },
  { abbr: "FL", flagColor: "#CC2233", y: 360 },
  { abbr: "WA", flagColor: "#005C28", y: 440 },
];

const MILESTONES = [
  { label: "Draft application", x: 985, step: 1 },
  { label: "Complete interview", x: 1165, step: 2 },
  { label: "Receive feedback", x: 1345, step: 3 },
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
          viewBox="0 0 1440 560"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Federal SNAP rules and many state rulebooks flow into the Civica app, which guides you to draft your application, complete your interview, and receive feedback."
        >
          <defs>
            <clipPath id="civicaPhoneScreenStatic">
              <rect x="826" y="214" width="58" height="136" rx="7" />
            </clipPath>
          </defs>

          {/* Converging lines — drawn solid, no tangle */}
          {STATES.map((s, i) => (
            <path
              key={`line-${i}`}
              d={`M150 280 C320 280 360 ${s.y} 470 ${s.y} C610 ${s.y} 700 280 855 280`}
              stroke={s.flagColor}
              strokeWidth="1.75"
              fill="none"
              strokeLinecap="round"
              opacity="0.65"
            />
          ))}
          {/* Clean exit lines to the milestones */}
          <path d="M855 280 C1000 280 1180 280 1390 280" stroke="#2D5A45" strokeWidth="2" fill="none" strokeLinecap="round" />

          {/* USDA source badge */}
          <rect x="92" y="262" width="58" height="36" rx="5" fill="white" stroke="#2D5A45" strokeWidth="1.5" />
          <text x="121" y="277" textAnchor="middle" fontSize="10" fill="#2D5A45" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.06em">USDA</text>
          <text x="121" y="290" textAnchor="middle" fontSize="8" fill="#2A6F66" fontFamily="sans-serif" letterSpacing="0.04em">SNAP</text>

          {/* State chips — real state flag + abbreviation */}
          {STATES.map((s, i) => (
            <g key={`chip-${i}`}>
              <rect x="244" y={s.y - 15} width="76" height="30" rx="5" fill="white" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
              <image href={`/flags/${s.abbr.toLowerCase()}.png`} x="251" y={s.y - 9} width="28" height="18" preserveAspectRatio="xMidYMid slice" />
              <rect x="251" y={s.y - 9} width="28" height="18" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.75" />
              <text x="300" y={s.y + 5} textAnchor="middle" fontSize="11" fill="rgba(0,0,0,0.72)" fontWeight="700" fontFamily="sans-serif" letterSpacing="0.03em">{s.abbr}</text>
            </g>
          ))}

          {/* Civica phone — real iOS app screenshot, thin (~3px) bezel */}
          <rect x="823" y="211" width="64" height="142" rx="10" fill="#1A1714" />
          <image
            href="/civica-ios-screenshot.png"
            x="826"
            y="214"
            width="58"
            height="136"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#civicaPhoneScreenStatic)"
          />
          <rect x="845" y="219" width="20" height="4.5" rx="2.25" fill="#1A1714" />
          <rect x="846" y="344" width="18" height="2.5" rx="1.25" fill="rgba(255,255,255,0.6)" />

          {/* Milestones — all visible */}
          {MILESTONES.map((m) => (
            <g key={`m-${m.step}`}>
              <line x1={m.x} y1="250" x2={m.x} y2="308" stroke="rgba(45,90,69,0.22)" strokeWidth="1" strokeDasharray="3 3" />
              <rect x={m.x - 58} y="228" width="116" height="22" rx="4" fill="rgba(216,230,222,0.9)" stroke="rgba(45,90,69,0.28)" strokeWidth="1" />
              <text x={m.x} y="243" textAnchor="middle" fontSize="9.5" fill="#2D5A45" fontWeight="600" fontFamily="sans-serif">{m.label}</text>
              <circle cx={m.x} cy="320" r="10" fill="white" stroke="rgba(45,90,69,0.35)" strokeWidth="1.5" />
              <text x={m.x} y="324" textAnchor="middle" fontSize="8" fill="#2D5A45" fontWeight="700" fontFamily="sans-serif">{m.step}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
