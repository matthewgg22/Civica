import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import { getOrCreateApplicant } from "../lib/applicant.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

// GET /me/inbox — pending missing-item requests for the applicant's packets
app.get("/", async (c) => {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Staff accounts must use the dashboard API" });
  }

  const applicant = await getOrCreateApplicant(c.env, c.get("jwt"), actor.id);
  const db = makeAnonClient(c.env, c.get("jwt"));

  // Get all packet IDs for this applicant
  const { data: packets, error: pErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null);

  if (pErr) throw new HTTPException(500, { message: pErr.message });

  const packetIds = (packets ?? []).map((p) => p.packet_id);
  if (packetIds.length === 0) return c.json([]);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("missing_item_requests")
    .select(`
      request_id, packet_id, status, sent_at, resolved_at,
      required_document_items(label)
    `)
    .in("packet_id", packetIds)
    .order("sent_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(
    (data ?? []).map((row) => {
      const docItem = Array.isArray(row.required_document_items)
        ? row.required_document_items[0]
        : row.required_document_items;

      return {
        id: row.request_id,
        packet_id: row.packet_id,
        prompt: docItem?.label ?? "Additional document requested",
        created_at: row.sent_at,
        resolved: row.status !== "pending",
      };
    })
  );
});

// POST /me/inbox/:requestId/resolve — mark a missing-item request as resolved
app.post("/:requestId/resolve", async (c) => {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Staff accounts must use the dashboard API" });
  }

  const applicant = await getOrCreateApplicant(c.env, c.get("jwt"), actor.id);
  const db = makeAnonClient(c.env, c.get("jwt"));

  // Verify the request belongs to one of the applicant's packets
  const { data: request, error: fetchErr } = await db
    .schema("snap_enrollment")
    .from("missing_item_requests")
    .select("request_id, packet_id, status")
    .eq("request_id", c.req.param("requestId"))
    .single();

  if (!request) {
    throw new HTTPException(404, { message: "Request not found" });
  }
  if (fetchErr) throw new HTTPException(500, { message: (fetchErr as { message: string }).message });

  const { data: packet } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", request.packet_id)
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (!packet) throw new HTTPException(403, { message: "Request belongs to a different applicant" });

  const db = await withActorContext(c);
  const { error } = await db
    .schema("snap_enrollment")
    .from("missing_item_requests")
    .update({ status: "uploaded", updated_at: new Date().toISOString() })
    .eq("request_id", c.req.param("requestId"));

  if (error) throw new HTTPException(500, { message: error.message });
  return c.body(null, 204);
});

export default app;
