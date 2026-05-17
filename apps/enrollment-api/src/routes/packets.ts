import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";
import { evaluateChecklist } from "@civica/snap-rules";

// Canonical source: packages/snap-enums/src/packetStatus.ts
// Inlined here to avoid adding a workspace dep for a single enum.
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
  // OBBBA §10102(a) distress-review gate: navigator's decision on expedited routing
  is_expedited: z.boolean().optional(),
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

  // Seed required document items from the rules engine. Uses empty answers so
  // only always-required items are created at packet creation; items are
  // re-evaluated (and additional rows inserted) when the applicant submits answers.
  // Seed required document items from the rules engine. Uses empty answers so
  // only always-required items are created at packet creation; items are
  // re-evaluated (and additional rows inserted) when the applicant submits answers.
  const checklist = evaluateChecklist({ state_code: body.state_code, household_size: 1, answers: {} });
  if (checklist.required_items.length > 0) {
    const { error: itemsError } = await db
      .schema("snap_enrollment")
      .from("required_document_items")
      .insert(
        checklist.required_items.map((item) => ({
          packet_id: data.packet_id,
          state_code: body.state_code,
          // Cast is safe: snap-rules Zod schema constrains document_kind to the DB enum values.
          document_kind: item.document_kind as "paystub" | "photo_id" | "lease" | "utility_bill" | "bank_statement" | "tax_return" | "benefit_letter" | "other",
          label: item.label_en,
          is_required: item.is_required,
        })),
      );
    if (itemsError) throw new HTTPException(500, { message: itemsError.message });
  }

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
      ...(body.is_expedited !== undefined && { is_expedited: body.is_expedited }),
    })
    .eq("packet_id", c.req.param("packetId"))
    .select()
    .single();

  if (error?.code === "P0001") throw new HTTPException(422, { message: error.message });
  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

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
