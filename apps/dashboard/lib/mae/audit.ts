// Mae audit log — a durable, PII-scrubbed record of every Mae query for
// accountability, error analysis, dispute resolution, and drift detection.
//
// What's stored: the REDACTED question (PII already scrubbed by lib/mae/pii.ts),
// the answer, the citations Mae made with their verifier status, how many cites
// were unrecognized, how many PII spans were scrubbed from the input, and the
// model + corpus version. Written by the service role (the caseworker cannot
// suppress their own audit trail).
//
// Resilience: auditing must NEVER block or fail a caseworker's answer. If the
// table isn't applied yet or the service key is unset, we fall back to a
// structured stderr line (captured by the platform log drain) and move on.

import { createServiceClient } from "../supabase";
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
  mode?: string;
  /** State the query was scoped to (e.g. "CA"); null for generalist. */
  scopeState?: string | null;
  /** Internal packet ref for case-scoped queries; null otherwise (not the case #). */
  scopeRef?: string | null;
}

/** Persist one audit record. Best-effort; swallows all errors. */
export async function logMaeQuery(rec: MaeAuditRecord): Promise<void> {
  try {
    const db = createServiceClient();
    const { error } = await db
      .schema("snap_enrollment")
      .from("mae_query_log")
      .insert({
        staff_user_id: rec.staffUserId,
        question_redacted: rec.questionRedacted,
        answer: rec.answer,
        citations: rec.citations,
        unrecognized_count: rec.unrecognizedCount,
        pii_redactions: rec.piiRedactions,
        model: rec.model,
        corpus_date: rec.corpusDate,
        mode: rec.mode ?? null,
        scope_state: rec.scopeState ?? null,
        scope_ref: rec.scopeRef ?? null,
      });
    if (error) throw error;
  } catch (err) {
    // Audit must not break the answer. Structured fallback so the record is at
    // least captured by the platform logs until the table is applied.
    console.info(
      "[mae-audit]",
      JSON.stringify({ ...rec, _sinkError: err instanceof Error ? err.message : String(err) }),
    );
  }
}
