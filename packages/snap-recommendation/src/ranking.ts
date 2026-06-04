// Ranker: score candidates → 3-level urgency sort → max-4 hard cap.
// Symmetry: Class 4 uses dollars_at_risk; Class 5 urgency set at generation.

import type { VerdictResult, BenefitCalcDetail } from "@civica/snap-rules";
import type { MissedElection } from "@civica/snap-qc-engine";
import type { Urgency } from "./types";
import type { RawCandidate } from "./candidates";

const URGENCY_ORDER: Record<Urgency, number> = {
  verdict_threatening: 0,
  accuracy_risk: 1,
  opportunity: 2,
};

// P(field wrong or challenged) per class
function priorProbability(c: RawCandidate): number {
  if (c.perturbation_class === "missed_election" && c.source_election) {
    const conf = (c.source_election as MissedElection).confidence;
    return conf === "high" ? 0.70 : conf === "medium" ? 0.40 : 0.20;
  }
  if (c.perturbation_class === "income_verification") {
    // Base prior from income type — uses engine constants via field-taxonomy
    const field = c.field;
    if (field.includes("type=wages") || field.includes("type=platform_gig")) {
      return 0.265; // ERROR_WEIGHT["gig-income"]
    }
    if (field.includes("shelter") || field.includes("utility")) {
      return 0.371; // ERROR_WEIGHT["utility-sua"]
    }
    return 0.15; // conservative default
  }
  if (c.perturbation_class === "categorical_flip") return 0.50;
  return 0;
}

interface ScoredCandidate extends RawCandidate {
  score: number;
  urgency: Urgency;
}

export function rankCandidates(
  candidates: RawCandidate[],
  verdictResult: VerdictResult,
): ScoredCandidate[] {
  const maxAllotment =
    (verdictResult.trace != null &&
    "benefit_calc" in verdictResult.trace
      ? (verdictResult.trace.benefit_calc as BenefitCalcDetail)
          ?.max_allotment_for_household_size
      : undefined) ?? 0;

  const scored: ScoredCandidate[] = candidates.map((c) => {
    let score: number;
    let urgency: Urgency;

    if (c.perturbation_class === "verification_upgrade") {
      score = c.dollars_at_risk ?? 0;
      urgency = "accuracy_risk";
    } else if (c.perturbation_class === "boundary_proximity") {
      score = c.delta_monthly_usd;
      urgency = (c.urgency_override as Urgency | undefined) ?? "accuracy_risk";
    } else {
      const p = priorProbability(c);
      const isVerdictFlip =
        c.verdict_before === "DENY" && c.verdict_after === "APPROVE";
      const effectiveDelta = isVerdictFlip
        ? Math.max(maxAllotment, c.delta_monthly_usd)
        : c.delta_monthly_usd;
      score = p * effectiveDelta;
      urgency = isVerdictFlip ? "verdict_threatening" : "opportunity";
    }

    return { ...c, score, urgency };
  });

  return scored
    .sort((a, b) => {
      const tierDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
      return tierDiff !== 0 ? tierDiff : b.score - a.score;
    })
    .slice(0, 4); // Reg B hard cap
}
