// @civica/demeter-engine — SERVER barrel. (Client components import from
// "@civica/demeter-engine/packs" instead; this root pulls in the 1MB corpus.)

export {
  answerQuestion,
  parseMessages,
  ANSWER_LIMITS,
  STREAM_RECOMPOSE_MARKER,
  type AnswerFrame,
  type AnswerRequest,
  type AnswerEvents,
  type ChatMessage,
  type ChatRole,
  type VerifierOutcome,
} from "./orchestrator";
export { buildMaeSystem, MAE_GENERATION, type MaeSystem, type Audience } from "./answer";
export {
  verifyCitations,
  extractCitations,
  formatCitationTrailer,
  type CitationCheck,
  type CitationStatus,
} from "./citation-verifier";
export { retrieve, formatRetrievedSources, CORPUS_EFFECTIVE_DATE } from "./retrieval";
export { formatFreshnessFooter } from "./freshness";
export { redactPii } from "./pii";
export { warmupEmbeddings, semanticLayerStatus, retrievalMode } from "./embeddings";
export { detectDistress, DISTRESS_SYSTEM_ADDENDUM } from "./distress";
export { verifyNumericEquivalence, type NumericCheckResult } from "./numeric-check";
export { consoleAuditSink, type MaeAuditRecord, type MaeAuditSink } from "./audit";
export { getStatePack, registeredStates, DEFAULT_STATE, type StateCode, type StatePack } from "./states";
export { VERIFIED_STATES, VERIFIED_STATE_CODES, isVerifiedState, type PackMeta } from "./packs";

// The CBO caseworker screening tool (accounts-gated; distinct from the
// public open-Q&A path above). Slice 1 of the screening-tool build:
// chat → structured facts → the real snap-rules engine → the mockup's six
// outcomes. No UI, no auth, no storage — those are later slices.
export { screenHousehold, type ScreeningTurnRequest, type ScreeningTurnResult } from "./screening/orchestrator";
export { extractFacts, mergeFactsPatch, type PartialFacts, type ExtractionResult } from "./screening/facts-extraction";
export { assessCompleteness, completeFactsShape, type CompletenessResult } from "./screening/completeness";
export { classifyScreening, type ScreeningOutcome, type ScreeningClassification } from "./screening/classify";
export { FORM_QUESTIONS, matchFormQuestion, classifyQuestionTopic, type FormQuestion } from "./form-questions";
