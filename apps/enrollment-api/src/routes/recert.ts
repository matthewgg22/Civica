import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";
import { recertEngine } from "@civica/recert-engine";
import type { PacketSnapshot } from "@civica/recert-engine";

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const initRecertSchema = z.object({
  cert_period_end: z.string().optional(),                  // ISO date YYYY-MM-DD
  cert_period_end_source: z.enum(["estimated", "manual", "agency_confirmed"]).optional(),
});

const patchRecertSchema = z.object({
  status: z.enum([
    "pending",
    "interview_scheduled",
    "interview_complete",
    "submitted",
    "approved",
    "denied",
    "opted_out",
    "lapsed",
  ]).optional(),
  outcome: z.enum(["approved", "denied", "withdrawn", "lapsed"]).optional(),
  opted_out_at: z.string().nullable().optional(),
  interview_completed_at: z.string().nullable().optional(),
  submitted_at: z.string().nullable().optional(),
});

const respondSchema = z.object({
  user_message: z.string().min(1),
  // Voice-input duration (bytes captured by SNAPVoiceIntakeService on-device).
  // Optional — text-input call sites omit it. Threaded through to the
  // orchestrator as a "stuck vs confident" signal for the AI coach.
  audio_bytes_duration: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Packet snapshot builder — maps packet_answers rows to a PersonalizeQuestions snapshot
// ---------------------------------------------------------------------------

function buildSnapshot(
  state: 'CA' | 'MA',
  answers: Array<{ question_key: string; applicant_answer: string | null }>,
): PacketSnapshot {
  const get = (key: string): string | null =>
    answers.find((a) => a.question_key === key)?.applicant_answer ?? null;

  return {
    state_code: state,
    is_employed: get("employment_status") === "employed",
    income_source_count: parseInt(get("income_source_count") ?? "1") || 1,
    has_dependent_under_6: get("has_dependent_under_6") === "true",
    has_dependent_under_14: get("has_dependent_under_14") === "true",
    has_students: get("has_students") === "true",
    has_vehicles: get("has_vehicles") === "true",
    has_bank_accounts: get("has_bank_accounts") === "true",
    is_subject_to_work_requirements: get("is_subject_to_work_requirements") === "true",
  };
}

// ---------------------------------------------------------------------------
// Auth guard helper — navigator or above
// ---------------------------------------------------------------------------

function requireNavigator(actor: { kind: string }): void {
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Navigator role required" });
  }
}

// ---------------------------------------------------------------------------
// POST /v1/enrollment/recert/:packetId/init
// Creates a recertification record for a packet.
// ---------------------------------------------------------------------------

app.post("/:packetId/init", zValidator("json", initRecertSchema), async (c) => {
  const actor = c.get("actor");
  requireNavigator(actor);

  const packetId = c.req.param("packetId");
  const body = c.req.valid("json");
  const db = await withActorContext(c);

  // Fetch the packet to resolve org_id + created_at + state_code
  const { data: packet, error: packetErr } = await makeAnonClient(c.env, c.get("jwt"))
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, org_id, state_code, created_at")
    .eq("packet_id", packetId)
    .is("deleted_at", null)
    .single();

  if (packetErr?.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
  if (packetErr) throw new HTTPException(500, { message: packetErr.message });

  // Determine cert period end — use provided value or estimate from enrollment date
  let certPeriodEnd: string;
  let certPeriodEndSource: "estimated" | "manual" | "agency_confirmed";

  if (body.cert_period_end) {
    certPeriodEnd = body.cert_period_end;
    certPeriodEndSource = body.cert_period_end_source ?? "manual";
  } else {
    // Estimate based on packet enrollment date + state/household type heuristic
    // We default to "standard" household type at init time; navigators can adjust status later.
    const estimate = recertEngine.deadline.estimate({
      enrolledAt: packet.created_at,
      state: packet.state_code as "CA" | "MA",
      householdType: "standard",
    });
    certPeriodEnd = estimate.certPeriodEnd;
    certPeriodEndSource = "estimated";
  }

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("recertifications")
    .insert({
      packet_id: packetId,
      org_id: packet.org_id ?? actor.orgId ?? "",
      cert_period_end: certPeriodEnd,
      cert_period_end_source: certPeriodEndSource,
      status: "pending",
    })
    .select()
    .single();

  if (error?.code === "23505") throw new HTTPException(409, { message: "Recertification already exists for this packet" });
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(data, 201);
});

// ---------------------------------------------------------------------------
// GET /v1/enrollment/recert/:packetId
// Returns recertification status + reminder schedule for a packet.
// ---------------------------------------------------------------------------

app.get("/:packetId", async (c) => {
  const actor = c.get("actor");
  requireNavigator(actor);

  const packetId = c.req.param("packetId");
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("recertifications")
    .select("*")
    .eq("packet_id", packetId)
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Recertification not found" });
  if (error) throw new HTTPException(500, { message: error.message });

  // Enrich with computed reminder schedule
  const schedule = recertEngine.deadline.reminders({ certPeriodEnd: data.cert_period_end });

  return c.json({ ...data, reminder_schedule: schedule });
});

// ---------------------------------------------------------------------------
// PATCH /v1/enrollment/recert/:recertId
// Update status, outcome, opt-out, or timestamps.
// ---------------------------------------------------------------------------

app.patch("/:recertId", zValidator("json", patchRecertSchema), async (c) => {
  const actor = c.get("actor");
  requireNavigator(actor);

  const recertId = c.req.param("recertId");
  const body = c.req.valid("json");
  const db = await withActorContext(c);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {};
  if (body.status !== undefined) updatePayload['status'] = body.status;
  if (body.outcome !== undefined) updatePayload['outcome'] = body.outcome;
  if (body.opted_out_at !== undefined) updatePayload['opted_out_at'] = body.opted_out_at;
  if (body.interview_completed_at !== undefined) updatePayload['interview_completed_at'] = body.interview_completed_at;
  if (body.submitted_at !== undefined) updatePayload['submitted_at'] = body.submitted_at;

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("recertifications")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq("recert_id", recertId)
    .select()
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Recertification not found" });
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(data);
});

// ---------------------------------------------------------------------------
// POST /v1/enrollment/recert/:recertId/practice/start
// Starts a new AI practice interview session.
// ---------------------------------------------------------------------------

app.post("/:recertId/practice/start", async (c) => {
  // Practice sessions are applicant-facing — applicants practice their own
  // recert interview. RLS via anonDb (below) enforces that an applicant can
  // only start a session on a recertification they own. Navigators may also
  // start sessions on packets they have access to, also enforced by RLS.
  // No role guard needed here.

  const recertId = c.req.param("recertId");
  const db = await withActorContext(c);
  const anonDb = makeAnonClient(c.env, c.get("jwt"));

  // Fetch recertification to get packet + org context
  const { data: recert, error: recertErr } = await anonDb
    .schema("snap_enrollment")
    .from("recertifications")
    .select("recert_id, org_id, packet_id")
    .eq("recert_id", recertId)
    .single();

  if (recertErr?.code === "PGRST116") throw new HTTPException(404, { message: "Recertification not found" });
  if (recertErr) throw new HTTPException(500, { message: recertErr.message });

  // Fetch packet to get state_code
  const { data: packet, error: packetErr } = await anonDb
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("state_code")
    .eq("packet_id", recert.packet_id)
    .single();

  if (packetErr) throw new HTTPException(500, { message: packetErr.message });

  const state = packet.state_code as "CA" | "MA";

  // Fetch packet answers to build a personalized snapshot
  const { data: answers } = await anonDb
    .schema("snap_enrollment")
    .from("packet_answers")
    .select("question_key, applicant_answer")
    .eq("packet_id", recert.packet_id);

  const snapshot = buildSnapshot(state, Array.isArray(answers) ? answers : []);

  // Start the in-memory interview session
  const { sessionId, firstQuestion } = recertEngine.interview.start({
    recertId,
    packetSnapshot: snapshot,
    state,
  });

  // Persist the session row
  const { data: session, error: sessionErr } = await db
    .schema("snap_enrollment")
    .from("recert_practice_sessions")
    .insert({
      session_id: sessionId,
      recert_id: recertId,
      org_id: recert.org_id,
      state_code: state,
      turn_count: 0,
      flags: [],
      done: false,
    })
    .select()
    .single();

  if (sessionErr) throw new HTTPException(500, { message: sessionErr.message });

  // Persist the first turn (no response yet) so the score endpoint can recover
  // the transcript even after a Worker restart. See migration 20260562.
  const { error: turnErr } = await db
    .schema("snap_enrollment")
    .from("recert_practice_turns")
    .insert({
      session_id: session.session_id,
      turn_index: 0,
      caseworker_question: firstQuestion.questionText,
      applicant_response: null,
      coaching: null,
      asked_at: new Date().toISOString(),
    });

  if (turnErr) throw new HTTPException(500, { message: turnErr.message });

  return c.json({ session_id: session.session_id, first_question: firstQuestion }, 201);
});

// ---------------------------------------------------------------------------
// POST /v1/enrollment/recert/:recertId/practice/:sessionId/respond
// Submit a response to the current interview question.
// ---------------------------------------------------------------------------

app.post("/:recertId/practice/:sessionId/respond", zValidator("json", respondSchema), async (c) => {
  // Applicant-facing route — RLS via anonDb enforces session ownership.

  const recertId = c.req.param("recertId");
  const sessionId = c.req.param("sessionId");
  const { user_message, audio_bytes_duration } = c.req.valid("json");
  const db = await withActorContext(c);
  const anonDb = makeAnonClient(c.env, c.get("jwt"));

  // Verify session exists in DB
  const { data: session, error: sessionErr } = await anonDb
    .schema("snap_enrollment")
    .from("recert_practice_sessions")
    .select("session_id, recert_id, turn_count, flags, done")
    .eq("session_id", sessionId)
    .eq("recert_id", recertId)
    .single();

  if (sessionErr?.code === "PGRST116") throw new HTTPException(404, { message: "Session not found" });
  if (sessionErr) throw new HTTPException(500, { message: sessionErr.message });

  if (session.done) {
    throw new HTTPException(409, { message: "Session already completed" });
  }

  // Run the in-memory orchestrator
  const aiEnabled = c.env.RECERT_AI_ENABLED === 'true';
  const anthropicApiKey = aiEnabled ? c.env.ANTHROPIC_API_KEY : undefined;
  let result: Awaited<ReturnType<typeof recertEngine.interview.respond>>;
  try {
    result = await recertEngine.interview.respond({
      sessionId,
      userMessage: user_message,
      ...(audio_bytes_duration !== undefined && { audioBytesDuration: audio_bytes_duration }),
      ...(anthropicApiKey !== undefined && { anthropicApiKey }),
    });
  } catch (err) {
    // Session not in memory (e.g. Worker restart) — return 410 Gone so client can start fresh.
    // Note: scoring no longer relies on in-memory state (transcript is now persisted to
    // recert_practice_turns), so this 410 only fires for mid-session restarts where the
    // orchestrator's question-index state is lost. v2 follow-up: rehydrate orchestrator
    // state from the turns table instead of forcing a restart.
    throw new HTTPException(410, { message: "Session state lost; please start a new practice session" });
  }

  const { turn, flags, done, coaching } = result;

  // Merge new flags with existing flags array
  const existingFlags = Array.isArray(session.flags) ? session.flags : [];
  const updatedFlags = [...existingFlags, ...flags];

  // Update DB session
  const { error: updateErr } = await db
    .schema("snap_enrollment")
    .from("recert_practice_sessions")
    .update({
      turn_count: session.turn_count + 1,
      flags: updatedFlags,
      done,
      ...(done && { completed_at: new Date().toISOString() }),
    })
    .eq("session_id", sessionId);

  if (updateErr) throw new HTTPException(500, { message: updateErr.message });

  // Persist transcript: (1) record the applicant's response + coaching on the
  // turn that was just answered; (2) if more turns are coming, insert the next
  // caseworker question with applicant_response = null. See migration 20260562.
  const respondedTurnIndex = session.turn_count; // 0-indexed; matches the turn that just got answered
  const nowIso = new Date().toISOString();

  const { error: turnUpdateErr } = await db
    .schema("snap_enrollment")
    .from("recert_practice_turns")
    .update({
      applicant_response: user_message,
      coaching,
      ...(audio_bytes_duration !== undefined && { audio_bytes_duration }),
      responded_at: nowIso,
    })
    .eq("session_id", sessionId)
    .eq("turn_index", respondedTurnIndex);

  if (turnUpdateErr) throw new HTTPException(500, { message: turnUpdateErr.message });

  if (!done) {
    const { error: turnInsertErr } = await db
      .schema("snap_enrollment")
      .from("recert_practice_turns")
      .insert({
        session_id: sessionId,
        turn_index: respondedTurnIndex + 1,
        caseworker_question: turn.questionText,
        applicant_response: null,
        coaching: null,
        asked_at: nowIso,
      });

    if (turnInsertErr) throw new HTTPException(500, { message: turnInsertErr.message });
  }

  return c.json({ turn, flags, done, coaching });
});

// ---------------------------------------------------------------------------
// GET /v1/enrollment/recert/:recertId/practice/:sessionId
// Returns session state: turn_count, flags, done status.
// ---------------------------------------------------------------------------

app.get("/:recertId/practice/:sessionId", async (c) => {
  // Applicant-facing route — RLS via anonDb enforces session ownership.

  const recertId = c.req.param("recertId");
  const sessionId = c.req.param("sessionId");
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("recert_practice_sessions")
    .select("session_id, recert_id, state_code, turn_count, flags, done, started_at, completed_at")
    .eq("session_id", sessionId)
    .eq("recert_id", recertId)
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Session not found" });
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(data);
});

// ---------------------------------------------------------------------------
// POST /v1/enrollment/recert/:recertId/practice/:sessionId/score
// Generate (or return cached) end-of-session score for a completed session.
// Idempotent: a second call returns the existing row.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

interface ScoreRow {
  session_id: string;
  overall_score: number;
  strengths: unknown;
  improvements: unknown;
  summary_en: string;
  summary_es: string;
  engine_version: string;
  generated_at: string;
}

async function fetchExistingScore(anonDb: AnyDb, sessionId: string): Promise<ScoreRow | null> {
  const { data, error } = await anonDb
    .schema("snap_enrollment")
    .from("recert_practice_scores")
    .select("session_id, overall_score, strengths, improvements, summary_en, summary_es, engine_version, generated_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new HTTPException(500, { message: error.message });
  }
  return (data ?? null) as ScoreRow | null;
}

async function insertScore(db: AnyDb, payload: Record<string, unknown>): Promise<{ data: ScoreRow | null; code?: string; message?: string }> {
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("recert_practice_scores")
    .insert(payload)
    .select("session_id, overall_score, strengths, improvements, summary_en, summary_es, engine_version, generated_at")
    .single();
  return { data: (data ?? null) as ScoreRow | null, code: error?.code, message: error?.message };
}

app.post("/:recertId/practice/:sessionId/score", async (c) => {
  // Applicant-facing — RLS via anonDb enforces session ownership.

  const recertId = c.req.param("recertId");
  const sessionId = c.req.param("sessionId");
  const db: AnyDb = await withActorContext(c);
  const anonDb: AnyDb = makeAnonClient(c.env, c.get("jwt"));

  // Verify session exists and is complete
  const { data: session, error: sessionErr } = await anonDb
    .schema("snap_enrollment")
    .from("recert_practice_sessions")
    .select("session_id, recert_id, state_code, flags, done")
    .eq("session_id", sessionId)
    .eq("recert_id", recertId)
    .single();

  if (sessionErr?.code === "PGRST116") throw new HTTPException(404, { message: "Session not found" });
  if (sessionErr) throw new HTTPException(500, { message: sessionErr.message });

  if (!session.done) {
    throw new HTTPException(400, { message: "Session is not complete; finish the interview first" });
  }

  // Idempotency: return existing score if present
  const existing = await fetchExistingScore(anonDb, sessionId);
  if (existing) {
    return c.json(existing);
  }

  // Generate fresh — pull transcript from the persisted recert_practice_turns
  // table. Resilient to Worker restarts: scoring no longer depends on the
  // in-memory orchestrator state. Sessions completed BEFORE migration 20260562
  // applied will have no turn rows and surface as 404 here.
  const { data: turnRows, error: turnsErr } = await anonDb
    .schema("snap_enrollment")
    .from("recert_practice_turns")
    .select("turn_index, caseworker_question, applicant_response, coaching")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: true });

  if (turnsErr) throw new HTTPException(500, { message: turnsErr.message });

  if (!turnRows || turnRows.length === 0) {
    // Either the session predates persistence (migration 20260562) or some
    // other anomaly. Either way, no transcript = no score.
    throw new HTTPException(404, { message: "No turns found for this session" });
  }

  // Map persisted rows to the InterviewTurn shape the scorer expects. The
  // questionId is not persisted (we only need question text + response for
  // scoring), so synthesize a stable id from turn_index.
  const turns = (turnRows as Array<{
    turn_index: number;
    caseworker_question: string;
    applicant_response: string | null;
    coaching: unknown;
  }>).map((t) => {
    const base: { questionId: string; questionText: string; response?: string } = {
      questionId: `turn-${t.turn_index}`,
      questionText: t.caseworker_question,
    };
    if (t.applicant_response !== null) base.response = t.applicant_response;
    return base;
  });

  const aiEnabled = c.env.RECERT_AI_ENABLED === "true";
  const apiKey = aiEnabled ? c.env.ANTHROPIC_API_KEY : undefined;
  if (!apiKey) {
    throw new HTTPException(503, { message: "Practice scoring requires RECERT_AI_ENABLED and an ANTHROPIC_API_KEY" });
  }

  // session.flags is the accumulated set captured on the sessions row.
  const persistedFlags = Array.isArray(session.flags)
    ? (session.flags as Array<{ type: string; description: string }>)
    : [];

  let result: Awaited<ReturnType<typeof recertEngine.scorer.scoreSession>>;
  try {
    result = await recertEngine.scorer.scoreSession(
      {
        sessionId,
        turns,
        flags: persistedFlags,
        stateCode: session.state_code as "CA" | "MA",
      },
      { apiKey },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Score generation failed";
    throw new HTTPException(502, { message });
  }

  const generatedAt = new Date().toISOString();

  const insertResult = await insertScore(db, {
    session_id: sessionId,
    overall_score: result.overall_score,
    strengths: result.strengths,
    improvements: result.improvements,
    summary_en: result.summary_en,
    summary_es: result.summary_es,
    engine_version: result.engine_version,
    generated_at: generatedAt,
  });

  if (insertResult.code) {
    // 23505 = unique violation — race with concurrent generate; re-fetch + return.
    if (insertResult.code === "23505") {
      const raced = await fetchExistingScore(anonDb, sessionId);
      if (raced) return c.json(raced);
    }
    throw new HTTPException(500, { message: insertResult.message ?? "Insert failed" });
  }

  return c.json(insertResult.data, 201);
});

export default app;
