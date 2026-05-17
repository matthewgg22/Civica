import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";
import { evaluateChecklist } from "@civica/snap-rules";
import type { ChecklistAnswers } from "@civica/snap-rules";

// Canonical source: packages/snap-enums/src/packetStatus.ts — inlined to avoid
// a circular dependency between the enrollment-api bundle and snap-enums build.
const PacketStatusSchema = z.enum([
  "Draft",
  "Submitted for Review",
  "Needs Documents",
  "Needs Applicant Clarification",
  "In Navigator Review",
  "Ready for Handoff",
  "Handed Off",
  "Closed",
]);

const app = new Hono<{ Bindings: Env }>();

const createPacketSchema = z.object({
  applicant_id: z.string().uuid(),
  state_code: z.enum(["CA", "MA"]),
  org_id: z.string().uuid().optional(),
  county: z.string().max(100).optional(),
  county_fips: z.string().length(5).optional(),
});

const updatePacketSchema = z.object({
  status: PacketStatusSchema.optional(),
  notes_for_applicant: z.string().max(2000).optional(),
  org_id: z.string().uuid().optional(),
});

// List packets — scoped by RLS to caller's org or own packets
app.get("/", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select(`
      packet_id, status, state_code, county, created_at, updated_at, submitted_at,
      applicants(applicant_id, state_code, preferred_language),
      packet_assignments(staff_id, is_current)
    `)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Get single packet
app.get("/:packetId", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select(`
      *,
      applicants(*),
      packet_answers(*),
      required_document_items(*),
      packet_assignments(*, staff_users(staff_id, display_name, email)),
      navigator_notes(note_id, is_internal, created_at, updated_at, author_staff_id)
    `)
    .eq("packet_id", c.req.param("packetId"))
    .is("deleted_at", null)
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Create packet
app.post("/", zValidator("json", createPacketSchema), async (c) => {
  const body = c.req.valid("json");
  const db = await withActorContext(c);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .insert({
      applicant_id: body.applicant_id,
      state_code: body.state_code,
      status: "Draft" as const,
      org_id: body.org_id ?? null,
      county: body.county ?? null,
      county_fips: body.county_fips ?? null,
    })
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data, 201);
});

// Update packet (status transitions go through here — guard trigger enforces validity)
app.patch("/:packetId", zValidator("json", updatePacketSchema), async (c) => {
  const body = c.req.valid("json");
  const db = await withActorContext(c);

  if (body.status) {
    const reason = c.req.header("X-Transition-Reason");
    if (reason) {
      type SetConfigArgs = { setting_name: string; new_value: string; is_local: boolean };
      const rpc = db.rpc.bind(db) as unknown as (fn: string, args: SetConfigArgs) => Promise<unknown>;
      await rpc("set_config", { setting_name: "snap_enrollment.transition_reason", new_value: reason, is_local: true });
    }
  }

  const updateFields = {
    ...(body.status !== undefined && { status: body.status }),
    notes_for_applicant: body.notes_for_applicant ?? null,
    org_id: body.org_id ?? null,
  };
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .update({
      ...(body.status !== undefined && { status: body.status }),
      ...(body.notes_for_applicant !== undefined && { notes_for_applicant: body.notes_for_applicant }),
      ...(body.org_id !== undefined && { org_id: body.org_id }),
    })
    .eq("packet_id", c.req.param("packetId"))
    .select()
    .single();

  if (error?.code === "P0001") throw new HTTPException(422, { message: error.message });
  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
  if (error) throw new HTTPException(500, { message: error.message });

  // Auto-seed required document items when a packet enters "Needs Documents".
  // Idempotent: skipped when items already exist (manual seed or re-transition).
  if (body.status === "Needs Documents" && data) {
    const packetId = c.req.param("packetId");

    const { count } = await db
      .schema("snap_enrollment")
      .from("required_document_items")
      .select("item_id", { count: "exact", head: true })
      .eq("packet_id", packetId);

    if ((count ?? 0) === 0) {
      const { data: answerRows } = await db
        .schema("snap_enrollment")
        .from("packet_answers")
        .select("question_key, applicant_answer")
        .eq("packet_id", packetId);

      const answers = packetAnswersToChecklistAnswers(answerRows ?? []);
      const { items } = evaluateChecklist({ state: data.state_code, answers });

      if (items.length > 0) {
        await db
          .schema("snap_enrollment")
          .from("required_document_items")
          .insert(
            items.map((item) => ({
              packet_id: packetId,
              state_code: data.state_code,
              document_kind: item.category,
              label: item.label,
              is_required: true as const,
            }))
          );
      }
    }
  }

  return c.json(data);
});

// Maps packet_answers rows (question_key + applicant_answer string pairs) to the
// typed ChecklistAnswers the rules engine understands. Question keys are defined
// in src/lib/questions.ts; income_sources answers are stored as a JSON array string.
function packetAnswersToChecklistAnswers(
  rows: Array<{ question_key: string; applicant_answer: string | null }>
): ChecklistAnswers {
  const m = new Map(rows.map((r) => [r.question_key, r.applicant_answer ?? ""]));
  const EARNED = new Set(["employed_full_time", "employed_part_time", "self_employed"]);
  const UNEARNED = new Set(["social_security", "ssi", "unemployment", "child_support", "pension", "rental_income"]);

  const answers: ChecklistAnswers = {};

  const sizeRaw = m.get("household_size");
  if (sizeRaw) {
    const n = parseInt(sizeRaw, 10);
    if (!isNaN(n) && n > 0) answers.household_size = n;
  }

  const employment = m.get("employment_status");
  if (employment) answers.has_earned_income = EARNED.has(employment);

  const sourcesRaw = m.get("income_sources");
  if (sourcesRaw) {
    let sources: string[] = [];
    try {
      const parsed: unknown = JSON.parse(sourcesRaw);
      if (Array.isArray(parsed)) sources = parsed as string[];
    } catch {
      sources = sourcesRaw.split(",").map((s) => s.trim()).filter(Boolean);
    }
    answers.has_unearned_income = sources.some((s) => UNEARNED.has(s));
  }

  const rent = m.get("monthly_rent_or_mortgage");
  if (rent) answers.claims_shelter_deduction = parseFloat(rent) > 0;

  const utils = m.get("monthly_utilities");
  if (utils) answers.claims_utility_deduction = parseFloat(utils) > 0;

  return answers;
}

// Status history
app.get("/:packetId/history", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("packet_status_history")
    .select("*")
    .eq("packet_id", c.req.param("packetId"))
    .order("occurred_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

export default app;
