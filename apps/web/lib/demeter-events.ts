// Everything that is not an answer.
//
// mae_query_log records answers. Every early return in /api/demeter — 429,
// the daily IP cap, at-capacity, malformed input — happens BEFORE the audit
// sink exists, so a person who hit a wall and left was invisible, and "how
// often does someone hit a wall" could not be asked at all (#1049 follow-on).
//
// Conversions land here too, keyed the same way, so the funnel from "asked a
// question" to "took the outline away" is one query rather than a join across
// tables that do not share a key.
//
// BEST-EFFORT, LIKE THE AUDIT SINK: recording must never break a response.
// But the failure is console.ERROR, not info — that distinction is the whole
// lesson of #1049, where a total logging outage looked like nothing at all.
//
// NO FREE TEXT EVER. `detail` takes codes and counts. The question itself
// belongs in mae_query_log, where the retention job can reach it; nothing
// here should need tombstoning, and a jsonb blob is where PII hides.

import { supabaseAdmin } from "./supabase-server";

export type DemeterEventKind = "failure" | "conversion";

export type DemeterFailure =
  | "rate_limited"
  | "ip_daily_cap"
  | "at_capacity"
  | "unconfigured"
  | "bad_request"
  | "stream_error";

export type DemeterConversion =
  | "saved"
  | "pdf_downloaded"
  | "outline_emailed"
  | "portal_opened";

export interface DemeterEvent {
  kind: DemeterEventKind;
  event: DemeterFailure | DemeterConversion;
  status?: number | null;
  sessionId?: string | null;
  turnIndex?: number | null;
  scopeState?: string | null;
  lang?: string | null;
  /** Codes and counts only — never anything the reader typed. */
  detail?: Record<string, string | number | boolean | null>;
}

export async function recordDemeterEvent(e: DemeterEvent): Promise<void> {
  try {
    const { error } = await supabaseAdmin()
      .schema("snap_enrollment")
      .from("demeter_events")
      .insert({
        kind: e.kind,
        event: e.event,
        status: e.status ?? null,
        session_id: e.sessionId ?? null,
        turn_index: e.turnIndex ?? null,
        scope_state: e.scopeState ?? null,
        lang: e.lang ?? null,
        detail: e.detail ?? {},
      });
    if (error) throw error;
  } catch (err) {
    // Loud, for the reason #1049 exists.
    console.error(
      "[demeter-events] sink error:",
      e.kind,
      e.event,
      err instanceof Error ? err.message : String(err),
    );
  }
}
