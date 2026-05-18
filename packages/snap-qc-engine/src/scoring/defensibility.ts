import type { Defensibility, DefensibilityFactor } from "../schemas.js";

// Cross-flow helpers. Today, defensibility is determined per-flow inside the
// flow modules; this file exists as the shared home for any future scoring
// utilities that operate across flow types (e.g. a packet-level rollup that
// combines four flow QcResults into a household score).

export function rollupFactors(factors: DefensibilityFactor[]): {
  positives: number;
  negatives: number;
  neutrals: number;
} {
  let positives = 0;
  let negatives = 0;
  let neutrals = 0;
  for (const f of factors) {
    if (f.weight === "positive") positives++;
    else if (f.weight === "negative") negatives++;
    else neutrals++;
  }
  return { positives, negatives, neutrals };
}

export function combineScores(scores: Defensibility[]): Defensibility {
  if (scores.length === 0) return "weak";
  if (scores.some((s) => s === "weak")) return "weak";
  if (scores.every((s) => s === "strong")) return "strong";
  return "moderate";
}
