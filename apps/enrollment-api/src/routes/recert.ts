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
  const { user_message } = c.req.valid("json");
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
      ...(anthropicApiKey !== undefined && { anthropicApiKey }),
    });
  } catch (err) {
    // Session not in memory (e.g. Worker restart) — return 410 Gone so client can start fresh
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

export default app;
