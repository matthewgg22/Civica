import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";
import { evaluateChecklist } from "@civica/snap-rules";

const app = new Hono<{ Bindings: Env }>();

// List required document items for a packet
app.get("/packets/:packetId/document-items", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("required_document_items")
    .select("*")
    .eq("packet_id", c.req.param("packetId"))
    .order("created_at");

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

const resolveItemSchema = z.object({
  resolved_document_id: z.string().uuid().optional(),
});

const waiveItemSchema = z.object({
  waive_reason: z.string().min(1).max(1000),
});

// Mark a required document item as resolved (document received)
app.patch("/document-items/:itemId/resolve", zValidator("json", resolveItemSchema), async (c) => {
  const body = c.req.valid("json");
  const db = await withActorContext(c);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("required_document_items")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_document_id: body.resolved_document_id ?? null,
      waived_at: null,
    })
    .eq("item_id", c.req.param("itemId"))
    .select()
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Document item not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Waive a required document item (navigator override with reason)
app.patch("/document-items/:itemId/waive", zValidator("json", waiveItemSchema), async (c) => {
  const body = c.req.valid("json");
  const actor = c.get("actor");
  const db = await withActorContext(c);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("required_document_items")
    .update({
      waived_at: new Date().toISOString(),
      waive_reason: body.waive_reason,
      waived_by_staff_id: actor.kind !== "applicant" ? actor.id : null,
      resolved_at: null,
    })
    .eq("item_id", c.req.param("itemId"))
    .select()
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Document item not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

const seedDocumentItemsSchema = z.object({
  answers: z.object({
    household_size: z.number().int().min(1).optional(),
    has_earned_income: z.boolean().optional(),
    has_unearned_income: z.boolean().optional(),
    claims_shelter_deduction: z.boolean().optional(),
    claims_utility_deduction: z.boolean().optional(),
  }),
});

// Seed required_document_items for a packet using the rules engine.
// Idempotent — re-seeding an already-seeded packet is a 409.
// The caller provides answers (from packet_answers) so the rules engine
// can determine which document categories apply to this household.
app.post(
  "/packets/:packetId/seed-document-items",
  zValidator("json", seedDocumentItemsSchema),
  async (c) => {
    const body = c.req.valid("json");
    const packetId = c.req.param("packetId");
    const db = await withActorContext(c);

    // Fetch the packet to get state_code.
    const { data: packet, error: packetErr } = await db
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, state_code")
      .eq("packet_id", packetId)
      .is("deleted_at", null)
      .single();

    if (packetErr?.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
    if (packetErr) throw new HTTPException(500, { message: packetErr.message });

    // Reject if items already exist (idempotency guard).
    const { count, error: countErr } = await db
      .schema("snap_enrollment")
      .from("required_document_items")
      .select("item_id", { count: "exact", head: true })
      .eq("packet_id", packetId);

    if (countErr) throw new HTTPException(500, { message: countErr.message });
    if ((count ?? 0) > 0) {
      throw new HTTPException(409, {
        message: "Document items already seeded for this packet. Waive or resolve existing items instead.",
      });
    }

    // Build answers without undefined-valued keys so that
    // exactOptionalPropertyTypes is satisfied at the snap-rules boundary.
    const ra = body.answers;
    const { items } = evaluateChecklist({
      state: packet.state_code,
      answers: {
        ...(ra.household_size !== undefined && { household_size: ra.household_size }),
        ...(ra.has_earned_income !== undefined && { has_earned_income: ra.has_earned_income }),
        ...(ra.has_unearned_income !== undefined && { has_unearned_income: ra.has_unearned_income }),
        ...(ra.claims_shelter_deduction !== undefined && { claims_shelter_deduction: ra.claims_shelter_deduction }),
        ...(ra.claims_utility_deduction !== undefined && { claims_utility_deduction: ra.claims_utility_deduction }),
      },
    });

    if (items.length === 0) {
      return c.json({ seeded: 0, items: [] }, 200);
    }

    const rows = items.map((item) => ({
      packet_id: packetId,
      state_code: packet.state_code,
      document_kind: item.category,
      label: item.label,
      is_required: true,
    }));

    const { data: inserted, error: insertErr } = await db
      .schema("snap_enrollment")
      .from("required_document_items")
      .insert(rows)
      .select();

    if (insertErr) throw new HTTPException(500, { message: insertErr.message });
    return c.json({ seeded: inserted?.length ?? 0, items: inserted }, 201);
  }
);

export default app;
