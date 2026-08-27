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
  /** Which crisis gate fired, if any: "self_harm" | "abuse" (#927). Recorded
   *  so the gate's real-world precision can be reviewed against messages
   *  rather than guessed at — the v1 patterns deliberately leave ambiguous
   *  phrasing out, and this is the evidence that would justify adding it. */
  crisis?: string | null | undefined;
  /** The reader's language (en/es/vi/zh). mae_feedback has always carried it;
   *  the answer log did not, so per-language quality could not be reviewed. */
  lang?: string | null | undefined;
  /** ask | estimate. Distinct from `mode`, which is public/case: one is who
   *  is asking, the other is what they are doing. */
  worksheetMode?: string | null | undefined;
  /** Milliseconds to first streamed token, and to the last one. */
  ttftMs?: number | null | undefined;
  totalMs?: number | null | undefined;
  /** The reader pressed Stop. NOT a failure — counting it as one would
   *  flatter nothing and mislead everything. */
  stopped?: boolean | undefined;
  /** TOKENS, so spend can be attributed to something.
   *
   *  Reported: fewer than 30 short prompts cost about a dollar. That could not
   *  be investigated, because this record had twenty fields and none of them
   *  was a token count — the orchestrator computed usage, handed it to
   *  events.onUsage, and nothing wrote it down. Spend therefore attributed to
   *  no state, no turn, no retry, and no extraction call, and any trimming
   *  would have been guesswork nobody could check afterwards.
   *
   *  Both are SUMMED over the answer, so a citation-failure retry — a second
   *  full generation — shows up as one expensive row rather than disappearing.
   *  Zero when attempt 1 was aborted mid-stream and no final message arrived;
   *  see AnswerEvents.onUsage. */
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
}

/** Persistence hook. Implementations must be best-effort and never throw. */
export type MaeAuditSink = (rec: MaeAuditRecord) => void | Promise<void>;

/** Fallback sink: a structured log line the platform drain captures.
 *
 *  The console call IS the implementation here — this is the sink of last
 *  resort when the database write fails, and it is the only thing standing
 *  between a rejected audit row and total silence. Silencing it to satisfy
 *  no-console would delete the fallback, not tidy it. */
// eslint-disable-next-line no-console -- this function is a console sink by definition
export const consoleAuditSink: MaeAuditSink = (rec) => console.info("[demeter-audit]", JSON.stringify(rec));
