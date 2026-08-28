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

import * as Sentry from "@sentry/nextjs";
import { VERIFIED_STATE_CODES, isAnswerLang } from "@civica/demeter-engine/packs";
import { supabaseAdmin } from "./supabase-server";

// The three client-echoed fields are validated to their real domain HERE, at
// the sink, so no caller can pollute the funnel this table exists to measure.
// The chat route already did this inline (UUID_RE + VERIFIED_STATE_CODES); the
// conversion routes (pdf / email-outline / conversations) passed a bare
// `typeof x === "string"` value straight through, so a crafted or oversized
// sessionId/state landed verbatim in an unbounded text column, and one route
// even stored a state NAME ("California") in a column the rest of the app keys
// on as a 2-letter CODE (launch audit 2026-08-28). Enforcing it once is the
// file's own stated rule — "NO FREE TEXT EVER" — made true for every caller.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A session id only if it is UUID-shaped (all sessions are), else null. */
function cleanSessionId(v: string | null | undefined): string | null {
  return typeof v === "string" && UUID_RE.test(v) ? v : null;
}
/** A verified 2-letter state code (uppercased), else null — never a name. */
function cleanStateCode(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const up = v.toUpperCase();
  return VERIFIED_STATE_CODES.includes(up) ? up : null;
}
/** One of the four answer languages, else null. */
function cleanLang(v: string | null | undefined): string | null {
  return typeof v === "string" && isAnswerLang(v) ? v : null;
}

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
        session_id: cleanSessionId(e.sessionId),
        turn_index: e.turnIndex ?? null,
        scope_state: cleanStateCode(e.scopeState),
        lang: cleanLang(e.lang),
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
    // Same lesson as the audit sink: a swallowed catch never reaches Sentry
    // on its own, and this table is how refusals are counted — losing it
    // silently means the funnel lies.
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { sink: "demeter_events", event: e.event },
    });
  }
}
