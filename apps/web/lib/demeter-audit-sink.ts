// Public-chat audit sink — persists engine MaeAuditRecords to the same
// snap_enrollment.mae_query_log table the staff dashboard uses (mode
// "public", staff_user_id null). PII was already scrubbed by the engine;
// retention policy (T7): question text lives 7 days, flagged rows 30 —
// enforced by the retention job, not here. Best-effort: never throws.

import { consoleAuditSink, type MaeAuditRecord, type MaeAuditSink } from "@civica/demeter-engine";
import * as Sentry from "@sentry/nextjs";
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
        session_id: rec.sessionId ?? null,
        turn_index: rec.turnIndex ?? null,
        // The evidence loop: the verdict shown to the reader, why it landed
        // there, and how the answer was produced. Without these persisted the
        // grounded-rate claim could only ever be asserted (migration 20260612).
        question_topic: rec.questionTopic ?? null,
        certainty: rec.certainty ?? null,
        certainty_code: rec.certaintyCode ?? null,
        verifier_outcome: rec.verifierOutcome ?? null,
        retrieval_mode: rec.retrievalMode ?? null,
        // COST. Fewer than 30 short prompts cost about a dollar and there was
        // no way to find out why, because this table had no token counts at
        // all — spend attributed to no state, no turn, and no retry. Summed
        // over the answer, so a citation-failure retry (a second full
        // generation) shows as one expensive row rather than vanishing.
        input_tokens: rec.inputTokens ?? null,
        output_tokens: rec.outputTokens ?? null,
        // WHAT THE LOG COULD NOT ANSWER. mae_feedback has carried `lang`
        // since the start and this table never did, so "are the Spanish
        // answers worse" was unanswerable for a product shipping in four
        // languages. `mode` is public/case — who is asking; worksheet_mode is
        // ask/estimate — what they are doing. And an answer that took thirty
        // seconds was indistinguishable from one that took three.
        lang: rec.lang ?? null,
        worksheet_mode: rec.worksheetMode ?? null,
        ttft_ms: rec.ttftMs ?? null,
        total_ms: rec.totalMs ?? null,
        stopped: rec.stopped ?? false,
      });
    if (error) throw error;
  } catch (err) {
    // Diagnostic fallback: the STRUCTURED shape of the failed row, never its
    // content (launch audit 2026-08-28). answer + questionRedacted live in
    // mae_query_log behind RLS and the pg_cron retention sweep; server logs
    // (Vercel/Sentry) have neither. Dumping the answer text here — as this did
    // — routes content around the very controls the table applies to it. Length
    // markers keep "was it empty / how long" answerable without the content.
    consoleAuditSink({
      ...rec,
      answer: `[${rec.answer.length} chars omitted]`,
      questionRedacted: `[${rec.questionRedacted.length} chars omitted]`,
    });
    // console.ERROR, not info (#1049). Best-effort is right — an audit failure
    // must never break someone's answer — but this was info, and info is not
    // an alarm. mae_query_log recorded NOTHING for twelve days: every insert
    // was rejected with `column "input_tokens" does not exist`, because the
    // migration adding it shipped in the same commit as the code that writes
    // it and was never pasted into prod. The chat answered perfectly
    // throughout, so nothing outside this line could have shown it.
    //
    // No static check reaches that: the migration IS in the repo, so the code
    // and the tree agree. Only the live database disagreed, and this line is
    // the one signal that crosses the gap.
    console.error(
      "[demeter-audit] public sink error:",
      err instanceof Error ? err.message : String(err),
    );
    // AND IT PAGES (launch audit 2026-08-28). #1050 promoted this to
    // console.error and its commit claimed that "reaches Sentry" — it did
    // not: nothing captures console output, and this catch swallows the
    // exception, so Sentry's unhandled-error hook never sees it either. The
    // twelve-day outage this guards against would have been exactly as
    // invisible after #1050 as before it. captureException is the only call
    // here that actually rings.
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { sink: "mae_query_log" },
    });
  }
};
