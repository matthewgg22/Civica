// Dashboard audit sink for the Demeter engine — persists MaeAuditRecords to
// snap_enrollment.mae_query_log via the service role (a caseworker cannot
// suppress their own audit trail). Injected into answerQuestion() as the
// events.audit hook; the engine itself is storage-agnostic.
//
// Resilience: auditing must NEVER block or fail an answer. If the table isn't
// applied yet or the service key is unset, fall back to the engine's console
// sink (a structured stderr line the platform log drain captures).

import { consoleAuditSink, type MaeAuditRecord, type MaeAuditSink } from "@civica/demeter-engine";
import { createServiceClient } from "./supabase";

export const supabaseAuditSink: MaeAuditSink = async (rec: MaeAuditRecord) => {
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
    consoleAuditSink({
      ...rec,
      answer: rec.answer.slice(0, 2000),
    });
    console.info(
      "[mae-audit] sink error:",
      err instanceof Error ? err.message : String(err),
    );
  }
};
