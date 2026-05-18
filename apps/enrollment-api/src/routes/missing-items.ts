import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

const createSchema = z.object({
  required_item_id: z.string().uuid().optional(),
  message_ciphertext: z.string().max(2000).optional(), // Fernet-encrypted plain-language note
  bump_packet_status: z.boolean().default(true), // auto-move packet to "Needs Documents"
});

// GET /packets/:packetId/missing-items — navigator-side list
app.get("/packets/:packetId/missing-items", async (c) => {
  const packetId = c.req.param("packetId");
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants must use /me/inbox" });
  }
  const db = makeAnonClient(c.env, c.get("jwt"));
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("missing_item_requests")
    .select(`
      request_id, status, sent_at, resolved_at, requested_by_staff_id,
      required_document_items(item_id, label, document_kind)
    `)
    .eq("packet_id", packetId)
    .order("sent_at", { ascending: false });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data ?? []);
});

// POST /packets/:packetId/missing-items — navigator creates a request
app.post("/packets/:packetId/missing-items", zValidator("json", createSchema), async (c) => {
  const packetId = c.req.param("packetId");
  const body = c.req.valid("json");
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot create missing-item requests" });
  }

  const db = await withActorContext(c);

  // If a required_item_id was passed, verify it belongs to the same packet
  if (body.required_item_id) {
    const { data: item } = await db
      .schema("snap_enrollment")
      .from("required_document_items")
      .select("item_id, packet_id")
      .eq("item_id", body.required_item_id)
      .single();
    if (!item || item.packet_id !== packetId) {
      throw new HTTPException(400, { message: "required_item_id does not belong to this packet" });
    }
  }

  const { data: inserted, error: insertErr } = await db
    .schema("snap_enrollment")
    .from("missing_item_requests")
    .insert({
      packet_id: packetId,
      required_item_id: body.required_item_id ?? null,
      requested_by_staff_id: actor.id,
      message_ciphertext: body.message_ciphertext ?? null,
      status: "pending" as const,
    })
    .select("request_id, sent_at, status")
    .single();
  if (insertErr) throw new HTTPException(500, { message: insertErr.message });

  // Bump packet status to "Needs Documents" if it isn't already in a waiting state
  if (body.bump_packet_status) {
    const { data: packet } = await db
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("status")
      .eq("packet_id", packetId)
      .single();
    if (packet && packet.status !== "Needs Documents" && packet.status !== "Needs Applicant Clarification") {
      const { error: bumpErr } = await db
        .schema("snap_enrollment")
        .from("snap_packets")
        .update({ status: "Needs Documents" })
        .eq("packet_id", packetId);
      if (bumpErr && bumpErr.code !== "P0001") {
        // P0001 means the status-transition guard rejected the move (e.g. from
        // Closed). That's expected; just log and continue — the request is saved.
        console.warn(`missing-item: packet bump failed: ${bumpErr.message}`);
      }
    }
  }

  return c.json(inserted, 201);
});

// POST /missing-items/:requestId/cancel — navigator cancels a pending request
app.post("/missing-items/:requestId/cancel", async (c) => {
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot cancel requests" });
  }
  const db = await withActorContext(c);
  const { error } = await db
    .schema("snap_enrollment")
    .from("missing_item_requests")
    .update({ status: "resolved" as const, resolved_at: new Date().toISOString(), resolved_by_staff_id: actor.id })
    .eq("request_id", c.req.param("requestId"))
    .eq("status", "pending");
  if (error) throw new HTTPException(500, { message: error.message });
  return c.body(null, 204);
});

// POST /missing-items/:requestId/resolve — navigator confirms an uploaded document satisfies the request.
// Accepts both "pending" and "uploaded" statuses (covers both cancel-before-upload and post-upload confirmation).
app.post("/missing-items/:requestId/resolve", async (c) => {
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot resolve requests" });
  }
  const db = await withActorContext(c);
  const { error } = await db
    .schema("snap_enrollment")
    .from("missing_item_requests")
    .update({ status: "resolved" as const, resolved_at: new Date().toISOString(), resolved_by_staff_id: actor.id })
    .eq("request_id", c.req.param("requestId"))
    .in("status", ["pending", "uploaded"]);
  if (error) throw new HTTPException(500, { message: error.message });
  return c.body(null, 204);
});

export default app;
