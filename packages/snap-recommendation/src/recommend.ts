// Stage 3 orchestrator + top-level evaluateComponentR.
// Engine adapters are injected for testability (budget spy, unit isolation).

import { composeVerdict, computeBenefit } from "@civica/snap-rules";
import { detectMissedElections } from "@civica/snap-qc-engine";
import type { Facts, VerdictResult } from "@civica/snap-rules";
import type { HouseholdElectionProfile } from "@civica/snap-qc-engine";
import type {
  AnsweredAxes,
  ComponentRInput,
  ComponentRResult,
  EngineAdapters,
  FeasibilityContext,
  Recommendation,
  RecommendationSet,
  Urgency,
} from "./types";
import { evaluateElicitation } from "./elicitation";
import { deriveFeasibilityContext } from "./feasibility";
import {
  generateMissedElectionCandidates,
  generateIncomeVerificationCandidates,
  generateCategoricalFlipCandidates,
  generateVerificationUpgradeCandidates,
  generateBoundaryProximityCandidates,
} from "./candidates";
import { rankCandidates } from "./ranking";
import {
  buildVerificationSteps,
  isRerouted,
  firstRerouteReason,
} from "./verification";
import { fieldTag } from "./field-taxonomy";

// ─── Default adapters ─────────────────────────────────────────────────────────

function realAdapters(): EngineAdapters {
  return {
    computeBenefit: (f, s, d) => computeBenefit(f as any, s, d),
    composeVerdict: (f, s, d) => composeVerdict(f as any, s, d),
    detectMissedElections: (p: HouseholdElectionProfile) => detectMissedElections(p),
  };
}

// ─── Stage 3 ──────────────────────────────────────────────────────────────────

export function generateRecommendations(
  facts: Facts,
  verdictResult: VerdictResult,
  ctx: FeasibilityContext,
  state: "CA" | "MA",
  asOf: Date,
  answeredAxes: AnsweredAxes = {},
  adapters: EngineAdapters = realAdapters(),
): RecommendationSet {
  const callCount = { n: 0 };

  // Collect missed elections from detectMissedElections (also used passively)
  const electionCandidates = generateMissedElectionCandidates(
    facts, verdictResult, answeredAxes, state, asOf, adapters, callCount,
  );

  // Class 2: income verification
  const incomeCandidates = generateIncomeVerificationCandidates(
    facts, answeredAxes, state, asOf, adapters, callCount,
  );

  // Class 3: categorical flip (narrow)
  const catCandidates = generateCategoricalFlipCandidates(
    facts, verdictResult, answeredAxes, state, asOf, adapters, callCount,
  );

  // Class 4: verification upgrades (requires qc_results in answeredAxes)
  const upgradeCandidates = generateVerificationUpgradeCandidates(
    verdictResult, answeredAxes,
  );

  // Class 5: boundary proximity (reads from trace — no engine call)
  const boundaryCandidates = generateBoundaryProximityCandidates(verdictResult);

  const allCandidates = [
    ...electionCandidates,
    ...incomeCandidates,
    ...catCandidates,
    ...upgradeCandidates,
    ...boundaryCandidates,
  ];

  const ranked = rankCandidates(allCandidates, verdictResult);

  const recommendations: Recommendation[] = ranked.map((c, idx) => {
    const steps = buildVerificationSteps(c.field, ctx);
    const rerouted = isRerouted(steps);
    const reroute_reason = firstRerouteReason(steps);

    return {
      rank: (idx + 1) as 1 | 2 | 3 | 4,
      perturbation_class: c.perturbation_class,
      field: c.field,
      field_tag: fieldTag(c.field),
      delta_monthly_usd: c.delta_monthly_usd,
      urgency: c.urgency as Urgency,
      score: c.score,
      action: c.action,
      verification_steps: steps,
      citable_to: c.citable_to,
      rerouted,
      ...(reroute_reason ? { reroute_reason } : {}),
    };
  });

  return {
    recommendations,
    interrupt_required: recommendations.some(
      (r) => r.urgency === "verdict_threatening",
    ),
    missed_elections: (electionCandidates
      .map((c) => c.source_election)
      .filter(Boolean)) as import("@civica/snap-qc-engine").MissedElection[],
    counterfactuals_run: callCount.n,
  };
}

// ─── Top-level evaluateComponentR ────────────────────────────────────────────

export function evaluateComponentR(
  input: ComponentRInput,
  adapters: EngineAdapters = realAdapters(),
): ComponentRResult {
  const { facts, answeredAxes, state, asOf } = input;

  // Stage 1
  const stage1 = evaluateElicitation(facts as Partial<Facts>, answeredAxes, state);

  if (stage1.status !== "DETERMINE") {
    return { stage1, stage2: null, stage3: null };
  }

  // Stage 2 — passthrough, no transformation
  const stage2 = adapters.composeVerdict(facts as Facts, state, asOf);

  // SKIP: engine capability gap, not an elicitation gap
  if ((stage2.not_implemented_surfaces ?? []).length > 0) {
    return { stage1, stage2, stage3: null };
  }

  // Stage 3
  const ctx = deriveFeasibilityContext(facts as Partial<Facts>, answeredAxes);
  const stage3 = generateRecommendations(
    facts as Facts,
    stage2,
    ctx,
    state,
    asOf,
    answeredAxes,
    adapters,
  );

  return { stage1, stage2, stage3 };
}
