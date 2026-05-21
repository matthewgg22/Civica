/**
 * VerificationStackPanel — pillar 4 of /compliance.
 *
 * Three flagship phone mockups (product proof) + a 4-column coverage matrix
 * (analytical view). Matrix groups all 14 tools by audit category so
 * investors and state partners see coverage depth and evidence strength
 * at a glance — not a wall of rows.
 *
 * Data: `lib/analytics/verification-stack.ts`.
 */
import type {
  VerificationTool,
  VerificationTier,
  VerificationStatus,
  VerificationGroup,
} from "../../lib/analytics/verification-stack";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const TIER_META: Record<VerificationTier, { color: string; bg: string; hint: string }> = {
  Strong:        { color: "#C9922A", bg: "rgba(201,146,42,0.10)", hint: "third-party data source" },
  Moderate:      { color: "#B5511E", bg: "rgba(181,81,30,0.10)",  hint: "derived from intake answers" },
  Weak:          { color: "#9C3A24", bg: "rgba(156,58,36,0.10)",  hint: "applicant self-reports" },
  Discretionary: { color: "#5A544D", bg: "rgba(90,84,77,0.10)",   hint: "navigator judgment" },
};

// ---------------------------------------------------------------------------
// Target cohorts — Shape B: two parallel motions
//   - Students: proof of complexity-handling (the §10102 exemption-pathway
//     wedge, where Civica's engine outperforms traditional intake)
//   - Elderly 60+: scale where rules are simple (largest TAM, recert
//     companion is purpose-built, OBBBA work requirement doesn't apply)
// ---------------------------------------------------------------------------

type Cohort = "students" | "elderly";

const COHORT_META: Record<Cohort, { label: string; short: string; color: string; bg: string; border: string }> = {
  students: {
    label: "Working college students",
    short: "STU",
    // Teal — cohort identifier, intentionally distinct from amber/wheat
    // which are reserved for status/attention roles (Live, Partial, etc.).
    color: "#2A6F66",
    bg: "rgba(42,111,102,0.08)",
    border: "rgba(42,111,102,0.30)",
  },
  elderly: {
    label: "Elderly 60+",
    short: "60+",
    color: "#5C1F11",
    bg: "rgba(92,31,17,0.08)",
    border: "rgba(92,31,17,0.30)",
  },
};

// Per-tool cohort relevance — drives the dot tags in the coverage matrix.
// Most tools serve both cohorts; only the differentiating tools are tagged.
const TOOL_COHORT_RELEVANCE: Record<string, Cohort[]> = {
  "Argyle payroll connection": ["students"],
  "TANF / SSI categorical question + California BBCE auto-route": ["elderly"],
  "Receipt or invoice upload": [],
  "Self-attested asset declaration": [],
  "Photo ID upload + on-device document classifier": [],
  "Lease or mortgage upload + on-device OCR": [],
  "Self-attested utility flags + deterministic allowance schedule": ["elderly"],
  "Sublease classifier": ["students"],
  "Phantom recert (60-day shadow run)": ["elderly"],
  "Expiration calendar": ["elderly"],
  "Just-in-time reminders (push + SMS)": ["elderly"],
  "AI-refreshed renewal packet": ["elderly"],
  "EBT balance + transaction visibility": ["students", "elderly"],
  "Navigator distress-review gate": [],
  "Procedural appeal drafter": ["elderly"],
};

function CohortBadge({ cohort }: { cohort: Cohort }) {
  const m = COHORT_META[cohort];
  return (
    <span
      className="inline-flex items-center justify-center px-1 py-0 rounded-sm text-[8px] font-bold tracking-wide whitespace-nowrap leading-none h-3.5 ml-1"
      style={{ color: m.color, background: m.bg, border: `0.5px solid ${m.border}` }}
      title={m.label}
    >
      {m.short}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Coverage matrix — how all 14 tools map to QC audit categories
// ---------------------------------------------------------------------------

interface MatrixCategory {
  id: string;
  title: string;
  subtitle: string;
  toolNames: string[];
}

const MATRIX_CATEGORIES: MatrixCategory[] = [
  {
    id: "income",
    title: "Income & assets",
    subtitle: "Primary source of QC overissuance",
    toolNames: [
      "Argyle payroll connection",
      "TANF / SSI categorical question + California BBCE auto-route",
      "Receipt or invoice upload",
      "Self-attested asset declaration",
    ],
  },
  {
    id: "identity",
    title: "Identity & housing",
    subtitle: "Residency + shelter deduction accuracy",
    toolNames: [
      "Photo ID upload + on-device document classifier",
      "Lease or mortgage upload + on-device OCR",
      "Self-attested utility flags + deterministic allowance schedule",
      "Sublease classifier",
    ],
  },
  {
    id: "renewal",
    title: "Renewal pipeline",
    subtitle: "Preventing 6–12 month recert drop-off",
    toolNames: [
      "EBT balance + transaction visibility",
      "Phantom recert (60-day shadow run)",
      "Expiration calendar",
      "Just-in-time reminders (push + SMS)",
      "AI-refreshed renewal packet",
    ],
  },
  {
    id: "recovery",
    title: "Post-denial & oversight",
    subtitle: "Procedural recovery + navigator safeguard",
    toolNames: [
      "Navigator distress-review gate",
      "Procedural appeal drafter",
    ],
  },
];

// Short display names for the matrix chips (full names are too long)
const TOOL_SHORT_NAMES: Record<string, string> = {
  "Argyle payroll connection": "Argyle payroll",
  "TANF / SSI categorical question + California BBCE auto-route": "TANF/SSI + BBCE route",
  "Receipt or invoice upload": "Dependent care receipt",
  "Self-attested asset declaration": "Asset declaration",
  "Photo ID upload + on-device document classifier": "Photo ID + classifier",
  "Lease or mortgage upload + on-device OCR": "Lease / mortgage OCR",
  "Self-attested utility flags + deterministic allowance schedule": "Utility flags + HCSUA",
  "Sublease classifier": "Sublease classifier",
  "Phantom recert (60-day shadow run)": "Phantom recert · 60-day",
  "Expiration calendar": "Expiration calendar",
  "Just-in-time reminders (push + SMS)": "Just-in-time reminders",
  "AI-refreshed renewal packet": "AI-refreshed packet",
  "EBT balance + transaction visibility": "EBT balance + transactions",
  "Navigator distress-review gate": "Distress review gate",
  "Procedural appeal drafter": "Procedural appeal drafter",
};

function CoverageMatrix({ tools }: { tools: VerificationTool[] }) {
  const byName = Object.fromEntries(tools.map((t) => [t.tool, t]));

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-3">
        Coverage matrix — all {tools.length} tools by QC audit category
      </p>
      <div className="grid grid-cols-4 gap-3">
        {MATRIX_CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className="rounded-sm border border-hairline/60 bg-paper/60 overflow-hidden"
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-hairline/50 bg-paper/80">
              <p className="text-[11px] font-semibold text-ink leading-tight">
                {cat.title}
              </p>
              <p className="text-[10px] text-muted mt-0.5 leading-snug">
                {cat.subtitle}
              </p>
            </div>

            {/* Tool chips */}
            <div className="px-3 py-2.5 flex flex-col gap-1.5">
              {cat.toolNames.map((name) => {
                const tool = byName[name];
                if (!tool) return null;
                const meta = TIER_META[tool.tier];
                const isPlanned = tool.status === "Planned";
                return (
                  <div
                    key={name}
                    className={`flex items-start gap-1.5 ${isPlanned ? "opacity-50" : ""}`}
                  >
                    <span
                      className="mt-[3px] w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: meta.color }}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-[11px] font-semibold leading-snug"
                        style={{ color: meta.color }}
                      >
                        {TOOL_SHORT_NAMES[name] ?? name}
                        {(TOOL_COHORT_RELEVANCE[name] ?? []).map((c) => (
                          <CohortBadge key={c} cohort={c} />
                        ))}
                      </p>
                      <p className="text-[10px] text-muted leading-tight mt-0.5">
                        {tool.tier}{isPlanned ? " · roadmap" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Engagement-loop callout — explains why EBT visibility is the
          connective tissue for the renewal column */}
      <div className="mt-4 rounded-sm border-l-4 border-[#5C1F11] bg-[rgba(92,31,17,0.04)] p-3.5">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#5C1F11] mb-1.5">
          Why EBT balance visibility multiplies the recert companion
        </p>
        <p className="text-[12px] text-graphite leading-relaxed">
          The recert reminders, expiration calendar, and phantom recert dry-run all assume the
          household will open Civica when prompted. <span className="font-semibold text-ink">EBT
          balance + transaction visibility</span> is what makes that assumption true — households
          open the app every month to check their balance (every reload day, every grocery trip).
          When the recert reminder fires three months out, it lands on a user who has touched
          Civica twelve times this year, not a cold contact. The engagement loop is the moat:
          without it, every other tool in this column ships into a dark inbox.
        </p>
        <p className="text-[10px] text-muted italic leading-snug mt-2">
          EBT integration is on the roadmap (CA: FIS via ebt.ca.gov pipeline). Interim path:
          user-pasted balance + receipt OCR.
        </p>
      </div>

      {/* Tier breakdown bar */}
      <TierBar tools={tools} />
    </div>
  );
}

function TierBar({ tools }: { tools: VerificationTool[] }) {
  const live = tools.filter((t) => t.status === "Live");
  const counts: Record<VerificationTier, number> = {
    Strong: 0, Moderate: 0, Weak: 0, Discretionary: 0,
  };
  live.forEach((t) => counts[t.tier]++);
  const total = live.length;

  return (
    <div className="mt-4 pt-4 border-t border-hairline/40">
      <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-2">
        Evidence tier breakdown · {total} live tools
      </p>
      <div className="flex rounded-full overflow-hidden h-2">
        {(Object.entries(counts) as [VerificationTier, number][])
          .filter(([, n]) => n > 0)
          .map(([tier, n]) => (
            <div
              key={tier}
              style={{
                width: `${(n / total) * 100}%`,
                background: TIER_META[tier].color,
              }}
              title={`${tier}: ${n}`}
            />
          ))}
      </div>
      <div className="flex gap-4 mt-1.5">
        {(Object.entries(counts) as [VerificationTier, number][])
          .filter(([, n]) => n > 0)
          .map(([tier, n]) => (
            <span key={tier} className="text-[10px] text-muted flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: TIER_META[tier].color }} />
              {tier} {n}
            </span>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flagship strip — 3 phone mockups with outcome captions
// ---------------------------------------------------------------------------

interface FlagshipTool {
  toolName: string;
  painPoint: string;
  caption: string;
  screen: MockupScreen;
}

type MockupAnswerType = "yesno" | "upload" | "status" | "alert" | "checklist" | "draft";

interface MockupScreen {
  eyebrow?: string;
  question: string;
  answer?: string;
  answerType: MockupAnswerType;
  progress?: number;
}

const FLAGSHIPS: FlagshipTool[] = [
  {
    toolName: "Argyle payroll connection",
    painPoint: "Earned income verification",
    caption: "Authenticated pay data pulled directly from ADP, Gusto, or Paychex — no paystub upload, no manual re-key.",
    screen: {
      eyebrow: "INCOME",
      question: "Connect your payroll provider",
      answer: "ADP · verified ✓",
      answerType: "status",
      progress: 35,
    },
  },
  {
    toolName: "Photo ID upload + on-device document classifier",
    painPoint: "Identity verification",
    caption: "On-device classifier identifies document type and checks name match in seconds — no data leaves the phone until consent.",
    screen: {
      eyebrow: "IDENTITY",
      question: "Upload your government-issued ID",
      answerType: "upload",
      progress: 45,
    },
  },
  {
    toolName: "Phantom recert (60-day shadow run)",
    painPoint: "Renewal failure prevention",
    caption: "60-day dry-run of the renewal interview using stored answers — surfaces doc gaps before they cause a real denial.",
    screen: {
      eyebrow: "RENEWAL PREVIEW",
      question: "60-day renewal dry-run",
      answerType: "checklist",
      progress: 80,
    },
  },
];

function MockupAnswerUI({ screen }: { screen: MockupScreen }) {
  const teal = "#C9922A";
  const muted = "#6B655C";
  const ink = "#1A1714";
  const hairline = "rgba(0,0,0,0.10)";

  switch (screen.answerType) {
    case "yesno":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {["Yes", "No"].map((label, i) => (
            <div key={label} style={{ borderRadius: 3, border: `1px solid ${i === 0 ? teal : hairline}`, background: i === 0 ? "rgba(201,146,42,0.08)" : "transparent", padding: "3px 6px", textAlign: "center", fontSize: 6, fontWeight: 700, color: i === 0 ? teal : muted }}>
              {label}
            </div>
          ))}
        </div>
      );
    case "upload":
      return (
        <div style={{ borderRadius: 3, border: "1px dashed rgba(0,0,0,0.18)", background: "rgba(201,146,42,0.04)", padding: "10px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(201,146,42,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 9, color: teal, lineHeight: 1 }}>↑</span>
          </div>
          <span style={{ fontSize: 5, color: muted, fontWeight: 600 }}>Tap to upload</span>
        </div>
      );
    case "status":
      return (
        <div style={{ borderRadius: 3, background: "rgba(201,146,42,0.10)", border: "1px solid rgba(201,146,42,0.20)", padding: "4px 6px", display: "flex", alignItems: "center", gap: 3 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: teal, flexShrink: 0 }} />
          <span style={{ fontSize: 5.5, color: teal, fontWeight: 700 }}>{screen.answer}</span>
        </div>
      );
    case "alert":
      return (
        <div style={{ borderRadius: 3, background: "rgba(181,81,30,0.09)", border: "1px solid rgba(181,81,30,0.22)", padding: "4px 5px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
            <span style={{ fontSize: 6, lineHeight: 1 }}>⚠</span>
            <span style={{ fontSize: 5.5, fontWeight: 700, color: "#B5511E" }}>Review required</span>
          </div>
          <p style={{ fontSize: 4.5, color: "#B5511E", lineHeight: 1.3, margin: 0 }}>{screen.answer}</p>
        </div>
      );
    case "checklist":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {[{ label: "Income", done: true }, { label: "Identity", done: true }, { label: "Lease", done: false }].map(({ label, done }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: done ? teal : "transparent", border: `1px solid ${done ? teal : hairline}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {done && <span style={{ fontSize: 5, color: "#fff", fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: 5.5, color: done ? ink : muted, fontWeight: done ? 600 : 400 }}>{label}</span>
            </div>
          ))}
        </div>
      );
    case "draft":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[100, 80, 100, 65].map((w, i) => (
            <div key={i} style={{ height: 3.5, background: i < 3 ? "rgba(201,146,42,0.15)" : "rgba(0,0,0,0.07)", borderRadius: 2, width: `${w}%` }} />
          ))}
          <div style={{ marginTop: 4, borderRadius: 3, background: teal, padding: "3.5px 0", textAlign: "center" }}>
            <span style={{ fontSize: 5.5, color: "#fff", fontWeight: 700 }}>Review &amp; confirm</span>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function PhoneMockup({ screen }: { screen: MockupScreen }) {
  const progress = screen.progress ?? 50;
  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        width: 96,
        height: 168,
        borderRadius: 9,
        overflow: "hidden",
        background: "#FAFAF8",
        border: "1.5px solid rgba(0,0,0,0.13)",
        boxShadow: "0 3px 12px rgba(0,0,0,0.10), inset 0 0 0 0.5px rgba(255,255,255,0.7)",
      }}
    >
      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 8px 1px" }}>
        <span style={{ fontSize: 4.5, fontWeight: 600, color: "#1A1714", fontVariantNumeric: "tabular-nums" }}>9:41</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
          {[0.45, 0.62, 0.8, 1].map((h, i) => (
            <div key={i} style={{ width: 1.5, height: 5 * h, background: i < 3 ? "#1A1714" : "rgba(0,0,0,0.22)", borderRadius: 0.5 }} />
          ))}
          <div style={{ width: 10, height: 5, border: "1px solid rgba(0,0,0,0.28)", borderRadius: 1.5, marginLeft: 2, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: "1px", width: "72%", background: "#1A1714", borderRadius: 0.5 }} />
          </div>
        </div>
      </div>
      {/* Nav bar */}
      <div style={{ height: 14, background: "rgba(45,90,69,0.07)", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", padding: "0 8px", justifyContent: "space-between" }}>
        <span style={{ fontSize: 5, fontWeight: 800, letterSpacing: "0.14em", color: "#2D5A45", textTransform: "uppercase" }}>CIVICA</span>
        <div style={{ display: "flex", gap: 2 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(0,0,0,0.12)" }} />)}
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ height: 2, background: "rgba(0,0,0,0.05)" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "#C9922A", borderRadius: "0 1px 1px 0" }} />
      </div>
      {/* Content */}
      <div style={{ padding: "7px 8px 14px" }}>
        {screen.eyebrow && (
          <p style={{ fontSize: 4.5, fontWeight: 700, letterSpacing: "0.1em", color: "#6B655C", textTransform: "uppercase", marginBottom: 3, marginTop: 0 }}>
            {screen.eyebrow}
          </p>
        )}
        <p style={{ fontSize: 7, fontWeight: 700, color: "#1A1714", lineHeight: 1.3, marginBottom: 8, marginTop: 0 }}>
          {screen.question}
        </p>
        <MockupAnswerUI screen={screen} />
      </div>
      {/* Home indicator */}
      <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 24, height: 2, background: "rgba(0,0,0,0.16)", borderRadius: 2 }} />
      </div>
    </div>
  );
}

function FlagshipStrip({ tools }: { tools: VerificationTool[] }) {
  const byName = Object.fromEntries(tools.map((t) => [t.tool, t]));

  return (
    <div className="mb-6 pb-6 border-b border-hairline">
      <div className="grid grid-cols-3 gap-5">
        {FLAGSHIPS.map(({ toolName, painPoint, caption, screen }) => {
          const tool = byName[toolName];
          const tier = tool ? TIER_META[tool.tier] : TIER_META.Moderate;
          return (
            <div key={toolName} className="flex flex-col items-center text-center gap-3">
              <PhoneMockup screen={screen} />
              <div>
                <p className="text-[9px] uppercase tracking-[0.13em] font-semibold text-muted mb-0.5">
                  {painPoint}
                </p>
                <p className="text-[12px] font-semibold text-ink leading-snug mb-1.5">
                  {TOOL_SHORT_NAMES[toolName] ?? toolName}
                </p>
                <p className="text-[11px] text-graphite leading-snug">
                  {caption}
                </p>
                {tool && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold mt-2"
                    style={{ color: tier.color, background: tier.bg }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: tier.color }} />
                    {tool.tier}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-muted text-center italic">
        Same screens run in two modes: applicant-driven on their own phone,
        <span className="text-graphite font-semibold not-italic"> or coordinator-driven on a shared device </span>
        in a campus basic-needs office or senior housing services room.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier legend
// ---------------------------------------------------------------------------

function TierLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-6 pb-5 border-b border-hairline">
      <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted self-center mr-1">
        Evidence tiers
      </span>
      {(Object.entries(TIER_META) as [VerificationTier, typeof TIER_META[VerificationTier]][]).map(
        ([tier, meta]) => (
          <span key={tier} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
            <span className="font-semibold" style={{ color: meta.color }}>{tier}</span>
            <span className="text-muted">— {meta.hint}</span>
          </span>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cohort header strip — Shape B parallel motions
// ---------------------------------------------------------------------------

interface CohortCardData {
  cohort: Cohort;
  tagline: string;
  whatItProves: string;
  gap: string;
  gapPct: string;
  channel: string;
  channelSize: string;
  loadBearingTools: string;
  recertAcuity: string;
  obbbaImplication: string;
  pilotStatus: string;
}

const COHORT_CARDS: CohortCardData[] = [
  {
    cohort: "students",
    tagline: "Engine handles complex eligibility",
    whatItProves: "Civica's exemption-pathway routing handles the rule-heavy edge cases (work-study, 20hr/wk, caregiving, TANF, SNAP E&T) that confuse traditional intake — the hardest eligibility logic in SNAP.",
    gap: "2.3M",
    gapPct: "66% of eligible not enrolled",
    channel: "Campus basic-needs coordinator",
    channelSize: "~115 CCC / UC / CSU campuses in CA pilot scope",
    loadBearingTools: "Argyle payroll · exemption routing · student-rule logic · sublease classifier",
    recertAcuity: "Medium · semester-boundary churn",
    obbbaImplication: "Subject to §10102's expanded work requirement (newly age 18-54). Civica's engine routes the exemption pathways that determine whether each student stays in scope or qualifies for an exception. The complexity itself is the wedge.",
    pilotStatus: "Cohort-of-10 underway · TODO-12",
  },
  {
    cohort: "elderly",
    tagline: "Scales fast where rules are simple",
    whatItProves: "Largest single under-enrolled cohort (3.5× the student gap) where eligibility is simple (no work req, no asset test in CA, often SSI-fast-tracked) and the recertification companion's value is highest — renewal failure is the primary drop-off for over-65.",
    gap: "8.1M",
    gapPct: "58% of eligible not enrolled",
    channel: "Senior housing services coordinator",
    channelSize: "~6,000 RCFE + ~700 HUD Section 202 + thousands of LIHTC senior buildings in CA",
    loadBearingTools: "EBT balance visibility (engagement loop) · Phantom Recert · Expiration Calendar · Just-in-Time Reminders · AI-refreshed packet · Procedural Appeal",
    recertAcuity: "High · the primary drop-off for over-65",
    obbbaImplication: "Out of scope for §10102's work requirement (over age 54). Adding low-error elderly to the state cohort actively drives down state PER, moving California away from §10105 / §10106 cost-share triggers — the engine's defensive benefit doubles as offense.",
    pilotStatus: "Channel work to start · senior housing coordinator track",
  },
];

function CohortHeaderStrip() {
  return (
    <div className="mb-6 pb-6 border-b border-hairline">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-1">
          Target users · two parallel motions
        </p>
        <h4 className="text-[16px] font-semibold tracking-tight text-ink leading-tight">
          Who Civica is optimized for — and what each cohort proves about the engine
        </h4>
        <p className="text-[12px] text-graphite mt-1 leading-snug max-w-3xl">
          Students prove the engine on SNAP&apos;s hardest eligibility surface; elderly is where the
          $8.1M-household TAM lives and where the recertification companion&apos;s value is highest.
          Different channels, different sales motions, same engine.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {COHORT_CARDS.map((c) => {
          const m = COHORT_META[c.cohort];
          return (
            <div
              key={c.cohort}
              className="rounded-[4px] p-4"
              style={{ background: m.bg, borderLeft: `4px solid ${m.color}` }}
            >
              <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                <span
                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold tracking-wide"
                  style={{ color: m.color, background: "rgba(255,255,255,0.6)", border: `0.5px solid ${m.border}` }}
                >
                  {m.short}
                </span>
                <h5 className="text-[15px] font-semibold tracking-tight text-ink leading-tight">
                  {m.label}
                </h5>
              </div>

              <p className="text-[12px] uppercase tracking-[0.10em] font-semibold mb-2" style={{ color: m.color }}>
                {c.tagline}
              </p>

              <p className="text-[12px] text-graphite leading-relaxed mb-3">
                {c.whatItProves}
              </p>

              <div className="flex items-baseline gap-4 mb-3 pb-3 border-b" style={{ borderColor: m.border }}>
                <div>
                  <p className="text-[32px] font-bold tabular-nums leading-none" style={{ color: m.color }}>
                    {c.gap}
                  </p>
                  <p className="text-[10px] text-graphite mt-0.5">{c.gapPct}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted">
                    Distribution channel
                  </p>
                  <p className="text-[12px] font-semibold text-ink leading-snug mt-0.5">
                    {c.channel}
                  </p>
                  <p className="text-[10px] text-graphite mt-0.5">{c.channelSize}</p>
                </div>
              </div>

              <dl className="space-y-1.5 text-[11px]">
                <div className="flex gap-2">
                  <dt className="text-muted font-semibold uppercase tracking-wider text-[9px] w-[80px] shrink-0 pt-0.5">Load-bearing</dt>
                  <dd className="text-graphite leading-snug">{c.loadBearingTools}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted font-semibold uppercase tracking-wider text-[9px] w-[80px] shrink-0 pt-0.5">Recert</dt>
                  <dd className="text-graphite leading-snug">{c.recertAcuity}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted font-semibold uppercase tracking-wider text-[9px] w-[80px] shrink-0 pt-0.5">OBBBA</dt>
                  <dd className="text-graphite leading-snug">{c.obbbaImplication}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted font-semibold uppercase tracking-wider text-[9px] w-[80px] shrink-0 pt-0.5">Pilot</dt>
                  <dd className="text-graphite leading-snug italic">{c.pilotStatus}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distribution math — addressable cohort by channel
// ---------------------------------------------------------------------------

function DistributionMath() {
  return (
    <div className="mt-6 pt-5 border-t border-hairline">
      <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-3">
        Distribution math · addressable cohort by channel at full California coverage
      </p>
      <div className="rounded-[4px] border border-hairline bg-paper p-4">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-hairline">
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold text-muted pb-2 pr-3">Channel</th>
              <th className="text-right text-[10px] uppercase tracking-wider font-semibold text-muted pb-2 pr-3">Coordinators</th>
              <th className="text-right text-[10px] uppercase tracking-wider font-semibold text-muted pb-2 pr-3">Per coordinator / yr</th>
              <th className="text-right text-[10px] uppercase tracking-wider font-semibold text-muted pb-2">≈ Annual enrollments</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-hairline/50">
              <td className="py-2.5 pr-3 text-ink">
                <span className="font-semibold">Campus basic-needs</span>
                <CohortBadge cohort="students" />
                <p className="text-[10px] text-muted leading-snug mt-0.5">CCC, UC, CSU — financial aid + basic needs offices</p>
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-graphite">~115</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-graphite">~100 students</td>
              <td className="py-2.5 text-right tabular-nums font-bold text-ink">~11K</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-ink">
                <span className="font-semibold">Senior housing services</span>
                <CohortBadge cohort="elderly" />
                <p className="text-[10px] text-muted leading-snug mt-0.5">RCFE, HUD Section 202, LIHTC senior — resident services coordinators</p>
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-graphite">~6,000+</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-graphite">~75 residents</td>
              <td className="py-2.5 text-right tabular-nums font-bold text-ink">~450K</td>
            </tr>
            <tr className="border-t-2 border-hairline">
              <td className="pt-2.5 text-[10px] uppercase tracking-wider font-semibold text-muted" colSpan={3}>
                Combined addressable cohort
              </td>
              <td className="pt-2.5 text-right tabular-nums font-bold text-[#5C1F11] text-[15px]">~461K / yr</td>
            </tr>
            <tr>
              <td className="text-[10px] text-graphite italic" colSpan={3}>
                ↳ at average per-cohort allotments
              </td>
              <td className="text-right tabular-nums font-semibold text-amber text-[12px]">
                ≈ $840M / yr in SNAP benefits to households
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-[10px] text-muted italic leading-snug mt-3">
          Senior housing channel is roughly 40× the campus channel in addressable households at full CA coverage —
          which is why students validate the engine fast and elderly is the scale play. The $840M figure is
          household-side value (11K students × ~$2,400/yr + 450K elderly × ~$1,800/yr); Civica&apos;s revenue is a
          small fraction, paid by the channel partner, never by the household.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monetization framework — layman value chain
// ---------------------------------------------------------------------------

function MonetizationFramework() {
  return (
    <div className="mt-6 pt-5 border-t border-hairline">
      <p className="text-[10px] uppercase tracking-[0.13em] font-semibold text-muted mb-3">
        How Civica gets paid · plain-English value chain
      </p>
      <div className="rounded-[4px] border border-hairline bg-paper p-5">
        <div className="space-y-4">
          {/* Step 1 — Household */}
          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-paper border border-hairline flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-semibold text-graphite tabular-nums">
              01
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink leading-tight">
                The household enrolls in SNAP and receives food benefits
              </p>
              <p className="text-[12px] text-graphite leading-snug mt-1">
                Elderly single household: <span className="font-semibold text-ink tabular-nums">~$1,800/year</span>.
                Student or working household: <span className="font-semibold text-ink tabular-nums">~$2,400/year</span>.
                The household never pays Civica anything.
              </p>
            </div>
          </div>

          {/* Step 2 — Org */}
          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-paper border border-hairline flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-semibold text-graphite tabular-nums">
              02
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink leading-tight">
                The org (campus, senior housing, county, CBO) uses Civica to enroll its people
              </p>
              <p className="text-[12px] text-graphite leading-snug mt-1">
                One coordinator drives the iPad or phone. Civica handles intake, document capture,
                eligibility logic, packet preparation, and renewal reminders. The org gets a tool that
                lets a non-specialist staffer run benefits enrollment at scale.
              </p>
            </div>
          </div>

          {/* Step 3 — Civica gets paid */}
          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-paper border border-hairline flex items-center justify-center flex-shrink-0 font-mono text-[10px] font-semibold text-graphite tabular-nums">
              03
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-ink leading-tight">
                The org pays Civica — three layered streams
              </p>
              <ul className="text-[12px] text-graphite leading-snug mt-1.5 space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-[#5C1F11] font-bold flex-shrink-0">·</span>
                  <span>
                    <span className="font-semibold text-ink">Per successful enrollment</span> — paid when a packet reaches handoff to the state.
                    Acquisition revenue, aligned with the org&apos;s own outreach metrics.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#5C1F11] font-bold flex-shrink-0">·</span>
                  <span>
                    <span className="font-semibold text-ink">Per active household per month</span> — recurring fee for renewal-cycle support.
                    The recert companion (Phantom Recert + Expiration Calendar + Reminders + Appeal drafter)
                    keeps households enrolled year over year, compounding revenue with retention.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#5C1F11] font-bold flex-shrink-0">·</span>
                  <span>
                    <span className="font-semibold text-ink">County-wide license</span> — enterprise tier for counties deploying Civica
                    across all their CBO + housing partners. Flat fee per county per year.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Sources of org funding */}
          <div className="mt-4 pt-4 border-t border-hairline/60">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-2">
              Where the org gets the money to pay Civica
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-sm bg-amber/5 border border-amber/15 p-3">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <CohortBadge cohort="students" />
                  <p className="text-[12px] font-semibold text-ink">Campus channel</p>
                </div>
                <p className="text-[11px] text-graphite leading-snug">
                  USDA SNAP outreach grants, CCC system basic-needs funding (~$30M+/yr in CA),
                  campus-level student-success budgets, county DSS pass-throughs.
                </p>
              </div>
              <div className="rounded-sm bg-[rgba(92,31,17,0.05)] border border-[rgba(92,31,17,0.15)] p-3">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <CohortBadge cohort="elderly" />
                  <p className="text-[12px] font-semibold text-ink">Senior housing channel</p>
                </div>
                <p className="text-[11px] text-graphite leading-snug">
                  Older Americans Act Title III-B funds, HUD service-coordinator budgets,
                  Area Agency on Aging contracts, county DSS contracts, senior housing operator
                  operations budgets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted italic leading-snug mt-3">
        Pricing is structural, not committal — exact rates are partner-by-partner. The model holds:
        Civica costs the org a small fraction of the value the household receives, and Civica scales
        with the partner&apos;s own success metric.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function VerificationStackPanel({
  tools,
  summary,
}: {
  tools: VerificationTool[];
  summary: {
    strongOrModerate: number;
    total: number;
    liveTools: number;
    recertTools: number;
  };
}) {
  return (
    <section
      aria-labelledby="verification-stack-title"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-7"
    >
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">
            Pillar 4 · verification stack · what Civica actually deploys
          </p>
          <h3
            id="verification-stack-title"
            className="text-[20px] font-semibold tracking-tight text-ink leading-tight"
          >
            How Civica pre-verifies an applicant — at intake, at renewal, after a denial
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-2xl leading-relaxed">
            Three flagship screens show the product in action. The coverage matrix
            below maps all 14 tools to QC audit categories — evidence tier indicates
            how defensible the resulting documentation is under a USDA error-rate review.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-pine-surface text-pine">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {summary.liveTools} tools live · {summary.strongOrModerate} Strong or Moderate · {summary.recertTools} for renewal
          </span>
          <p className="text-[11px] text-muted font-mono tracking-wide mt-1.5">
            source: civica engineering · production wiring
          </p>
        </div>
      </div>

      <TierLegend />

      {/* Cohort header strip — who we're optimized for + OBBBA implications */}
      <CohortHeaderStrip />

      {/* Three flagship mockups */}
      <FlagshipStrip tools={tools} />

      {/* Coverage matrix */}
      <CoverageMatrix tools={tools} />

      {/* Distribution math — addressable cohort by channel */}
      <DistributionMath />

      {/* Monetization framework — layman value chain */}
      <MonetizationFramework />
    </section>
  );
}
