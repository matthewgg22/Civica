/**
 * Informal housing — public exports.
 *
 * Types, question bank, validator, defensibility lookup, and shelter-deduction
 * effect lookup for non-lease housing arrangements.
 *
 * Consumer guide:
 *
 *   iOS wizard        → INFORMAL_HOUSING_QUESTIONS, nextUnansweredQuestion,
 *                        validateIntake
 *   enrollment-api    → validateIntake, SHELTER_EFFECT, DEFENSIBILITY_LOOKUP
 *   snap-qc-engine    → DEFENSIBILITY_LOOKUP (for shelter-flow scoring)
 *   snap-calculator   → SHELTER_EFFECT (for deduction computation)
 *   dashboard panels  → validateIntake counts + SHELTER_EFFECT.homeless_deduction_eligible
 */

export type {
  InformalArrangementKind,
  PaymentCadence,
  EvidenceKind,
  InformalHousingDefensibility,
  ShelterDeductionEffect,
} from "./types";

export {
  DEFENSIBILITY_LOOKUP,
  SHELTER_EFFECT,
} from "./types";

export type {
  AnswerKind,
  BranchCondition,
  IntakeQuestion,
  IntakeValidationResult,
} from "./questions";

export {
  INFORMAL_HOUSING_QUESTIONS,
  nextUnansweredQuestion,
  validateIntake,
} from "./questions";
