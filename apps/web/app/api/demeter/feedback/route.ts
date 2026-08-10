// POST /api/demeter/feedback — anonymous feedback on a public Demeter answer.
//
// The gap this closes: until now a wrong eligibility answer had no path back.
// The automatic checks (citation verifier, numeric gate, certainty) catch
// fabrication; they cannot catch an answer that is well-cited and still wrong
// for this person's situation. Only the reader can report that.
//
// Mirrors apps/dashboard's staff feedback route in shape and writes to the SAME
// table, so there is one triage queue — but the differences are the point:
//
//   - NO AUTH. The public surface is anonymous; requiring a login to report a
//     bad answer would filter out exactly the people most likely to get one.
//   - RATE LIMITED, because an unauthenticated write endpoint is otherwise an
//     open invitation. Namespaced key so this shares no budget with
//     /api/lead-capture.
//   - Carries state / language / certainty, which is what makes a report
//     triageable: a thumbs-down on an answer we marked CERTAIN is the loudest
//     row in the table.
//
// PII: notes are scrubbed before insert. Someone reporting a wrong answer is
// likely to explain their situation, and that explanation is exactly where an
// income figure or an address ends up.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { redactPii } from "@civica/demeter-engine";
import { isAnswerLang, VERIFIED_STATE_CODES } from "@civica/demeter-engine/packs";
import { rateLimit } from "../../lead-capture/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATINGS = new Set(["up", "down"]);
// Same enum as the staff route — one queue means one vocabulary.
const REASONS = new Set(["citation_wrong", "incorrect", "unclear", "other"]);
const MAX_NOTE = 2_000;
const MAX_SNAPSHOT = 8_000;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]?.trim() : null) || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  // Namespaced so submitting feedback does not consume someone's
  // lead-capture allowance (the limiter is a shared in-memory map).
  if (!rateLimit(`fb:${clientIp(req)}`)) {
    return NextResponse.json({ error: "Too many reports — try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rating = typeof body.rating === "string" ? body.rating : "";
  if (!RATINGS.has(rating)) {
    return NextResponse.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" && REASONS.has(body.reason) ? body.reason : null;
  const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  const rawState = typeof body.state === "string" ? body.state.toUpperCase() : null;
  const lang = typeof body.lang === "string" && isAnswerLang(body.lang) ? body.lang : null;
  const certainty =
    body.certainty === "certain" || body.certainty === "uncertain" ? body.certainty : null;

  // One row per REPORT. The client sends the same id for the immediate
  // thumbs-down and for the later reason+note, so the second call UPDATES
  // rather than inserting a duplicate — otherwise one person's single
  // complaint is counted twice and split across two `reason` buckets in the
  // rollup. Validated as a UUID because it reaches a uuid column.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const reportId =
    typeof body.reportId === "string" && UUID_RE.test(body.reportId) ? body.reportId : null;

  const note = clip(body.note, MAX_NOTE);
  const row = {
    report_id: reportId,
    staff_user_id: null,
    source: "public",
    rating,
    reason,
    note: note ? redactPii(note).redacted : null,
    question_redacted: redactPii(clip(body.question, MAX_SNAPSHOT)).redacted || null,
    answer: clip(body.answer, MAX_SNAPSHOT) || null,
    scope_state: rawState && VERIFIED_STATE_CODES.includes(rawState) ? rawState : null,
    lang,
    certainty,
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Unconfigured must not look like rejection to the person reporting: they
    // did their part, and telling them it failed teaches them not to bother.
    console.error("[demeter-feedback] missing Supabase service config");
    return NextResponse.json({ ok: true, stored: false }, { status: 202 });
  }

  const table = createClient(url, key, { auth: { persistSession: false } })
    .schema("snap_enrollment")
    .from("mae_feedback");
  // Upsert ONLY when the client supplied a report id. A row without one has
  // nothing to conflict on, and passing onConflict for a null key would make
  // every anonymous report collide with every other.
  const { error } = reportId
    ? await table.upsert(row, { onConflict: "report_id" })
    : await table.insert(row);
  if (error) {
    console.error("[demeter-feedback]", error);
    return NextResponse.json({ ok: true, stored: false }, { status: 202 });
  }
  return NextResponse.json({ ok: true, stored: true }, { status: 201 });
}
