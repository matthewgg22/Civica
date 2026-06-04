// Public API for @civica/snap-recommendation (Component R).
// Pure deterministic functions — zero I/O, zero LLM, zero SNAP math reimplemented.

export { evaluateComponentR, generateRecommendations } from "./recommend";
export { evaluateElicitation, hasMinimumFacts } from "./elicitation";
export { deriveFeasibilityContext } from "./feasibility";
export { DETERMINATIVE_FIELDS, OPTIONAL_FIELDS } from "./manifest";
export { fieldTag, IMMUTABLE_FIELDS, VERIFIABLE_FIELDS, ATTESTABLE_FIELDS } from "./field-taxonomy";
export { buildVerificationSteps } from "./verification";
export { runPlausibilityChecks } from "./plausibility";
export { rankCandidates } from "./ranking";
export type { RawCandidate } from "./candidates";

export type {
  ComponentRInput,
  ComponentRResult,
  ElicitationResult,
  ElicitationStatus,
  ElicitationQuestion,
  PlausibilityFlag,
  RecommendationSet,
  Recommendation,
  VerificationStep,
  FeasibilityContext,
  AnsweredAxes,
  Urgency,
  PerturbationClass,
  VerificationMode,
  EngineAdapters,
  VerdictResult,
  MissedElection,
} from "./types";
