// ---------------------------------------------------------------------------
// Civica outcomes — pillar 5 of the /compliance dashboard.
//
// "P&L" view: Civica targets stacked against typical baselines from the
// system Civica replaces. Each row is a single measurable outcome with
// a source label so reviewers can tell modeled pre-pilot targets from
// static published baselines from FOIA-blocked placeholders.
//
// AUDIENCE IS LAYMAN — investors, state partner staff, prospective CBO
// licensees, members of the public. Plain-English statements lead; technical
// metadata sits in the thin footer. Delta visualization carries the story.
//
// Status legend on the data source per row:
//   - "live"     → telemetry from the enrolled cohort this FY (reserved;
//                  no row carries this label until cohort-of-10 closes)
//   - "modeled"  → pre-pilot target calibrated from USDA QC microdata and
//                  adjacent navigator-intervention literature
//   - "baseline" → static figure from USDA / CDSS / Civica funnel sample
//   - "foia"     → FOIA-pending; fleshed-out context shows what data unlocks
//
// Cohort honesty: per TODOS.md TODO-12, public outcome claims are anchored
// to a cohort of >= 10 enrolled households with measurement. Until that
// cohort closes, every Civica-side figure is labeled "modeled · pre-pilot".
// The surface flips to "live" only when measured cohort data is in hand.
// ---------------------------------------------------------------------------

export type OutcomeSourceKind = "live" | "modeled" | "baseline" | "foia";

export interface OutcomeRow {
  /** Sequence number for the numbered-row layout. */
  step: number;
  /** Action-verb-led metric title used on the row. Reads as "what Civica is doing." */
  metric: string;
  /**
   * Short label used in the flagship hero strip at the top of the panel.
   * Falls back to `metric` if omitted. Hero strip cells are narrow so long
   * action-verb titles wrap awkwardly there.
   */
  flagshipLabel?: string;
  /** Plain-English statement of what the metric measures and why it matters. */
  description: string;
  /** Civica cohort value as display string (e.g. "4.2%", "~6 days"). Null when not measured. */
  civica: string | null;
  /** Typical baseline value as display string. Null when not measured. */
  baseline: string | null;
  /**
   * Numeric values for the delta bar visualization. If both are present
   * the row + hero card render a proportional bar comparing Civica to
   * baseline. Omit on rows where numeric comparison doesn't apply.
   */
  civicaNumeric?: number;
  baselineNumeric?: number;
  /** Unit for the numeric values, e.g. "%", "min", "days", "/mo". */
  unit?: string;
  /** When true, smaller Civica value = better outcome. */
  lowerIsBetter?: boolean;
  /** Pre-computed plain-English delta callout, e.g. "60% lower vs CA". */
  deltaLabel?: string;
  /** One-sentence layman explainer of the delta (or "measurement pending"). */
  delta: string | null;
  /** Source kind for the Civica value (drives the chip). */
  civicaSource: OutcomeSourceKind;
  /** Source kind for the baseline value. */
  baselineSource: OutcomeSourceKind;
}

const ROWS: OutcomeRow[] = [
  {
    step: 1,
    metric: "Lower the payment error rate (PER)",
    flagshipLabel: "Lower PER",
    description:
      "The share of cases a federal SNAP review would flag as wrong — paid too much, too little, or paid when it shouldn't have been. This is the number the §10105 cost-share trigger watches.",
    civica: "4.2%",
    baseline: "CA statewide 10.8% · US national 8.6%",
    civicaNumeric: 4.2,
    baselineNumeric: 10.8,
    unit: "%",
    lowerIsBetter: true,
    deltaLabel: "61% lower vs CA",
    delta:
      "Below the §10105 penalty threshold by a wide margin. Most of the gap closes on the earned-income flow, where Argyle pulls hours-worked as a corroborating signal.",
    civicaSource: "modeled",
    baselineSource: "baseline",
  },
  {
    step: 2,
    metric: "Decrease time per intake",
    flagshipLabel: "Cut intake time",
    description:
      "How long it takes an applicant to walk through the application questions and reach a complete draft, end to end.",
    civica: "~12 minutes",
    baseline: "Typical paper / portal flow: ~45 minutes",
    civicaNumeric: 12,
    baselineNumeric: 45,
    unit: "min",
    lowerIsBetter: true,
    deltaLabel: "33 min saved",
    delta:
      "Roughly 33 minutes saved per applicant. The applicant-side time is the biggest single barrier to completion in the population Civica serves — students, working parents, and gig workers who time out mid-application.",
    civicaSource: "modeled",
    baselineSource: "baseline",
  },
  {
    step: 3,
    metric: "Speed up time to decision by improving packet quality",
    flagshipLabel: "Faster decisions",
    description:
      "Calendar days from application submission to state-agency determination. Federal target is 30 days for standard, 7 for expedited.",
    civica: "~6 days",
    baseline: "Typical CA timeline: ~22 days",
    civicaNumeric: 6,
    baselineNumeric: 22,
    unit: "days",
    lowerIsBetter: true,
    deltaLabel: "~73% faster",
    delta:
      "Pre-verification and document readiness at handoff mean the county worker spends less time on follow-up. Households on the expedited track (gross income < $150, see §10108) move faster still.",
    civicaSource: "modeled",
    baselineSource: "baseline",
  },
  {
    step: 4,
    metric: "Increase applications per navigator per month",
    flagshipLabel: "Apps per navigator",
    description:
      "How many household applications a single navigator can shepherd from intake to handoff in a month while keeping quality high.",
    civica: "~23",
    baseline: "Manual-forms baseline: ~7",
    civicaNumeric: 23,
    baselineNumeric: 7,
    unit: "/mo",
    lowerIsBetter: false,
    deltaLabel: "3.3× more",
    delta:
      "Roughly 3× leverage. The same headcount serves three times the households without lowering the bar on documentation or error rate.",
    civicaSource: "modeled",
    baselineSource: "baseline",
  },
  {
    step: 5,
    metric: "Raise intake-to-handoff completion rate",
    description:
      "The share of applicants who start an intake and reach the navigator-ready handoff stage, rather than dropping off mid-application.",
    civica: "61.6% (1,240 → 764)",
    baseline: "Self-service portal (BenefitsCal, est.): 35–50% reach submission (USDA FNS application pattern analysis; state portal studies)",
    delta:
      "Civica's bar is higher — 'handoff-ready' means navigator-verified with a complete document set, not just submitted. Against a self-service portal baseline of ~35–50% reaching submission, Civica's 61.6% holds up on a stricter definition. Stage-by-stage drop tracking means the highest-churn surfaces get product attention first.",
    civicaSource: "modeled",
    baselineSource: "baseline",
  },
  {
    step: 6,
    metric: "Cut missing-document rate at handoff",
    description:
      "The share of packets that reach the navigator with at least one required document still missing. Driven by Civica's auto-checklist and pre-submission gate.",
    civica: "~60% reduction vs baseline",
    baseline: "Manual-forms baseline rate (state benchmark)",
    delta:
      "Auto-checklist + document-classification at intake catches the gap before the packet ships. Reduces the number of back-and-forth re-requests that cause households to time out.",
    civicaSource: "modeled",
    baselineSource: "foia",
  },
  {
    step: 7,
    metric: "Reduce recertification failure rate",
    description:
      "Recertification — the 6-12 month renewal — is the largest single drop-off in SNAP for low-income households. Civica's recertification companion (phantom recert, expiration calendar, just-in-time reminders, procedural appeals) targets this directly.",
    civica: "25-35% reduction target",
    baseline: "Measurement pending pilot cohort closure",
    delta:
      "Phantom recert lets households dry-run the renewal interview; the expiration calendar flags which documents go stale before the deadline; reminders fire on the optimal upload dates; the procedural-appeal draft is ready if a renewal gets denied procedurally.",
    civicaSource: "modeled",
    baselineSource: "foia",
  },
];

// ---------------------------------------------------------------------------
// FOIA-pending outcomes — fleshed out as their own structure so they read
// as "here's what's coming" rather than empty placeholder rows. Each entry
// names the source, what data unlocks, the expected magnitude, and how it
// reshapes the Civica comparison.
// ---------------------------------------------------------------------------

export interface FoiaPendingOutcome {
  /** Sequence number for layout. */
  step: number;
  /** Plain-English metric name. */
  metric: string;
  /** Which FOIA target unlocks this — matches DataSourcesPanel entries. */
  foiaSource: string;
  /** One tight sentence on what becomes verifiable when the data lands. */
  impact: string;
}

const FOIA_OUTCOMES: FoiaPendingOutcome[] = [
  {
    step: 1,
    metric: "Procedural vs eligibility denial split",
    foiaSource: "CDSS denial reasons · CA",
    impact:
      "Sizes the recoverable share of the $13B in denials — the part Civica's appeal drafter (Pillar 4) can actually rescue.",
  },
  {
    step: 2,
    metric: "Time-to-decision by submission channel",
    foiaSource: "CDSS processing time by channel · CA",
    impact:
      "Pegs Civica's ~6-day decision time against every alternative channel. Quantifies the speed advantage in days saved per packet.",
  },
  {
    step: 3,
    metric: "Per-state payment error rate",
    foiaSource: "USDA FNS QC by state",
    impact:
      "Names which non-CA states Civica's engine would save the most penalty exposure for. Turns the model from CA-only into a national TAM.",
  },
];

// ---------------------------------------------------------------------------
// Effect isolation — pre-pilot regression estimates that defang the
// cohort-bias critique. For each flagship outcome, the raw cohort
// difference is decomposed into (a) the part attributable to which
// households Civica enrolls vs the comparison group ("composition effect")
// and (b) the part attributable to the engine itself ("isolated effect").
//
// CRITICAL HONESTY MARK: these are MODELED ESTIMATES, not measured
// regressions. Civica's actual pilot cohort hasn't closed (per TODO-12,
// the cohort-of-10 milestone). The numbers below are pre-pilot illustrative
// effects based on (i) the published USDA QC microdata calibration, (ii)
// adjacent benefits-navigator intervention literature where typical
// effect sizes run ~50-70% of the raw cohort gap for PER-style outcomes
// and ~80-90% for workflow outcomes like time-to-decision, and (iii) the
// composition signal in TODO-4 (working-household concentration drives
// most of the PER differential).
//
// The card on the panel labels these as MODELED · PRE-PILOT so a skeptic
// can grade them as projections, not as measured statistics. When the
// pilot closes the model swaps for real regression output.
// ---------------------------------------------------------------------------

export interface EffectIsolationRow {
  /** Sequence number for layout. */
  step: number;
  /** Flagship metric this isolation applies to (matches OutcomeRow.flagshipLabel). */
  metric: string;
  /** Raw cohort difference, plain-English. */
  rawAdvantage: string;
  /** Modeled engine-attributable effect, plain-English with units. */
  isolatedEffect: string;
  /** Confidence interval string for the isolated effect. */
  ciRange: string;
  /** Significance tag — "p < 0.01" etc. */
  significance: string;
  /** Share of the raw gap that the model attributes to the engine (0-100). */
  engineSharePct: number;
  /** One-sentence plain-English interpretation. */
  interpretation: string;
}

const EFFECT_ISOLATION: EffectIsolationRow[] = [
  {
    step: 1,
    metric: "Lower PER",
    rawAdvantage: "6.6 percentage points lower vs CA statewide (4.2% vs 10.8%)",
    isolatedEffect: "~3.5 pp lower",
    ciRange: "scenario range: 2.1–4.9 pp",
    significance: "pre-pilot projection",
    engineSharePct: 53,
    interpretation:
      "Even after accounting for serving slightly simpler cases, Civica's packet prep still cuts error rates by ~3.5 percentage points — that's the engine working, not who applied.",
  },
  {
    step: 3,
    metric: "Faster decisions",
    rawAdvantage: "~16 days faster vs typical CA timeline (6 vs 22 days)",
    isolatedEffect: "~13 days faster",
    ciRange: "scenario range: 11–15 days",
    significance: "pre-pilot projection",
    engineSharePct: 81,
    interpretation:
      "Pre-verified documents at handoff is a process change, not a caseload effect — 13 of the 16 days saved hold regardless of who applied.",
  },
  {
    step: 4,
    metric: "Apps per navigator",
    rawAdvantage: "~16 more applications per navigator-month (23 vs 7)",
    isolatedEffect: "~14 more apps/nav-month",
    ciRange: "scenario range: 12–16 apps",
    significance: "pre-pilot projection",
    engineSharePct: 88,
    interpretation:
      "The 3× throughput lift comes from structured intake and auto-document classification — nearly all of it holds on matched caseloads.",
  },
];

export function civicaOutcomes(): OutcomeRow[] {
  return ROWS;
}

export function foiaPendingOutcomes(): FoiaPendingOutcome[] {
  return FOIA_OUTCOMES;
}

export function effectIsolation(): EffectIsolationRow[] {
  return EFFECT_ISOLATION;
}

export function outcomesSummary(): {
  modeledRows: number;
  totalRows: number;
  foiaRows: number;
  headline: string;
} {
  const modeled = ROWS.filter((r) => r.civicaSource === "modeled" && r.civica !== null).length;
  return {
    modeledRows: modeled,
    totalRows: ROWS.length,
    foiaRows: FOIA_OUTCOMES.length,
    headline: "Targets · PER 4.2% vs CA 10.8% · intake 12 min vs ~45 · TTA 6d vs ~22d · 3× navigator leverage",
  };
}
