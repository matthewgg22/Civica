import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

const createPacketSchema = z.object({
  applicant_id: z.string().uuid(),
  state_code: z.enum(["CA", "MA"]),
  org_id: z.string().uuid().optional(),
  county: z.string().max(100).optional(),
  county_fips: z.string().length(5).optional(),
});

const updatePacketSchema = z.object({
  status: z.enum([
    "Draft",
    "Submitted for Review",
    "Needs Documents",
    "Needs Applicant Clarification",
    "In Navigator Review",
    "Ready for Handoff",
    "Handed Off",
    "Closed",
  ]).optional(),
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
    .insert({ ...body, status: "Draft" })
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
      await db.rpc("set_config", {
        setting_name: "snap_enrollment.transition_reason",
        new_value: reason,
        is_local: true,
      } as never);
    }
  }

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .update(body)
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
