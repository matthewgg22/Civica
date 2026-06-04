// Flag sensitivity — the CBO triage layer (issue #496).
//
// Decides WHICH QC flags interrupt a navigator's workflow, given a CBO's
// sensitivity preference. This is a TRIAGE FILTER applied AFTER scoring: it
// reads per-flow defensibility signals plus a CBO config and returns one
// interrupt decision per flag.
//
// CRITICAL INVARIANT (#496): this module never computes or alters a score, a
// tier, or the measured payment error rate. It imports ONLY types — never
// scoreErrorRisk, buildKpiSnapshot, or buildErrorRateSnapshot. Two CBOs with
// different sensitivity on identical packets therefore produce identical
// scoring + identical snapshots; only which flags surface to the navigator
// differs. That keeps measured PER comparable across CBOs and audit-ready.
//
// It also introduces NO new score thresholds. Sensitivity maps a discrete level
// to which flag SEVERITIES interrupt — where severity is derived from the
// existing defensibility scale. A higher level is always a superset of the one
// below; focus areas bump a single flow up one level, never past "thorough".

import type { FlowKind, Defensibility } from "../schemas";

export type SensitivityLevel = "conservative" | "balanced" | "thorough";

/**
 * How much a single flag warrants navigator attention, derived from the flow's
 * defensibility. weak evidence = high-severity flag; strong = low (an FYI only
 * surfaced under the most thorough setting). Every evaluated flow has a flag;
 * sensitivity decides which severities actually interrupt.
 */
export type FlagSeverity = "high" | "medium" | "low";

export function flagSeverity(defensibility: Defensibility): FlagSeverity {
  return defensibility === "weak"
    ? "high"
    : defensibility === "moderate"
      ? "medium"
      : "low";
}

// Which severities interrupt the navigator at each level. Strictly nested:
// conservative ⊂ balanced ⊂ thorough. No per-level score thresholds — just a
// wider severity set as the CBO opts into more review.
const INTERRUPT_SEVERITIES: Record<SensitivityLevel, ReadonlySet<FlagSeverity>> = {
  conservative: new Set<FlagSeverity>(["high"]),
  balanced: new Set<FlagSeverity>(["high", "medium"]),
  thorough: new Set<FlagSeverity>(["high", "medium", "low"]),
};

// A focus area bumps a flow up exactly one level (capped at thorough).
const NEXT_LEVEL: Record<SensitivityLevel, SensitivityLevel> = {
  conservative: "balanced",
  balanced: "thorough",
  thorough: "thorough",
};

export const DEFAULT_SENSITIVITY: SensitivityLevel = "balanced";

export interface FlagSensitivityConfig {
  level: SensitivityLevel;
  /** Flows the CBO emphasizes — each is surfaced one level more aggressively. */
  focusFlows?: readonly FlowKind[];
}

export interface FlagInterruptDecision {
  flow: FlowKind;
  severity: FlagSeverity;
  /** true = surfaces to / interrupts the navigator; false = passive. */
  interrupts: boolean;
  /** true when a focus area bumped this flow's effective level. */
  focusApplied: boolean;
}

type FlagSignal = { flow: FlowKind; defensibility_score: Defensibility };

/**
 * Resolve which flags interrupt, per the CBO's sensitivity config. Pure.
 * Does not read or modify any score; takes the same per-flow defensibility
 * signals scoreErrorRisk consumes and returns only surfacing decisions.
 */
export function resolveFlagInterrupts(
  signals: readonly FlagSignal[],
  config: FlagSensitivityConfig,
): FlagInterruptDecision[] {
  const focus = new Set<FlowKind>(config.focusFlows ?? []);
  return signals.map((s) => {
    const severity = flagSeverity(s.defensibility_score);
    const focusApplied = focus.has(s.flow);
    const effectiveLevel = focusApplied ? NEXT_LEVEL[config.level] : config.level;
    const interrupts = INTERRUPT_SEVERITIES[effectiveLevel].has(severity);
    return { flow: s.flow, severity, interrupts, focusApplied };
  });
}

/** Count flags that interrupt under a config — convenience for UI/budgeting. */
export function countInterrupts(
  signals: readonly FlagSignal[],
  config: FlagSensitivityConfig,
): number {
  return resolveFlagInterrupts(signals, config).filter((d) => d.interrupts).length;
}
