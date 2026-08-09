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
export { buildMaeSystem, MAE_GENERATION, type MaeSystem } from "./answer";
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

export { FORM_QUESTIONS, matchFormQuestion, classifyQuestionTopic, type FormQuestion } from "./form-questions";
