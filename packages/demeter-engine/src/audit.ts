// Demeter audit record — a durable, PII-scrubbed record of every query for
// accountability, error analysis, dispute resolution, and drift detection.
//
// What's stored: the REDACTED question (PII already scrubbed by pii.ts), the
// answer, the citations made with their verifier status, how many cites were
// unrecognized, how many PII spans were scrubbed from the input, the model +
// corpus version, and how the answer concluded (streamed clean, recomposed, or
// degraded to verified quotes).
//
// The engine does NOT know where records go — persistence is an injected sink
// (apps/dashboard writes snap_enrollment.mae_query_log via its service client;
// apps/web writes the public-chat variant). The console sink is the always-safe
// fallback: auditing must NEVER block or fail an answer.

import type { CitationCheck } from "./citation-verifier";

export interface MaeAuditRecord {
  staffUserId: string | null;
  questionRedacted: string;
  answer: string;
  citations: CitationCheck[];
  unrecognizedCount: number;
  piiRedactions: number;
  model: string;
  corpusDate: string;
  /** Surface that asked: "general" (generalist) vs "case" (a specific app). */
  mode?: string | undefined;
  /** State the query was scoped to (e.g. "CA"); null for federal-floor. */
  scopeState?: string | null | undefined;
  /** Internal packet ref for case-scoped queries; null otherwise (not the case #). */
  scopeRef?: string | null | undefined;
  /** Random per-tab id grouping turns into one conversation. Not an identity:
   *  generated in the browser, dies with the tab, never sent to the model.
   *  Without it, "did people ask once and leave" is unanswerable. */
  sessionId?: string | null | undefined;
  /** 1-based question number within the session. */
  turnIndex?: number | null | undefined;
  /** How verification concluded: "clean" | "recomposed" | "degraded". */
  verifierOutcome?: string | undefined;
  /** Which application-form question the user was stuck on, if recognizable.
   *  A topic key, never the question text. */
  questionTopic?: string | null | undefined;
  /** "certain" | "uncertain" — the verdict shown to the reader. */
  certainty?: string | undefined;
  /** Why: grounded | unrecognized_citation | degraded_to_sources | authority_not_retrieved | state_not_verified. */
  certaintyCode?: string | undefined;
  /** Which retrieval mode served the answer: "semantic+lexical" | "lexical". */
  retrievalMode?: string | undefined;
  /** True when the distress gate fired on this question. */
  distress?: boolean | undefined;
}

/** Persistence hook. Implementations must be best-effort and never throw. */
export type MaeAuditSink = (rec: MaeAuditRecord) => void | Promise<void>;

/** Fallback sink: a structured stderr line the platform log drain captures. */
export const consoleAuditSink: MaeAuditSink = (rec) => {
  console.info("[demeter-audit]", JSON.stringify(rec));
};
