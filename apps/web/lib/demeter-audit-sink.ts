// Public-chat audit sink — persists engine MaeAuditRecords to the same
// snap_enrollment.mae_query_log table the staff dashboard uses (mode
// "public", staff_user_id null). PII was already scrubbed by the engine;
// retention policy (T7): question text lives 7 days, flagged rows 30 —
// enforced by the retention job, not here. Best-effort: never throws.

import { consoleAuditSink, type MaeAuditRecord, type MaeAuditSink } from "@civica/demeter-engine";
import { supabaseAdmin } from "./supabase-server";

export const publicAuditSink: MaeAuditSink = async (rec: MaeAuditRecord) => {
  try {
    const db = supabaseAdmin();
    const { error } = await db
      .schema("snap_enrollment")
      .from("mae_query_log")
      .insert({
        staff_user_id: null,
        question_redacted: rec.questionRedacted,
        answer: rec.answer,
        citations: rec.citations,
        unrecognized_count: rec.unrecognizedCount,
        pii_redactions: rec.piiRedactions,
        model: rec.model,
        corpus_date: rec.corpusDate,
        mode: "public",
        scope_state: rec.scopeState ?? null,
        scope_ref: rec.scopeRef ?? null,
        // The evidence loop: the verdict shown to the reader, why it landed
        // there, and how the answer was produced. Without these persisted the
        // grounded-rate claim could only ever be asserted (migration 20260612).
        certainty: rec.certainty ?? null,
        certainty_code: rec.certaintyCode ?? null,
        verifier_outcome: rec.verifierOutcome ?? null,
        retrieval_mode: rec.retrievalMode ?? null,
      });
    if (error) throw error;
  } catch (err) {
    consoleAuditSink({ ...rec, answer: rec.answer.slice(0, 2000) });
    console.info(
      "[demeter-audit] public sink error:",
      err instanceof Error ? err.message : String(err),
    );
  }
};
