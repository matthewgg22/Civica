"use client";

// Competitive landscape — row-per-tier journey-map.
// Placed between P3 (error map) and P4 (verification stack).

const STAGES = ["Eligibility", "Intake", "Doc prep", "Submission", "Recert"] as const;
type Stage = (typeof STAGES)[number];

interface ExampleTool {
  label: string;
  domain: string;
  note?: string;
}

interface Liability {
  text: string;
  obbba?: string;
}

interface CompetitorRow {
  tier: string;
  /** Short descriptor shown as subtitle under the tier name. */
  description: string;
  /** Scale stat — market footprint in one concise phrase. */
  scale: string;
  tools: ExampleTool[];
  covers: Stage[];
  liabilities: Liability[];
  /** When true, render the teal "Civica powers this channel" accent. */
  civicaPartner?: boolean;
}

const ROWS: CompetitorRow[] = [
  {
    tier: "Screeners",
    description:
      "Free eligibility-check tools that ask a few income/household questions and tell the applicant whether they likely qualify — then hand them a link.",
    scale: "~40% of first-time CA SNAP applicants hit a screener before the portal (USDA FNS first-touch data)",
    tools: [
      { label: "Benefits.gov", domain: "benefits.gov" },
      { label: "findhelp.org", domain: "findhelp.org" },
      { label: "Single Stop", domain: "singlestop.org" },
    ],
    covers: ["Eligibility"],
    liabilities: [
      { text: "Hands the applicant a link and exits — no intake guidance, no document checklist, no packet." },
      {
        text: "Rules are baked in at launch and updated infrequently. ABAWD age-band expansion (18→54) may not be reflected; households screened eligible in May can be re-flagged in June.",
        obbba: "§10102",
      },
      {
        text: "Can't flag which households are at ABAWD risk before the application is filed — the mis-screen becomes the county's problem.",
        obbba: "§10102",
      },
    ],
  },
  {
    tier: "Civic-tech enrollment",
    description:
      "Free, donor-funded benefits-enrollment tools built by civic-tech nonprofits. They walk an applicant through the application questions and submit the packet to the county, then exit. Recertification, appeals, and OBBBA work-log retention are out of scope.",
    scale: "GetCalFresh (Code for America, launched 2015): ~80–100K CalFresh applications submitted annually in CA (~5–10% of new applications); mRelief national footprint smaller but covers ~36 states",
    tools: [
      { label: "GetCalFresh", domain: "getcalfresh.org", note: "Code for America" },
      { label: "mRelief", domain: "mrelief.com", note: "national, 36 states" },
    ],
    covers: ["Eligibility", "Intake", "Doc prep", "Submission"],
    liabilities: [
      {
        text: "Submission is the exit point. No recertification companion, no expiration calendar, no appeal drafter — when the 6- or 12-month renewal hits, the household navigates alone and most fall off.",
        obbba: "§10102",
      },
      {
        text: "Donor-funded model creates no economic engine for state-contract-grade reliability, labor-union or facility-operator distribution, or the overhead of OBBBA copy-compliance and verification-stack maintenance.",
      },
      {
        text: "Web-form flow primarily — limited mobile experience and no facility-coordinator deployment mode for duty-of-care operators (RCFE, Section 202, PACE).",
      },
    ],
  },
  {
    tier: "State portal",
    description:
      "California's official self-serve application — the primary channel for the 4.7M-household CalFresh caseload. No navigator, no coaching, no document pre-check.",
    scale: "Handles ~60% of new CA SNAP applications; 4.7M active CA CalFresh households (CDSS FY2025)",
    tools: [{ label: "BenefitsCal", domain: "benefitscal.com" }],
    covers: ["Eligibility", "Intake", "Doc prep", "Submission"],
    liabilities: [
      { text: "35–50% of applicants who start the form reach submission. No guidance means high drop-off at complex income and household-composition questions." },
      {
        text: "No earned-income documentation guidance — workers pick the wrong income category, creating a PER event that counts against CA's statewide penalty rate.",
        obbba: "§10105",
      },
      { text: "No doc pre-check before submission — missing documents cause delays, back-and-forth re-requests, and abandoned cases." },
      {
        text: "Recertification requires returning to the portal independently. No reminders, no companion, no appeal support if a renewal is denied procedurally.",
        obbba: "§10102",
      },
    ],
  },
  {
    tier: "CBOs (manual)",
    civicaPartner: true,
    description:
      "Community-Based Organizations — food banks, legal-aid offices, churches, workforce agencies — employing human navigators trained to walk applicants through SNAP paperwork by hand.",
    scale: "~1,200 SNAP-certified CBOs in CA; ~12% of new CA applications come through a navigator; capacity-capped at ~7 apps/navigator/month",
    tools: [
      { label: "Paper / manual intake", domain: "acf.hhs.gov" },
    ],
    covers: ["Eligibility", "Intake", "Doc prep", "Submission"],
    liabilities: [
      { text: "Hard capacity ceiling of ~7 apps per navigator per month. Waitlists are common; households who most need help often can't get an appointment." },
      { text: "Manual intake with no systematic income-verification logic — navigator judgment varies by person, producing inconsistent error rates across sites." },
      { text: "No doc pre-check at handoff → missing documents delay county decisions and increase the rate of procedural denials." },
      {
        text: "No recertification tracking system — households fall off the first 6-month renewal with no warning and no appeal support.",
        obbba: "§10102",
      },
      {
        text: "New ABAWD work-log requirement adds case complexity CBOs can't absorb at current capacity without tooling.",
        obbba: "§10102",
      },
    ],
  },
  {
    tier: "Post-approval",
    description:
      "Mobile apps for EBT card management after approval — balance lookup, transaction history, cashback offers. They never touched the application or recertification.",
    scale: "Propel: ~5M EBT cardholders nationally; EBT Edge: pre-installed by state processors on most CA EBT cards",
    tools: [
      { label: "EBT Edge", domain: "ebtedge.com", note: "1.9★ App Store" },
      { label: "Propel", domain: "joinpropel.com", note: "Fresh EBT" },
    ],
    covers: ["Submission"],
    liabilities: [
      {
        text: "Entered the relationship after approval — can't prevent any denial, PER event, or ABAWD termination. The damage is already done.",
        obbba: "§10102",
      },
      {
        text: "No recertification support. When a household gets a §10102 termination notice there is no warning, no work-log preparation, no appeal draft.",
        obbba: "§10102",
      },
      { text: "EBT Edge 1.9★ App Store — chronic UI and reliability complaints from the population with the least tolerance for friction." },
      { text: "Propel is better-rated but has the same structural gap: the advocate relationship started too late to prevent benefit loss." },
    ],
  },
];

function JourneyCoverage({ covers, dark = false }: { covers: Stage[]; dark?: boolean }) {
  // Use lastActiveIdx so coverage is always a contiguous block —
  // a gap in the middle reads as a bug, not intent.
  const lastActiveIdx = Math.max(...covers.map((s) => STAGES.indexOf(s)));

  const tealDot  = dark ? "rgba(125,211,202,0.85)" : "#2A6F66";
  const greyDot  = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";
  const tealLine = dark ? "rgba(125,211,202,0.30)" : "rgba(42,111,102,0.25)";
  const greyLine = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const tealText = dark ? "rgba(125,211,202,0.80)" : "#2A6F66";
  const greyText = dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)";

  return (
    <div className="flex items-start w-full">
      {STAGES.map((s, i) => {
        const active = i <= lastActiveIdx;
        const isLast = i === STAGES.length - 1;
        const lineActive = active && i < lastActiveIdx;

        return (
          <div key={s} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: active ? tealDot : greyDot }}
              />
              <span
                className="text-[9px] font-medium whitespace-nowrap"
                style={{ color: active ? tealText : greyText }}
              >
                {s}
              </span>
            </div>
            {!isLast && (
              <div
                className="flex-1 h-px mb-4"
                style={{ background: lineActive ? tealLine : greyLine }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function LandscapePanel() {
  return (
    <div className="rounded-[4px] border border-hairline bg-paper p-7">
      {/* Header */}
      <div className="mb-6">
        <p className="eyebrow mb-1.5">Part 4 · landscape · the gap nobody fills</p>
        <h3 className="text-[20px] font-semibold tracking-tight text-ink leading-tight">
          Every other tool exits before the hard part
        </h3>
        <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
          Four competing tiers map the SNAP space. Each one exits at intake
          or pre-screen — before the stages where errors actually get made.
          OBBBA&apos;s new penalties land exactly there. Civica is the only
          tool built for the back half of the journey.
        </p>
      </div>

      {/* Competitor rows */}
      <div className="flex flex-col gap-1.5">
        {ROWS.map((row) => (
          <div
            key={row.tier}
            className={[
              "rounded-[4px] border bg-surface",
              row.civicaPartner
                ? "border-l-[3px] border-hairline"
                : "border-hairline",
            ].join(" ")}
            style={row.civicaPartner ? { borderLeftColor: "#2A6F6660" } : undefined}
          >
            {/* ── Row 1: tier name + scale stat ── */}
            <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink whitespace-nowrap">
                  {row.tier}
                </p>
                {row.civicaPartner && (
                  <span
                    className="px-1.5 py-px rounded-sm text-[8px] font-bold uppercase tracking-[0.08em] whitespace-nowrap"
                    style={{ background: "#2A6F6618", color: "#2A6F66", border: "1px solid #2A6F6630" }}
                  >
                    Civica powers this
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted/70 italic leading-snug text-right max-w-[260px] shrink-0">
                {row.scale}
              </p>
            </div>

            {/* ── Row 2: tools inline ── */}
            <div className="flex items-center gap-4 px-4 pb-2 flex-wrap">
              {row.tools.map((tool) => (
                <div key={tool.domain} className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${tool.domain}&sz=32`}
                    alt=""
                    width={12}
                    height={12}
                    className="rounded-sm shrink-0 opacity-70"
                  />
                  <span className="text-[11px] font-medium text-graphite">{tool.label}</span>
                  {tool.note && (
                    <span className="text-[9px] text-muted">· {tool.note}</span>
                  )}
                </div>
              ))}
            </div>

            {/* ── Row 3: description ── */}
            <p className="text-[10px] text-graphite/60 leading-relaxed px-4 pb-3">
              {row.description}
            </p>

            {/* ── Journey strip — full width ── */}
            <div className="border-t border-hairline/40 bg-paper/50">
              <div className="px-4 py-2">
                <p className="text-[8px] uppercase tracking-[0.12em] font-semibold text-muted/50 mb-1.5">
                  Journey coverage
                </p>
                <JourneyCoverage covers={row.covers} />
              </div>
            </div>

            {/* ── Liabilities ── */}
            <div className="border-t border-hairline/40 px-4 py-3 flex flex-col gap-1.5">
              {row.liabilities.map((l, i) => (
                <div key={i} className="flex items-start gap-2">
                  {l.obbba ? (
                    <span
                      className="shrink-0 mt-px px-1 py-px rounded-sm text-[8px] font-bold uppercase tracking-[0.06em] whitespace-nowrap"
                      style={{
                        background: "#5C1F1112",
                        color: "#5C1F11",
                        border: "1px solid #5C1F1122",
                      }}
                    >
                      {l.obbba}
                    </span>
                  ) : (
                    <span className="shrink-0 mt-[6px] w-1 h-1 rounded-full bg-muted/35" />
                  )}
                  <p className="text-[11px] text-graphite leading-relaxed">{l.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Civica full-width arc — same stacked structure, dark bg */}
      <div
        className="rounded-[4px] mt-1.5"
        style={{ background: "#0D2B2B" }}
      >
        {/* Row 1: name + tagline */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/civica-mark.svg" alt="" width={13} height={13} className="opacity-60" />
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/90">
              Civica
            </p>
            <span
              className="px-1.5 py-px rounded-sm text-[8px] font-bold uppercase tracking-[0.08em] whitespace-nowrap"
              style={{ background: "#2A6F6640", color: "#7DD3CA", border: "1px solid #2A6F6660" }}
            >
              full journey
            </span>
          </div>
          <p className="text-[10px] text-white/30 italic">
            Lifts CBO capacity ~7 → ~23 apps / navigator / month
          </p>
        </div>

        {/* Row 2: description */}
        <p className="text-[10px] text-white/40 leading-relaxed px-4 pb-3">
          Applicant advocate — powers CBO navigators + direct enrollment. Advocate relationship
          holds through every renewal. OBBBA provisions §10102, §10105, §10106 covered at launch.
        </p>

        {/* Journey strip — all 5 lit */}
        <div className="border-t border-white/8">
          <div className="px-4 py-2">
            <p className="text-[8px] uppercase tracking-[0.12em] font-semibold text-white/25 mb-1.5">
              Journey coverage
            </p>
            <JourneyCoverage covers={[...STAGES]} dark={true} />
          </div>
        </div>

        {/* OBBBA chips row */}
        <div className="border-t border-white/8 px-4 py-2.5 flex items-center gap-3">
          <p className="text-[8px] uppercase tracking-[0.1em] font-semibold text-white/25 shrink-0">
            OBBBA covered
          </p>
          {(["§10102", "§10105", "§10106"] as const).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className="shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ background: "#C9922A20", color: "#C9922A", border: "1px solid #C9922A40" }}
              >
                ✓
              </span>
              <span className="text-[10px] font-mono text-white/50">{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
