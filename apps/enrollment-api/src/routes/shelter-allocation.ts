import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

const shelterAllocationSchema = z.object({
  total_lease_rent_usd: z.number().positive(),
  allocated_rent_usd: z.number().positive(),
  allocation_method: z.enum([
    "bedroom_split",
    "equal_split",
    "dollar_amount",
    "documented_roommate_agreement",
  ]),
  evidence_document_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).refine(
  (d) => d.allocated_rent_usd <= d.total_lease_rent_usd,
  { message: "allocated_rent_usd cannot exceed total_lease_rent_usd", path: ["allocated_rent_usd"] },
);

// GET /packets/:packetId/shelter-allocation
app.get("/packets/:packetId/shelter-allocation", async (c) => {
  const db = makeAnonClient(c.env, c.get("jwt"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment") as any)
    .from("shelter_allocations")
    .select("*, staff_users(staff_id, display_name)")
    .eq("packet_id", c.req.param("packetId"))
    .maybeSingle();

  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) return c.json(null, 200);
  return c.json(data);
});

// POST /packets/:packetId/shelter-allocation
// Creates or replaces the allocation for this packet (upsert on packet_id).
// Navigator-only: applicants cannot call this endpoint.
app.post(
  "/packets/:packetId/shelter-allocation",
  zValidator("json", shelterAllocationSchema),
  async (c) => {
    const actor = c.get("actor");
    if (actor.kind === "applicant") {
      throw new HTTPException(403, { message: "Applicants cannot set shelter allocations" });
    }

    const body = c.req.valid("json");
    const db = await withActorContext(c);

    // Verify packet exists and is accessible
    const { data: packet, error: pErr } = await db
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id")
      .eq("packet_id", c.req.param("packetId"))
      .is("deleted_at", null)
      .single();

    if (pErr) {
      if (pErr.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
      throw new HTTPException(500, { message: pErr.message });
    }
    if (!packet) throw new HTTPException(404, { message: "Packet not found" });

    const household_share_pct =
      Math.round((body.allocated_rent_usd / body.total_lease_rent_usd) * 10000) / 10000;

    // Upsert — unique constraint on packet_id means re-allocation replaces the previous row.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db.schema("snap_enrollment") as any)
      .from("shelter_allocations")
      .upsert(
        {
          packet_id: c.req.param("packetId"),
          total_lease_rent_usd: body.total_lease_rent_usd,
          household_share_pct,
          allocated_rent_usd: body.allocated_rent_usd,
          allocation_method: body.allocation_method,
          evidence_document_id: body.evidence_document_id ?? null,
          navigator_staff_id: actor.id,
          notes: body.notes ?? null,
        },
        { onConflict: "packet_id" },
      )
      .select()
      .single();

    if (error) throw new HTTPException(500, { message: error.message });
    return c.json(data, 201);
  },
);

// DELETE /packets/:packetId/shelter-allocation
// Removes a previous allocation (e.g., packet reclassified as primary tenancy).
app.delete("/packets/:packetId/shelter-allocation", async (c) => {
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot remove shelter allocations" });
  }

  const db = await withActorContext(c);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.schema("snap_enrollment") as any)
    .from("shelter_allocations")
    .delete()
    .eq("packet_id", c.req.param("packetId"));

  if (error) throw new HTTPException(500, { message: error.message });
  return c.body(null, 204);
});

export default app;
